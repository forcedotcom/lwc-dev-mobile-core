/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Logger, Messages, SfdxError } from '@salesforce/core';
import util from 'util';
import { AndroidEnvironmentSetup } from '../../../../../common/AndroidEnvironmentSetup';
import { CommandLineUtils } from '../../../../../common/Common';
import { IOSEnvironmentSetup } from '../../../../../common/IOSEnvironmentSetup';
import { LoggerSetup } from '../../../../../common/LoggerSetup';
import {
    BaseSetup,
    Requirement,
    SetupTestResult
} from '../../../../../common/Requirements';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'setup'
);

export class Setup extends SfdxCommand {
    public static description = messages.getMessage('commandDescription');

    public static readonly flagsConfig: FlagsConfig = {
        platform: flags.string({
            char: 'p',
            description: messages.getMessage('platformFlagDescription'),
            longDescription: messages.getMessage('platformFlagDescription'),
            required: true
        })
    };

    public examples = [
        `sfdx force:lightning:local:setup -p iOS`,
        `sfdx force:lightning:local:setup -p Android`
    ];

    public skipBaseRequirements = false;
    public skipAdditionalRequirements = false;

    private setupSteps: BaseSetup | undefined;

    public async run(): Promise<any> {
        return this.init() // ensure init first
            .then(() => {
                this.logger.info(
                    `Setup command called for ${this.flags.platform}`
                );
                return this.validateInputParameters(); // validate input
            })
            .then(() => this.executeSetup(this.setup())) // verify requirements
            .then((result) => {
                if (!result.hasMetAllRequirements) {
                    return Promise.reject(
                        new SfdxError(
                            util.format(
                                messages.getMessage('error:setupFailed'),
                                this.flags.platform
                            ),
                            'lwc-dev-mobile-core',
                            [
                                messages.getMessage(
                                    'error:setupFailed:recommendation'
                                )
                            ]
                        )
                    );
                } else {
                    return Promise.resolve(result);
                }
            });
    }

    protected async init(): Promise<void> {
        if (this.logger) {
            // already initialized
            return Promise.resolve();
        }

        return super
            .init()
            .then(() => Logger.child('mobile:setup', {}))
            .then((logger) => {
                this.logger = logger;
                return LoggerSetup.initializePluginLoggers();
            });
    }

    protected addAdditionalRequirements(reqs: Requirement[]) {
        this.setup().addAdditionalRequirements(reqs);
    }

    protected async validateInputParameters(): Promise<void> {
        if (!CommandLineUtils.platformFlagIsValid(this.flags.platform)) {
            return Promise.reject(
                new SfdxError(
                    messages.getMessage('error:invalidInputFlagsDescription'),
                    'lwc-dev-mobile-core',
                    this.examples
                )
            );
        }

        return Promise.resolve();
    }

    private async executeSetup(setup: BaseSetup): Promise<SetupTestResult> {
        setup.skipBaseRequirements = this.skipBaseRequirements;
        setup.skipAdditionalRequirements = this.skipAdditionalRequirements;
        return setup.executeSetup();
    }

    private setup(): BaseSetup {
        if (!this.setupSteps) {
            this.setupSteps = CommandLineUtils.platformFlagIsAndroid(
                this.flags.platform
            )
                ? new AndroidEnvironmentSetup(this.logger)
                : new IOSEnvironmentSetup(this.logger);
        }

        return this.setupSteps;
    }
}
