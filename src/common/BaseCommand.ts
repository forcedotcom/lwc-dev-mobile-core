/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Logger } from '@salesforce/core';
import { CommandLineUtils } from './Common';
import { LoggerSetup } from './LoggerSetup';
import { HasRequirements, CommandRequirements } from './Requirements';

export abstract class BaseCommand
    extends SfCommand<any>
    implements HasRequirements
{
    protected _commandName = 'BaseCommand';
    public get commandName(): string {
        return this._commandName;
    }

    protected _flagValues: any;
    public get flagValues(): any {
        return this._flagValues;
    }

    protected _logger!: Logger;
    public get logger(): Logger {
        return this._logger;
    }

    protected _commandRequirements: CommandRequirements = {};
    public get commandRequirements(): CommandRequirements {
        return this._commandRequirements;
    }

    protected populateCommandRequirements(): void {
        // override in child classes and update _commandRequirements
        // to include whatever requirements the command has.
    }

    public async init(): Promise<void> {
        if (this.logger) {
            // already initialized
            return Promise.resolve();
        }

        this.injectFlagParser();

        return super
            .init()
            .then(() => this.parse())
            .then((parserOutput) => {
                this._flagValues = parserOutput.flags;
                return Logger.child(this.commandName);
            })
            .then((logger) => {
                this._logger = logger;
                return LoggerSetup.initializePluginLoggers();
            })
            .then(() => this.populateCommandRequirements());
    }

    // Loops over all of the flags of a command and checks to see
    // if a flag has a `validate` function defined. If so then we
    // mark it to use `CommandLineUtils.flagParser` as a parser,
    // which will execute the validation function.
    private injectFlagParser() {
        const flags = (<typeof SfCommand>this.constructor).flags;
        const flagEntries = Object.entries(flags);
        flagEntries.forEach((flag) => {
            const configEntries = Object.entries(flag[1]);
            const hasValidate = configEntries.find(
                (keyValuePair) => keyValuePair[0] === 'validate'
            );
            if (hasValidate) {
                flag[1].parse = CommandLineUtils.flagParser;
            }
        });
    }
}
