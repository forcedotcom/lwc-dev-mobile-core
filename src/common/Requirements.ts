/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import chalk from 'chalk';
import util from 'util';
import { Listr } from 'listr2';
import { performance, PerformanceObserver } from 'perf_hooks';
import { PerformanceMarkers } from './PerformanceMarkers';
export type CheckRequirementsFunc = () => Promise<string | undefined>;
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

export interface Requirement {
    title: string;
    skipped: boolean;
    checkFunction: CheckRequirementsFunc;
    fulfilledMessage?: string;
    unfulfilledMessage?: string;
    supplementalMessage?: string;
    logger: Logger;
}

interface RequirementResult {
    duration: number;
    hasPassed: boolean;
    message: string;
    title: string;
}

interface RequirementCheckResult {
    hasMetAllRequirements: boolean;
    tests: RequirementResult[];
}

export interface RequirementList {
    requirements: Requirement[];
    enabled: boolean;
    title: string;
}

export type CommandRequirements = { [key: string]: RequirementList };

export interface HasRequirements {
    commandRequirements: CommandRequirements;
}

/**
 * This function wraps existing promises with the intention to allow the collection of promises
 * to settle when used in conjunction with Promise.all(). Promise.all() by default executes until the first
 * rejection. We are looking for the equivalent of Promise.allSettled() which is scheduled for ES2020.
 * When the functionality is available this function can be removed.
 * See https://github.com/tc39/proposal-promise-allSettled
 * @param requirement A Requirement object
 * @returns A Promise object that runs the requirement check and returns a RequirementResult object.
 */
export function WrappedPromise(
    requirement: Requirement
): Promise<RequirementResult> {
    const promise = requirement.checkFunction();
    const perfMarker = PerformanceMarkers.getByName(
        PerformanceMarkers.REQUIREMENTS_MARKER_KEY
    )!;

    let stepDuration = 0;
    const obs = new PerformanceObserver((items) => {
        stepDuration = items.getEntries()[0].duration / 1000;
    });
    obs.observe({ entryTypes: ['measure'] });

    const start = `${perfMarker.startMarkName}_${requirement.title}`;
    const end = `${perfMarker.endMarkName}_${requirement.title}`;
    const step = `${perfMarker.name}_${requirement.title}`;

    performance.mark(start);
    return promise
        .then((fulfilledMessage) => {
            performance.mark(end);
            performance.measure(step, start, end);
            const msg = `${fulfilledMessage ? fulfilledMessage : ''} ${
                requirement.supplementalMessage
                    ? requirement.supplementalMessage
                    : ''
            }`;
            return {
                duration: stepDuration,
                hasPassed: true,
                message: msg.trim(),
                title: requirement.title
            };
        })
        .catch((unfulfilledMessage) => {
            performance.mark(end);
            performance.measure(step, start, end);
            const msg = `${unfulfilledMessage ? unfulfilledMessage : ''} ${
                requirement.supplementalMessage
                    ? requirement.supplementalMessage
                    : ''
            }`;
            return {
                duration: stepDuration,
                hasPassed: false,
                message: msg.trim(),
                title: requirement.title
            };
        })
        .finally(() => {
            obs.disconnect();
        });
}

const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'requirement'
);

export class RequirementProcessor {
    /**
     * Executes all of the base and command requirement checks.
     */
    public static async execute(
        requirements: CommandRequirements,
        platform: string
    ): Promise<void> {
        const requirementCheckResults: RequirementCheckResult[] = [];
        const tasksToRun: Listr[] = [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Object.entries(requirements).forEach(([_, requirementList]) => {
            if (requirementList.enabled) {
                const requirementCheckResult: RequirementCheckResult = {
                    hasMetAllRequirements: true,
                    tests: []
                };
                requirementCheckResults.push(requirementCheckResult);
                tasksToRun.push(
                    this.createTasks(requirementList, requirementCheckResult)
                );
            }
        });

        try {
            await this.processTasks(tasksToRun);

            let hasMetAllRequirements = true;

            for (const results of requirementCheckResults) {
                if (!results.hasMetAllRequirements) {
                    hasMetAllRequirements = false;
                }
            }

            if (!hasMetAllRequirements) {
                return Promise.reject(
                    new SfdxError(
                        util.format(
                            messages.getMessage('error:requirementCheckFailed'),
                            platform
                        ),
                        'lwc-dev-mobile-core',
                        [
                            messages.getMessage(
                                'error:requirementCheckFailed:recommendation'
                            )
                        ]
                    )
                );
            }

            return Promise.resolve();
        } catch (error) {
            return Promise.reject(
                new SfdxError(
                    util.format('unexpected error %s', error),
                    'lwc-dev-mobile-core'
                )
            );
        }
    }

    private static createTasks(
        requirementList: RequirementList,
        testResult: RequirementCheckResult
    ): Listr {
        const rootTaskTitle = requirementList.title;
        let totalDuration = 0;

        return new Listr(
            {
                task: (_rootCtx, rootTask): Listr => {
                    const subTasks = new Listr([], {
                        concurrent: true,
                        exitOnError: false
                    });
                    for (const requirement of requirementList.requirements) {
                        subTasks.add({
                            options: { persistentOutput: true },
                            task: (_subCtx, subTask): Promise<void> =>
                                WrappedPromise(requirement).then((result) => {
                                    testResult.tests.push(result);
                                    if (!result.hasPassed) {
                                        testResult.hasMetAllRequirements =
                                            false;
                                    }

                                    subTask.title =
                                        RequirementProcessor.getFormattedTitle(
                                            result
                                        );
                                    subTask.output = result.message;

                                    totalDuration += result.duration;
                                    rootTask.title = `${rootTaskTitle} (${RequirementProcessor.formatDurationAsSeconds(
                                        totalDuration
                                    )})`;

                                    // In order for Lister to mark a task with ✓ or 𐄂, the task promise must either
                                    // resolve or reject. For the failure case we just reject with an empty error
                                    // so that Listr would not replace the task title & output with the error message.
                                    // We want those to be formatted in a certain way so we update the task title and
                                    // output further up ourselves.
                                    return result.hasPassed
                                        ? Promise.resolve()
                                        : Promise.reject(new Error());
                                }),
                            skip: () =>
                                requirement.skipped == true &&
                                requirement.title,
                            title: requirement.title
                        });
                    }

                    return subTasks;
                },
                title: rootTaskTitle
            },
            {
                rendererOptions: {
                    collapse: false,
                    collapseErrors: false,
                    formatOutput: 'wrap'
                }
            }
        );
    }

    private static async processTasks(tasks: Listr[]) {
        for (const task of tasks) {
            await task.run();
        }
    }

    private static getFormattedTitle(
        testCaseResult: RequirementResult
    ): string {
        const statusMsg = testCaseResult.hasPassed
            ? messages.getMessage('passed')
            : messages.getMessage('failed');

        const title = `${statusMsg}: ${
            testCaseResult.title
        } (${RequirementProcessor.formatDurationAsSeconds(
            testCaseResult.duration
        )})`;

        return testCaseResult.hasPassed
            ? chalk.bold.green(title)
            : chalk.bold.red(title);
    }

    private static formatDurationAsSeconds(duration: number): string {
        return `${duration.toFixed(3)} sec`;
    }
}
