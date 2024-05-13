/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { expect } from 'chai';
import { Logger, Messages, SfError } from '@salesforce/core';
import { RequirementProcessor, HasRequirements, CommandRequirements } from '../../../src/common/Requirements.js';

const logger = new Logger('test');

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

class TruthyRequirements implements HasRequirements {
    public commandRequirements: CommandRequirements = {};
    public constructor() {
        const requirements = [
            {
                checkFunction: () => Promise.resolve(''),
                title: 'SDK Check',
                fulfilledMessage: 'Android SDK was detected.',
                unfulfilledMessage: 'You must install Android SDK and add it to the path.',
                logger
            },
            {
                checkFunction: () => Promise.resolve(''),
                title: 'ANDROID_HOME check',
                fulfilledMessage: 'ANDROID_HOME has been detected.',
                unfulfilledMessage: 'You must setup ANDROID_HOME.',
                logger
            }
        ];
        this.commandRequirements.baseRequirements = {
            requirements,
            enabled: true
        };
    }
}

class FalsyRequirements implements HasRequirements {
    public commandRequirements: CommandRequirements = {};
    public constructor() {
        const requirements = [
            {
                checkFunction: () => Promise.resolve(''),
                logger,
                title: 'SDK Check',
                fulfilledMessage: 'Android SDK was detected.',
                unfulfilledMessage: 'You must install Android SDK add it to the path.'
            },
            {
                checkFunction: () => Promise.reject(),
                logger,
                title: 'ANDROID_HOME check',
                fulfilledMessage: 'ANDROID_HOME has been detected.',
                unfulfilledMessage: 'You must setup ANDROID_HOME.'
            },
            {
                checkFunction: () => Promise.reject(),
                logger,
                title: 'Checking SDK Tools'
            },
            {
                checkFunction: () => Promise.reject(),
                logger,
                title: 'Checking SDK Platform Tools',
                fulfilledMessage: 'Android Platform tools were detected at /usr/bin.',
                unfulfilledMessage: 'Install at least one Android Platform tools package (23 - 30).',
                supplementalMessage: 'Get Android platform tools!'
            }
        ];
        this.commandRequirements.baseRequirements = {
            requirements,
            enabled: true
        };
    }
}

class TwoFalsyOneTruthyRequirements implements HasRequirements {
    public commandRequirements: CommandRequirements = {};
    public constructor() {
        this.commandRequirements.falsyRequirementOne = {
            requirements: [
                {
                    title: 'title1',
                    checkFunction: () => Promise.reject(),
                    logger
                }
            ],
            enabled: true
        };
        this.commandRequirements.falsyRequirementTwo = {
            requirements: [
                {
                    title: 'title2',
                    checkFunction: () => Promise.reject(),
                    logger
                }
            ],
            enabled: true
        };
        this.commandRequirements.truthyRequirement = {
            requirements: [
                {
                    title: 'title3',
                    checkFunction: () => Promise.resolve(''),
                    logger
                }
            ],
            enabled: true
        };
    }
}

describe('Requirements Processing', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'requirement');

    const failureMessage = messages.getMessage('error:requirementCheckFailed');
    const recommendationMessage = messages.getMessage('error:requirementCheckFailed:recommendation');

    it('Meets all requirements', async () => {
        try {
            await RequirementProcessor.execute(new TruthyRequirements().commandRequirements);
        } catch (error: any) {
            throw new Error(`Should have met the requirements: ${error}`);
        }
    });

    it('Throws when any requirement fails', async () => {
        try {
            await RequirementProcessor.execute(new FalsyRequirements().commandRequirements);
        } catch (error: any) {
            expect(error instanceof SfError).to.be.true;
            const sfError = error as SfError;
            expect(sfError.message).to.be.equal(failureMessage);
            expect(sfError.actions?.length).to.be.equal(1);
            expect(sfError.actions?.[0]).to.be.equal(recommendationMessage);
            return;
        }

        throw new Error('Should have failed the requirements');
    });

    it('Skips all requirements that would fail and only executes a requirement that succeeds', async () => {
        const requirements = new TwoFalsyOneTruthyRequirements();
        requirements.commandRequirements.falsyRequirementOne.enabled = false;
        requirements.commandRequirements.falsyRequirementTwo.enabled = false;
        try {
            await RequirementProcessor.execute(requirements.commandRequirements);
        } catch (error: any) {
            throw new Error(`Should have met the requirements: ${error}`);
        }
    });

    it('Fails when there is a failed requirement check in combo checks', async () => {
        try {
            await RequirementProcessor.execute(new TwoFalsyOneTruthyRequirements().commandRequirements);
        } catch (error) {
            expect(error instanceof SfError).to.be.true;
            const sfError = error as SfError;
            expect(sfError.message).to.be.equal(failureMessage);
            expect(sfError.actions?.length).to.be.equal(1);
            expect(sfError.actions?.[0]).to.be.equal(recommendationMessage);
            return;
        }
        throw new Error('Should have failed the requirements');
    });

    it('Skips all checks', async () => {
        const requirements = new FalsyRequirements();
        requirements.commandRequirements.baseRequirements.enabled = false;
        try {
            await RequirementProcessor.execute(requirements.commandRequirements);
        } catch (error: any) {
            throw new Error(`Should have skipped the requirements: ${error}`);
        }
    });
});
