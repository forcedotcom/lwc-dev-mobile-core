/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfError } from '@salesforce/core';
import {
    RequirementProcessor,
    HasRequirements,
    CommandRequirements
} from '../Requirements';

const logger = new Logger('test');

Messages.importMessagesDirectory(__dirname);

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

class TruthyRequirements implements HasRequirements {
    public commandRequirements: CommandRequirements = {};
    constructor() {
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
        this.commandRequirements.baseRequirements = {
            requirements,
            enabled: true
        };
    }
}

// tslint:disable-next-line: max-classes-per-file
class FalsyRequirements implements HasRequirements {
    public commandRequirements: CommandRequirements = {};
    constructor() {
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
        this.commandRequirements.baseRequirements = {
            requirements,
            enabled: true
        };
    }
}

// tslint:disable-next-line: max-classes-per-file
class TwoFalsyOneTruthyRequirements implements HasRequirements {
    public commandRequirements: CommandRequirements = {};
    constructor() {
        this.commandRequirements.falsyRequirementOne = {
            requirements: [
                {
                    title: 'title1',
                    checkFunction: checkRejectFunctionOne,
                    logger
                }
            ],
            enabled: true
        };
        this.commandRequirements.falsyRequirementTwo = {
            requirements: [
                {
                    title: 'title2',
                    checkFunction: checkRejectFunctionTwo,
                    logger
                }
            ],
            enabled: true
        };
        this.commandRequirements.truthyRequirement = {
            requirements: [
                {
                    title: 'title3',
                    checkFunction: checkResolveFunctionOne,
                    logger
                }
            ],
            enabled: true
        };
    }
}

describe('Requirements Processing', () => {
    const messages = Messages.loadMessages(
        '@salesforce/lwc-dev-mobile-core',
        'requirement'
    );

    const failureMessage = messages.getMessage('error:requirementCheckFailed');
    const recommendationMessage = messages.getMessage(
        'error:requirementCheckFailed:recommendation'
    );

    test('Meets all requirements', async () => {
        expect.assertions(1);
        await RequirementProcessor.execute(
            new TruthyRequirements().commandRequirements
        );
        expect(true).toBeTruthy();
    });

    test('Throws when any requirement fails', async () => {
        expect.assertions(4);
        try {
            await RequirementProcessor.execute(
                new FalsyRequirements().commandRequirements
            );
        } catch (error) {
            expect(error instanceof SfError).toBeTruthy();
            const sfError = error as SfError;
            expect(sfError.message).toBe(failureMessage);
            expect(sfError.actions?.length).toBe(1);
            expect(sfError.actions?.[0]).toBe(recommendationMessage);
        }
    });

    test('Skips all requirements that would fail and only executes a requirement that succeeds', async () => {
        const requirements = new TwoFalsyOneTruthyRequirements();
        requirements.commandRequirements.falsyRequirementOne.enabled = false;
        requirements.commandRequirements.falsyRequirementTwo.enabled = false;
        await RequirementProcessor.execute(requirements.commandRequirements);
        expect(true).toBeTruthy();
    });

    test('Fails when there is a failed requirement check in combo checks', async () => {
        expect.assertions(4);
        const requirements = new TwoFalsyOneTruthyRequirements();
        try {
            await RequirementProcessor.execute(
                requirements.commandRequirements
            );
        } catch (error) {
            expect(error instanceof SfError).toBeTruthy();
            const sfError = error as SfError;
            expect(sfError.message).toBe(failureMessage);
            expect(sfError.actions?.length).toBe(1);
            expect(sfError.actions?.[0]).toBe(recommendationMessage);
        }
    });

    test('Skips all checks and check will ', async () => {
        const requirements = new FalsyRequirements();
        requirements.commandRequirements.baseRequirements.enabled = false;
        await RequirementProcessor.execute(requirements.commandRequirements);
        expect(true).toBeTruthy();
    });
});
