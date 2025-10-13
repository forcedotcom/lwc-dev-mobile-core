/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import { AndroidEnvironmentRequirements } from '../../../../../common/AndroidEnvironmentRequirements.js';
import { BaseCommand } from '../../../../../common/BaseCommand.js';
import { FlagsConfigType } from '../../../../../common/Common.js';
import { CommandLineUtils } from '../../../../../common/CommandLineUtils.js';
import { IOSEnvironmentRequirements } from '../../../../../common/IOSEnvironmentRequirements.js';
import { CommandRequirements, RequirementProcessor } from '../../../../../common/Requirements.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'setup');

export class Setup extends BaseCommand {
    public static readonly summary = messages.getMessage('summary');
    public static readonly examples = messages.getMessages('examples');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    public static readonly flags = {
        ...CommandLineUtils.createFlag(FlagsConfigType.JsonFlag, false),
        ...CommandLineUtils.createFlag(FlagsConfigType.LogLevelFlag, false),
        ...CommandLineUtils.createFlag(FlagsConfigType.ApiLevelFlag, false),
        ...CommandLineUtils.createFlag(FlagsConfigType.PlatformFlag, true)
    };

    protected _commandName = 'force:lightning:local:setup';

    public async run(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.info(`Setup command called for ${this.flagValues.platform}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        return RequirementProcessor.execute(this.commandRequirements, this.flagValues.json);
    }

    protected populateCommandRequirements(): void {
        const requirements: CommandRequirements = {};

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const platform = this.flagValues.platform;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const apiLevel = this.flagValues.apilevel as string | undefined;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        requirements.setup = CommandLineUtils.platformFlagIsAndroid(platform)
            ? new AndroidEnvironmentRequirements(this.logger, apiLevel)
            : new IOSEnvironmentRequirements(this.logger, apiLevel);

        // eslint-disable-next-line no-underscore-dangle
        this.commandRequirements = requirements;
    }
}
