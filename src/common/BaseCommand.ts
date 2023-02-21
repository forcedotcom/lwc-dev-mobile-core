/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Logger } from '@salesforce/core';
import { LoggerSetup } from './LoggerSetup';
import { HasRequirements, CommandRequirements } from './Requirements';

export abstract class BaseCommand
    extends SfCommand<any>
    implements HasRequirements
{
    protected commandName = 'BaseCommand';
    protected flagValues: any;
    protected logger!: Logger;

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

        return super
            .init()
            .then(() => this.parse())
            .then((parserOutput) => {
                this.flagValues = parserOutput.flags;
                return Logger.child(this.commandName);
            })
            .then((logger) => {
                this.logger = logger;
                return LoggerSetup.initializePluginLoggers();
            })
            .then(() => this.populateCommandRequirements());
    }
}
