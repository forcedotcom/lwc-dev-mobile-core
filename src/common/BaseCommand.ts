/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-explicit-any */

/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Logger, LoggerLevel } from '@salesforce/core';
import { CommandLineUtils } from './Common.js';
import { HasRequirements, CommandRequirements } from './Requirements.js';

export abstract class BaseCommand extends SfCommand<any> implements HasRequirements {
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
                return new Logger(this.commandName);
            })
            .then((logger) => {
                // extract the log level flag (if any) and
                // set the logger's level to this value
                const logLevel = this.getLogLevel(this._flagValues.loglevel);
                logger.setLevel(logLevel);
                this._logger = logger;
                return this.populateCommandRequirements();
            });
    }

    // Loops over all of the flags of a command and checks to see
    // if a flag has a `validate` function defined. If so then we
    // mark it to use `CommandLineUtils.flagParser` as a parser,
    // which will execute the validation function.
    private injectFlagParser(): void {
        const flags = (this.constructor as typeof SfCommand).flags;
        const flagEntries = Object.entries(flags);
        flagEntries.forEach((flag) => {
            // Object.entries returns an array of KeyValue pairs where item[0]
            // is key and item[1] is value. In this context flag[1] holds another
            // object which defines the configs for that flag. oclif adds a default
            // parser to flag configs for all flags. This parser just accepts any value
            // that is passed in for that flag without validating anything.
            // Here we check to see if validate is added to the configs for a flag.
            // If so then we override the default parser with our parser which runs
            // the validation check and only accepts the flag value if validation passes.
            const configEntries = Object.entries(flag[1]);
            const hasValidate = configEntries.find((keyValuePair) => keyValuePair[0] === 'validate');
            if (hasValidate) {
                // eslint-disable-next-line @typescript-eslint/unbound-method, no-param-reassign
                flag[1].parse = CommandLineUtils.flagParser;
            }
        });
    }

    private getLogLevel(level?: string): LoggerLevel {
        const normalized = (level ?? '').trim().toLocaleLowerCase();

        switch (normalized) {
            case '10':
            case 'trace':
                return LoggerLevel.TRACE;

            case '20':
            case 'debug':
                return LoggerLevel.DEBUG;

            case '30':
            case 'info':
                return LoggerLevel.INFO;

            case '40':
            case 'warn':
                return LoggerLevel.WARN;

            case '50':
            case 'error':
                return LoggerLevel.ERROR;

            case '60':
            case 'fatal':
                return LoggerLevel.FATAL;

            default:
                return LoggerLevel.WARN;
        }
    }
}
