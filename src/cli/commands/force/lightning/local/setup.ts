/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import { AndroidEnvironmentRequirements } from '../../../../../common/AndroidEnvironmentRequirements';
import { BaseCommand } from '../../../../../common/BaseCommand';
import {
    CommandLineUtils,
    FlagsConfigType
} from '../../../../../common/Common';
import { IOSEnvironmentRequirements } from '../../../../../common/IOSEnvironmentRequirements';
import {
    CommandRequirements,
    RequirementProcessor
} from '../../../../../common/Requirements';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'setup'
);

export class Setup extends BaseCommand {
    protected _commandName = 'force:lightning:local:setup';

    public static readonly description =
        messages.getMessage('commandDescription');

    public static readonly examples = [
        `sfdx force:lightning:local:setup -p iOS`,
        `sfdx force:lightning:local:setup -p Android`
    ];

    public static readonly flags = {
        ...CommandLineUtils.createFlag(FlagsConfigType.ApiLevel, false),
        ...CommandLineUtils.createFlag(FlagsConfigType.Platform, true)
    };

    public async run(): Promise<void> {
        this.logger.info(
            `Setup command called for ${this.flagValues.platform}`
        );
        return RequirementProcessor.execute(this.commandRequirements);
    }

    protected populateCommandRequirements(): void {
        const requirements: CommandRequirements = {};

        requirements.setup = CommandLineUtils.platformFlagIsAndroid(
            this.flagValues.platform
        )
            ? new AndroidEnvironmentRequirements(
                  this.logger,
                  this.flagValues.apilevel
              )
            : new IOSEnvironmentRequirements(this.logger);

        this._commandRequirements = requirements;
    }
}
