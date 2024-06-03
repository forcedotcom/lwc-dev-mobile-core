/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import { AndroidEnvironmentRequirements } from '../../../../../common/AndroidEnvironmentRequirements.js';
import { BaseCommand } from '../../../../../common/BaseCommand.js';
import { CommandLineUtils, FlagsConfigType } from '../../../../../common/Common.js';
import { IOSEnvironmentRequirements } from '../../../../../common/IOSEnvironmentRequirements.js';
import { CommandRequirements, RequirementProcessor } from '../../../../../common/Requirements.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'setup');

export class Setup extends BaseCommand {
    public static readonly summary = messages.getMessage('summary');
    public static readonly examples = messages.getMessages('examples');

    public static readonly flags = {
        ...CommandLineUtils.createFlag(FlagsConfigType.Json, false),
        ...CommandLineUtils.createFlag(FlagsConfigType.LogLevel, false),
        ...CommandLineUtils.createFlag(FlagsConfigType.ApiLevel, false),
        ...CommandLineUtils.createFlag(FlagsConfigType.PlatformType, true)
    };

    protected _commandName = 'force:lightning:local:setup';

    public async run(): Promise<void> {
        this.logger.info(`Setup command called for ${this.flagValues.platform}`);
        return RequirementProcessor.execute(this.commandRequirements);
    }

    protected populateCommandRequirements(): void {
        const requirements: CommandRequirements = {};

        requirements.setup = CommandLineUtils.platformFlagIsAndroid(this.flagValues.platform)
            ? new AndroidEnvironmentRequirements(this.logger, this.flagValues.apilevel)
            : new IOSEnvironmentRequirements(this.logger);

        // eslint-disable-next-line no-underscore-dangle
        this._commandRequirements = requirements;
    }
}
