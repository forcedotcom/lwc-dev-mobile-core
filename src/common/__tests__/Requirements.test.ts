/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import { CommandRequirement } from '../Requirements';

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

class TruthyBaseRequirement extends CommandRequirement {
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
        this.baseRequirements.requirements = requirements;
        this.baseRequirements.enabled = true;
    }
}

// tslint:disable-next-line: max-classes-per-file
class FalsyBaseRequirement extends CommandRequirement {
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
        this.baseRequirements.requirements = requirements;
        this.baseRequirements.enabled = true;

        this.checkFailureMessage = checkFailureMessage;
        this.checkRecommendationMessage = checkRecommendationMessage;
    }
}

// tslint:disable-next-line: max-classes-per-file
class TruthyBaseFalsyCommandRequirement extends CommandRequirement {
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
                checkFunction: checkRejectFunctionTwo,
                fulfilledMessage: 'ANDROID_HOME has been detected.',
                logger,
                title: 'ANDROID_HOME check',
                unfulfilledMessage: 'You must setup ANDROID_HOME.'
            }
        ];
        this.baseRequirements.requirements = requirements;
        this.baseRequirements.enabled = true;

        const commandRequirements = [
            {
                checkFunction: checkRejectFunctionOne,
                fulfilledMessage: 'Command requirement test passed.',
                logger,
                title: 'Command requirement test',
                unfulfilledMessage: 'Command requirement test failed.'
            }
        ];
        this.commandRequirements.requirements = commandRequirements;
        this.commandRequirements.enabled = true;

        this.checkFailureMessage = checkFailureMessage;
        this.checkRecommendationMessage = checkRecommendationMessage;
    }
}

// tslint:disable-next-line: max-classes-per-file
class FalsyBaseTruthyCommandRequirement extends CommandRequirement {
    constructor() {
        super(logger);
        const requirements = [
            {
                checkFunction: checkRejectFunctionOne,
                fulfilledMessage: 'Android SDK was detected.',
                logger,
                title: 'SDK Check',
                unfulfilledMessage:
                    'You must install Android SDK add it to the path.'
            }
        ];
        this.baseRequirements.requirements = requirements;
        this.baseRequirements.enabled = true;

        const commandRequirements = [
            {
                checkFunction: checkResolveFunctionOne,
                fulfilledMessage: 'Command requirement test passed.',
                logger,
                title: 'Command requirement test',
                unfulfilledMessage: 'Command requirement test failed.'
            }
        ];
        this.commandRequirements.requirements = commandRequirements;
        this.commandRequirements.enabled = true;

        this.checkFailureMessage = checkFailureMessage;
        this.checkRecommendationMessage = checkRecommendationMessage;
    }
}

// tslint:disable-next-line: max-classes-per-file
class FalsyBaseFalsyCommandRequirement extends CommandRequirement {
    constructor() {
        super(logger);
        const requirements = [
            {
                checkFunction: checkRejectFunctionOne,
                fulfilledMessage: 'Android SDK was detected.',
                logger,
                title: 'SDK Check',
                unfulfilledMessage:
                    'You must install Android SDK add it to the path.'
            }
        ];
        this.baseRequirements.requirements = requirements;
        this.baseRequirements.enabled = true;

        const commandRequirements = [
            {
                checkFunction: checkRejectFunctionTwo,
                fulfilledMessage: 'Command requirement test passed.',
                logger,
                title: 'Command requirement test',
                unfulfilledMessage: 'Command requirement test failed.'
            }
        ];
        this.commandRequirements.requirements = commandRequirements;
        this.commandRequirements.enabled = true;

        this.checkFailureMessage = checkFailureMessage;
        this.checkRecommendationMessage = checkRecommendationMessage;
    }
}

describe('Requirements Processing', () => {
    test('Meets all requirements', async () => {
        expect.assertions(1);
        await new TruthyBaseRequirement().executeChecks();
        expect(true).toBeTruthy();
    });

    test('Throws when any base requirement fails', async () => {
        expect.assertions(4);
        try {
            await new FalsyBaseRequirement().executeChecks();
        } catch (error) {
            expect(error instanceof SfdxError).toBeTruthy();
            const sfdxError = error as SfdxError;
            expect(sfdxError.message).toBe(checkFailureMessage);
            expect(sfdxError.actions?.length).toBe(1);
            expect(sfdxError.actions?.[0]).toBe(checkRecommendationMessage);
        }
    });

    test('Skips all base requirements and only executes command requirements', async () => {
        const requirement = new FalsyBaseTruthyCommandRequirement();
        requirement.baseRequirements.enabled = false;
        await requirement.executeChecks();
        expect(true).toBeTruthy();
    });

    test('Skips all base requirements and only executes and fails with command requirements', async () => {
        expect.assertions(4);
        const requirement = new TruthyBaseFalsyCommandRequirement();
        requirement.baseRequirements.enabled = false;
        try {
            await requirement.executeChecks();
        } catch (error) {
            expect(error instanceof SfdxError).toBeTruthy();
            const sfdxError = error as SfdxError;
            expect(sfdxError.message).toBe(checkFailureMessage);
            expect(sfdxError.actions?.length).toBe(1);
            expect(sfdxError.actions?.[0]).toBe(checkRecommendationMessage);
        }
    });

    test('Skips all base and command requirements', async () => {
        const requirement = new FalsyBaseFalsyCommandRequirement();
        requirement.baseRequirements.enabled = false;
        requirement.commandRequirements.enabled = false;
        await requirement.executeChecks();
        expect(true).toBeTruthy();
    });
});
