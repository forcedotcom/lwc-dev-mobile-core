/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Logger, Messages, SfdxError } from '@salesforce/core';
import util from 'util';
import { AndroidEnvironmentRequirements } from '../../../../../common/AndroidEnvironmentRequirements';
import { CommandLineUtils, Version } from '../../../../../common/Common';
import { IOSEnvironmentRequirements } from '../../../../../common/IOSEnvironmentRequirements';
import { LoggerSetup } from '../../../../../common/LoggerSetup';
import {
    RequirementProcessor,
    HasRequirements,
    CommandRequirements
} from '../../../../../common/Requirements';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'setup'
);

export class Setup extends SfdxCommand implements HasRequirements {
    private _commandRequirements: CommandRequirements = {};

    public static description = messages.getMessage('commandDescription');

    public static readonly flagsConfig: FlagsConfig = {
        apilevel: flags.string({
            char: 'a',
            description: messages.getMessage('apiLevelFlagDescription'),
            longDescription: messages.getMessage('apiLevelFlagDescription'),
            required: false
        }),
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

    public async run(): Promise<any> {
        await this.init(); // ensure init first

        this.logger.info(`Setup command called for ${this.flags.platform}`);

        return this.validateInputParameters() // validate input
            .then(() => RequirementProcessor.execute(this.commandRequirements)); // verify requirements
    }

    protected async init(): Promise<void> {
        if (this.logger) {
            // already initialized
            return Promise.resolve();
        }

        return super
            .init()
            .then(() => Logger.child('force:lightning:local:setup', {}))
            .then((logger) => {
                this.logger = logger;
                return LoggerSetup.initializePluginLoggers();
            });
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

        if (this.flags.apilevel) {
            if (CommandLineUtils.platformFlagIsIOS(this.flags.platform)) {
                this.logger.warn(
                    'The apiLevel flag does not apply to the iOS platform... ignoring.'
                );
                return Promise.resolve();
            }

            try {
                Version.from(this.flags.apilevel);
            } catch (error) {
                return Promise.reject(
                    new SfdxError(
                        util.format(
                            messages.getMessage(
                                'error:invalidApiLevelFlagsDescription'
                            ),
                            error
                        ),
                        'lwc-dev-mobile-core',
                        this.examples
                    )
                );
            }
        }

        return Promise.resolve();
    }

    public get commandRequirements(): CommandRequirements {
        if (Object.keys(this._commandRequirements).length === 0) {
            const requirements = CommandLineUtils.platformFlagIsAndroid(
                this.flags.platform
            )
                ? new AndroidEnvironmentRequirements(
                      this.logger,
                      this.flags.apilevel
                  )
                : new IOSEnvironmentRequirements(this.logger);

            this._commandRequirements.setup = requirements;
        }

        return this._commandRequirements;
    }
}
