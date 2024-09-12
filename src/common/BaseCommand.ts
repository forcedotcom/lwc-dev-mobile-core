/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Logger, LoggerLevel } from '@salesforce/core';
import { CommandLineUtils } from './CommandLineUtils.js';
import { HasRequirements, CommandRequirements } from './Requirements.js';

export abstract class BaseCommand extends SfCommand<unknown> implements HasRequirements {
    private cmdName = 'BaseCommand';
    private cmdFlagValues: unknown;
    private cmdLogger!: Logger;
    private cmdRequirements: CommandRequirements = {};

    public get commandName(): string {
        return this.cmdName;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public get flagValues(): any {
        return this.cmdFlagValues;
    }

    public get logger(): Logger {
        return this.cmdLogger;
    }

    public get commandRequirements(): CommandRequirements {
        return this.cmdRequirements;
    }

    public set commandName(value: string) {
        this.cmdName = value;
    }

    public set flagValues(value: unknown) {
        this.cmdFlagValues = value;
    }

    public set logger(value: Logger) {
        this.cmdLogger = value;
    }

    public set commandRequirements(value: CommandRequirements) {
        this.cmdRequirements = value;
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
                this.cmdFlagValues = parserOutput.flags;
                return new Logger(this.commandName);
            })
            .then((logger) => {
                // extract the log level flag (if any) and
                // set the logger's level to this value
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                const logLevel = this.getLogLevel((this.cmdFlagValues as any).loglevel as string | undefined);
                logger.setLevel(logLevel);
                this.cmdLogger = logger;
                return this.populateCommandRequirements();
            });
    }

    // eslint-disable-next-line class-methods-use-this
    protected populateCommandRequirements(): void {
        // override in child classes and update _commandRequirements
        // to include whatever requirements the command has.
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

    // eslint-disable-next-line class-methods-use-this
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
