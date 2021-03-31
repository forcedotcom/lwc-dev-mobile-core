/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import { CommandChecks } from '../Requirements';

const logger = new Logger('test');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'requirement'
);

const checkFailureMessage = 'Requirement check failed';
const checkRecommendationMessage = 'Install tools to prepare your environment';

async function checkResolveFunctionOne(): Promise<string> {
    return Promise.resolve('Done');
}

async function checkResolveFunctionTwo(): Promise<string> {
    return Promise.resolve('Done');
}

async function checkRejectFunctionOne(): Promise<undefined> {
    return Promise.reject();
}

async function checkRejectFunctionTwo(): Promise<undefined> {
    return Promise.reject();
}

class TruthyChecks extends CommandChecks {
    constructor() {
        super(logger);
        const requirements = [
            {
                checkFunction: checkResolveFunctionOne,
                fulfilledMessage: 'Android SDK was detected.',
                logger,
                title: 'SDK Check',
                unfulfilledMessage:
                    'You must install Android SDK add it to the path.'
            },
            {
                checkFunction: checkResolveFunctionTwo,
                fulfilledMessage: 'ANDROID_HOME has been detected.',
                logger,
                title: 'ANDROID_HOME check',
                unfulfilledMessage: 'You must setup ANDROID_HOME.'
            }
        ];
        this.checks.baseRequirements = {
            requirements,
            enabled: true
        };
    }
}

// tslint:disable-next-line: max-classes-per-file
class FalsyChecks extends CommandChecks {
    constructor() {
        super(logger);
        const requirements = [
            {
                checkFunction: checkResolveFunctionOne,
                fulfilledMessage: 'Android SDK was detected.',
                logger,
                title: 'SDK Check',
                unfulfilledMessage:
                    'You must install Android SDK add it to the path.'
            },
            {
                checkFunction: checkRejectFunctionOne,
                fulfilledMessage: 'ANDROID_HOME has been detected.',
                logger,
                title: 'ANDROID_HOME check',
                unfulfilledMessage: 'You must setup ANDROID_HOME.'
            },
            {
                checkFunction: checkRejectFunctionTwo,
                logger,
                title: 'Checking SDK Tools'
            },
            {
                checkFunction: checkRejectFunctionTwo,
                fulfilledMessage:
                    'Android Platform tools were detected at /usr/bin.',
                logger,
                supplementalMessage: 'Get Android platform tools!',
                title: 'Checking SDK Platform Tools',
                unfulfilledMessage:
                    'Install at least one Android Platform tools package (23 - 30).'
            }
        ];
        this.checks.baseRequirements = {
            requirements,
            enabled: true
        };

        this.checkFailureMessage = checkFailureMessage;
        this.checkRecommendationMessage = checkRecommendationMessage;
    }
}

// tslint:disable-next-line: max-classes-per-file
class TwoFalsyOneTruthyChecks extends CommandChecks {
    constructor() {
        super(logger);
        this.checks.falsyRequirementOne = {
            requirements: [
                {
                    title: 'title1',
                    checkFunction: checkRejectFunctionOne,
                    logger
                }
            ],
            enabled: true
        };
        this.checks.falsyRequirementTwo = {
            requirements: [
                {
                    title: 'title2',
                    checkFunction: checkRejectFunctionTwo,
                    logger
                }
            ],
            enabled: true
        };
        this.checks.truthyRequirement = {
            requirements: [
                {
                    title: 'title3',
                    checkFunction: checkResolveFunctionOne,
                    logger
                }
            ],
            enabled: true
        };

        this.checkFailureMessage = checkFailureMessage;
        this.checkRecommendationMessage = checkRecommendationMessage;
    }
}

describe('Requirements Processing', () => {
    test('Meets all requirements', async () => {
        expect.assertions(1);
        await new TruthyChecks().execute();
        expect(true).toBeTruthy();
    });

    test('Throws when any requirement fails', async () => {
        expect.assertions(4);
        try {
            await new FalsyChecks().execute();
        } catch (error) {
            expect(error instanceof SfdxError).toBeTruthy();
            const sfdxError = error as SfdxError;
            expect(sfdxError.message).toBe(checkFailureMessage);
            expect(sfdxError.actions?.length).toBe(1);
            expect(sfdxError.actions?.[0]).toBe(checkRecommendationMessage);
        }
    });

    test('Skips all requirements that would fail and only executes a requirement that succeeds', async () => {
        const commandChecks = new TwoFalsyOneTruthyChecks();
        commandChecks.checks.falsyRequirementOne.enabled = false;
        commandChecks.checks.falsyRequirementTwo.enabled = false;
        await commandChecks.execute();
        expect(true).toBeTruthy();
    });

    test('Fails when there is a failed requirement check in combo checks', async () => {
        expect.assertions(4);
        const commandChecks = new TwoFalsyOneTruthyChecks();
        try {
            await commandChecks.execute();
        } catch (error) {
            expect(error instanceof SfdxError).toBeTruthy();
            const sfdxError = error as SfdxError;
            expect(sfdxError.message).toBe(checkFailureMessage);
            expect(sfdxError.actions?.length).toBe(1);
            expect(sfdxError.actions?.[0]).toBe(checkRecommendationMessage);
        }
    });

    test('Skips all checks and check will ', async () => {
        const commandChecks = new FalsyChecks();
        commandChecks.checks.baseRequirements.enabled = false;
        await commandChecks.execute();
        expect(true).toBeTruthy();
    });
});
