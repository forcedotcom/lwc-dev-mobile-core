/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages } from '@salesforce/core';
import chalk from 'chalk';
import { Listr } from 'listr2';
import { performance, PerformanceObserver } from 'perf_hooks';
import { PerformanceMarkers } from './PerformanceMarkers';
export type CheckRequirementsFunc = () => Promise<string | undefined>;
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

export interface Requirement {
    title: string;
    checkFunction: CheckRequirementsFunc;
    fulfilledMessage?: string;
    unfulfilledMessage?: string;
    supplementalMessage?: string;
    logger: Logger;
}

export interface RequirementResult {
    duration: number;
    hasPassed: boolean;
    message: string;
    title: string;
}

export interface SetupTestResult {
    hasMetAllRequirements: boolean;
    tests: RequirementResult[];
}

export interface RequirementList {
    requirements: Requirement[];
    executeSetup(): Promise<SetupTestResult>;
}

// This function wraps existing promises with the intention to allow the collection of promises
// to settle when used in conjunction with Promise.all(). Promise.all() by default executes until the first
// rejection. We are looking for the equivalent of Promise.allSettled() which is scheduled for ES2020.
// Once the functionality is  available  in the near future this function can be removed.
// See https://github.com/tc39/proposal-promise-allSettled
export function WrappedPromise(
    requirement: Requirement
): Promise<RequirementResult> {
    const promise = requirement.checkFunction();
    const perfMarker = PerformanceMarkers.getByName(
        PerformanceMarkers.REQUIREMENTS_MARKER_KEY
    )!;

    let stepDuration: number = 0;
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

export abstract class BaseSetup implements RequirementList {
    public skipBaseRequirements: boolean = false;
    public skipAdditionalRequirements: boolean = false;
    public requirements: Requirement[];
    public additionalRequirements: Requirement[];
    public logger: Logger;
    public setupMessages = Messages.loadMessages(
        '@salesforce/lwc-dev-mobile-core',
        'setup'
    );

    constructor(logger: Logger) {
        this.logger = logger;
        this.requirements = [];
        this.additionalRequirements = [];
    }

    public async executeSetup(): Promise<SetupTestResult> {
        const testResult: SetupTestResult = {
            hasMetAllRequirements: true,
            tests: []
        };

        let totalDuration = 0;
        let allRequirements: Requirement[] = [];
        if (!this.skipBaseRequirements) {
            allRequirements = allRequirements.concat(this.requirements);
        }
        if (!this.skipAdditionalRequirements) {
            allRequirements = allRequirements.concat(
                this.additionalRequirements
            );
        }

        if (allRequirements.length === 0) {
            return Promise.resolve(testResult);
        }

        const rootTaskTitle = this.setupMessages.getMessage('rootTaskTitle');
        const setupTasks = new Listr(
            {
                task: (rootCtx, rootTask): Listr => {
                    const subTasks = new Listr([], {
                        concurrent: true,
                        exitOnError: false
                    });
                    for (const requirement of allRequirements) {
                        subTasks.add({
                            options: { persistentOutput: true },
                            task: (subCtx, subTask): Promise<void> =>
                                WrappedPromise(requirement).then((result) => {
                                    testResult.tests.push(result);
                                    if (!result.hasPassed) {
                                        testResult.hasMetAllRequirements = false;
                                    }

                                    subTask.title = this.getFormattedTitle(
                                        result
                                    );
                                    subTask.output = result.message;

                                    totalDuration += result.duration;
                                    rootTask.title = `${rootTaskTitle} (${this.formatDurationAsSeconds(
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

        try {
            await setupTasks.run();
        } catch (error) {
            this.logger.error(error);
            testResult.hasMetAllRequirements = false;
        }

        return Promise.resolve(testResult);
    }

    public addBaseRequirements(reqs: Requirement[]) {
        if (reqs) {
            this.requirements = this.requirements.concat(reqs);
        }
    }

    public addAdditionalRequirements(reqs: Requirement[]) {
        if (reqs) {
            this.additionalRequirements = this.additionalRequirements.concat(
                reqs
            );
        }
    }

    private getFormattedTitle(testCaseResult: RequirementResult): string {
        const statusMsg = testCaseResult.hasPassed
            ? this.setupMessages.getMessage('passed')
            : this.setupMessages.getMessage('failed');

        const title = `${statusMsg}: ${
            testCaseResult.title
        } (${this.formatDurationAsSeconds(testCaseResult.duration)})`;

        return testCaseResult.hasPassed
            ? chalk.bold.green(title)
            : chalk.bold.red(title);
    }

    private formatDurationAsSeconds(duration: number): string {
        return `${duration.toFixed(3)} sec`;
    }
}
