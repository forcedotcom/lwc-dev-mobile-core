/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Logger, Messages, SfdxError } from '@salesforce/core';
import { AndroidEnvironmentRequirements } from '../../../../../common/AndroidEnvironmentRequirements';
import {
    CommandLineUtils,
    FlagsConfigType
} from '../../../../../common/Common';
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
    public static description = messages.getMessage('commandDescription');

    public static readonly flagsConfig: FlagsConfig = {
        ...CommandLineUtils.createFlagConfig(FlagsConfigType.ApiLevel, false),
        ...CommandLineUtils.createFlagConfig(FlagsConfigType.Platform, true)
    };

    public examples = [
        `sfdx force:lightning:local:setup -p iOS`,
        `sfdx force:lightning:local:setup -p Android`
    ];

    public async run(): Promise<any> {
        this.logger.info(`Setup command called for ${this.flags.platform}`);
        return RequirementProcessor.execute(this.commandRequirements);
    }

    public async init(): Promise<void> {
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

    private _commandRequirements: CommandRequirements = {};
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
