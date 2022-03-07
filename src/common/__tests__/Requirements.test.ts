/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import util from 'util';
import {
    RequirementProcessor,
    HasRequirements,
    CommandRequirements
} from '../Requirements';

const logger = new Logger('test');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'requirement'
);

const failureMessage = messages.getMessage('error:requirementCheckFailed');
const recommendationMessage = messages.getMessage(
    'error:requirementCheckFailed:recommendation'
);

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
                skipped: false,
                unfulfilledMessage:
                    'You must install Android SDK add it to the path.'
            },
            {
                checkFunction: checkResolveFunctionTwo,
                fulfilledMessage: 'ANDROID_HOME has been detected.',
                logger,
                title: 'ANDROID_HOME check',
                skipped: false,
                unfulfilledMessage: 'You must setup ANDROID_HOME.'
            }
        ];
        this.commandRequirements.baseRequirements = {
            requirements,
            enabled: true,
            title: 'baseRequirements'
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
                skipped: false,
                unfulfilledMessage:
                    'You must install Android SDK add it to the path.'
            },
            {
                checkFunction: checkRejectFunctionOne,
                fulfilledMessage: 'ANDROID_HOME has been detected.',
                logger,
                title: 'ANDROID_HOME check',
                skipped: false,
                unfulfilledMessage: 'You must setup ANDROID_HOME.'
            },
            {
                checkFunction: checkRejectFunctionTwo,
                logger,
                title: 'Checking SDK Tools',
                skipped: false
            },
            {
                checkFunction: checkRejectFunctionTwo,
                fulfilledMessage:
                    'Android Platform tools were detected at /usr/bin.',
                logger,
                supplementalMessage: 'Get Android platform tools!',
                title: 'Checking SDK Platform Tools',
                skipped: false,
                unfulfilledMessage:
                    'Install at least one Android Platform tools package (23 - 30).'
            }
        ];
        this.commandRequirements.baseRequirements = {
            requirements,
            enabled: true,
            title: 'base Requirements'
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
                    skipped: false,
                    checkFunction: checkRejectFunctionOne,
                    logger
                }
            ],
            enabled: true,
            title: 'falsyRequirementOne'
        };
        this.commandRequirements.falsyRequirementTwo = {
            requirements: [
                {
                    title: 'title2',
                    skipped: false,
                    checkFunction: checkRejectFunctionTwo,
                    logger
                }
            ],
            enabled: true,
            title: 'falsyRequirementTwo'
        };
        this.commandRequirements.truthyRequirement = {
            requirements: [
                {
                    title: 'title3',
                    skipped: false,
                    checkFunction: checkResolveFunctionOne,
                    logger
                }
            ],
            enabled: true,
            title: 'truthyRequirement'
        };
    }
}

describe('Requirements Processing', () => {
    test('Meets all requirements', async () => {
        expect.assertions(1);
        await RequirementProcessor.execute(
            new TruthyRequirements().commandRequirements,
            'android'
        );
        expect(true).toBeTruthy();
    });

    test('Throws when any requirement fails', async () => {
        const platform = 'ios';
        const expectedFailureMessage = util.format(failureMessage, platform);
        expect.assertions(4);
        try {
            await RequirementProcessor.execute(
                new FalsyRequirements().commandRequirements,
                platform
            );
        } catch (error) {
            expect(error instanceof SfdxError).toBeTruthy();
            const sfdxError = error as SfdxError;
            expect(sfdxError.message).toBe(expectedFailureMessage);
            expect(sfdxError.actions?.length).toBe(1);
            expect(sfdxError.actions?.[0]).toBe(recommendationMessage);
        }
    });

    test('Skips all requirements that would fail and only executes a requirement that succeeds', async () => {
        const requirements = new TwoFalsyOneTruthyRequirements();
        requirements.commandRequirements.falsyRequirementOne.enabled = false;
        requirements.commandRequirements.falsyRequirementTwo.enabled = false;
        await RequirementProcessor.execute(
            requirements.commandRequirements,
            'anyplatform'
        );
        expect(true).toBeTruthy();
    });

    test('Fails when there is a failed requirement check in combo checks', async () => {
        expect.assertions(4);
        const platform = 'platform1';
        const expectedFailureMessage = util.format(failureMessage, platform);
        const requirements = new TwoFalsyOneTruthyRequirements();
        try {
            await RequirementProcessor.execute(
                requirements.commandRequirements,
                platform
            );
        } catch (error) {
            expect(error instanceof SfdxError).toBeTruthy();
            const sfdxError = error as SfdxError;
            expect(sfdxError.message).toBe(expectedFailureMessage);
            expect(sfdxError.actions?.length).toBe(1);
            expect(sfdxError.actions?.[0]).toBe(recommendationMessage);
        }
    });

    test('Skips all checks and check will ', async () => {
        const requirements = new FalsyRequirements();
        requirements.commandRequirements.baseRequirements.enabled = false;
        await RequirementProcessor.execute(
            requirements.commandRequirements,
            'platform2'
        );
        expect(true).toBeTruthy();
    });
});
