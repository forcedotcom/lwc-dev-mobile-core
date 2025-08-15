/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { Logger, Messages, SfError } from '@salesforce/core';
import chalk from 'chalk';
import { Listr } from 'listr2';
import { PerformanceMarkers } from './PerformanceMarkers.js';
export type CheckRequirementsFunc = () => Promise<string | undefined>;

export type Requirement = {
    title: string;
    checkFunction: CheckRequirementsFunc;
    fulfilledMessage?: string;
    unfulfilledMessage?: string;
    supplementalMessage?: string;
    logger: Logger;
};

type RequirementResult = {
    duration: number;
    hasPassed: boolean;
    message: string;
    title: string;
};

export type RequirementCheckResult = {
    hasMetAllRequirements: boolean;
    tests: RequirementResult[];
};

export type RequirementList = {
    requirements: Requirement[];
    enabled: boolean;
};

export type CommandRequirements = { [key: string]: RequirementList };

export type HasRequirements = {
    commandRequirements: CommandRequirements;
};

/**
 * This function wraps existing promises with the intention to allow the collection of promises
 * to settle when used in conjunction with Promise.all(). Promise.all() by default executes until the first
 * rejection. We are looking for the equivalent of Promise.allSettled() which is scheduled for ES2020.
 * When the functionality is available this function can be removed.
 * See https://github.com/tc39/proposal-promise-allSettled
 *
 * @param requirement A Requirement object
 * @returns A Promise object that runs the requirement check and returns a RequirementResult object.
 */
export async function WrappedPromise(requirement: Requirement): Promise<RequirementResult> {
    const promise = requirement.checkFunction();
    const perfMarker = PerformanceMarkers.getByName(PerformanceMarkers.REQUIREMENTS_MARKER_KEY)!;

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
                requirement.supplementalMessage ? requirement.supplementalMessage : ''
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
                requirement.supplementalMessage ? requirement.supplementalMessage : ''
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

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'requirement');

export type RequirementProcessorOptions = {
    headless?: boolean;
};

export class RequirementProcessor {
    /**
     * Executes all of the base and command requirement checks.
     */
    public static async execute(
        requirements: CommandRequirements,
        options: RequirementProcessorOptions = {}
    ): Promise<RequirementCheckResult> {
        const { headless = false } = options;
        // headless mode is automatically silent by definition
        const silent = headless;

        const testResult: RequirementCheckResult = {
            hasMetAllRequirements: true,
            tests: []
        };

        let totalDuration = 0;
        let enabledRequirements: Requirement[] = [];

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Object.entries(requirements).forEach(([_, requirementList]) => {
            if (requirementList.enabled) {
                enabledRequirements = enabledRequirements.concat(requirementList.requirements);
            }
        });

        if (enabledRequirements.length === 0) {
            return testResult;
        }

        if (headless) {
            // Headless mode: run all requirements concurrently without Listr
            const requirementPromises = enabledRequirements.map((requirement) => WrappedPromise(requirement));

            const results = await Promise.all(requirementPromises);

            for (const result of results) {
                testResult.tests.push(result);
                if (!result.hasPassed) {
                    testResult.hasMetAllRequirements = false;
                }
                totalDuration += result.duration;
            }

            if (!silent) {
                // Log summary in headless mode
                const logger = new Logger('RequirementProcessor');
                logger.info(
                    `Requirements check completed in ${RequirementProcessor.formatDurationAsSeconds(totalDuration)}`
                );
                logger.info(`Passed: ${testResult.tests.filter((t) => t.hasPassed).length}/${testResult.tests.length}`);

                for (const test of testResult.tests) {
                    const status = test.hasPassed ? '✓' : '✗';
                    const duration = RequirementProcessor.formatDurationAsSeconds(test.duration);
                    logger.info(`${status} ${test.title} (${duration})`);
                    if (!test.hasPassed && test.message) {
                        logger.error(`  ${test.message}`);
                    }
                }
            }

            return testResult;
        }

        // Interactive mode: use Listr as before
        const rootTaskTitle = messages.getMessage('rootTaskTitle');
        const requirementTasks = new Listr(
            {
                task: (_rootCtx, rootTask): Listr => {
                    const subTasks = new Listr([], {
                        concurrent: true,
                        exitOnError: false
                    });
                    for (const requirement of enabledRequirements) {
                        subTasks.add({
                            rendererOptions: { persistentOutput: true },
                            task: (_subCtx, subTask): Promise<void> =>
                                WrappedPromise(requirement).then((result) => {
                                    testResult.tests.push(result);
                                    if (!result.hasPassed) {
                                        testResult.hasMetAllRequirements = false;
                                    }

                                    // eslint-disable-next-line no-param-reassign
                                    subTask.title = RequirementProcessor.getFormattedTitle(result);
                                    // eslint-disable-next-line no-param-reassign
                                    subTask.output = result.message;

                                    totalDuration += result.duration;
                                    // eslint-disable-next-line no-param-reassign
                                    rootTask.title = `${rootTaskTitle} (${RequirementProcessor.formatDurationAsSeconds(
                                        totalDuration
                                    )})`;

                                    // In order for Lister to mark a task with ✓ or 𐄂, the task promise must either
                                    // resolve or reject. For the failure case we just reject with an empty error
                                    // so that Listr would not replace the task title & output with the error message.
                                    // We want those to be formatted in a certain way so we update the task title and
                                    // output further up ourselves.
                                    return result.hasPassed ? Promise.resolve() : Promise.reject(new Error());
                                }),
                            title: requirement.title
                        });
                    }

                    return subTasks;
                },
                title: rootTaskTitle
            },
            {
                rendererOptions: {
                    collapseSubtasks: false,
                    collapseErrors: false,
                    formatOutput: 'wrap'
                }
            }
        );

        try {
            await requirementTasks.run();
        } catch (error) {
            return Promise.reject(
                new SfError(messages.getMessage('error:unexpected', [(error as Error).message]), 'lwc-dev-mobile-core')
            );
        }

        return testResult;
    }

    private static getFormattedTitle(testCaseResult: RequirementResult): string {
        const statusMsg = testCaseResult.hasPassed ? messages.getMessage('passed') : messages.getMessage('failed');

        const title = `${statusMsg}: ${testCaseResult.title} (${RequirementProcessor.formatDurationAsSeconds(
            testCaseResult.duration
        )})`;

        return testCaseResult.hasPassed ? chalk.bold.green(title) : chalk.bold.red(title);
    }

    private static formatDurationAsSeconds(duration: number): string {
        return `${duration.toFixed(3)} sec`;
    }
}
