/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { LoggerLevel, Messages, SfError } from '@salesforce/core';
import { Command } from '@oclif/core';
import { CustomOptions, OptionFlag } from '@oclif/core/interfaces';
import { FlagsConfigType, OutputFormat, Platform } from './Common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

export class CommandLineUtils {
    /**
     * Checks to see if a flag is targeting iOS.
     *
     * @param input The input flag.
     * @returns True if flag is targeting iOS.
     */
    public static platformFlagIsIOS(input: Platform | string): boolean {
        return (input ?? '').trim().toLowerCase() === (Platform.ios as string);
    }

    /**
     * Checks to see if a flag is targeting Android.
     *
     * @param input The input flag.
     * @returns True if flag is targeting Android.
     */
    public static platformFlagIsAndroid(input: string): boolean {
        return (input ?? '').trim().toLowerCase() === (Platform.android as string);
    }

    /**
     * Checks to see if a flag is targeting Desktop.
     *
     * @param input The input flag.
     * @returns True if flag is targeting Desktop.
     */
    public static platformFlagIsDesktop(input: string): boolean {
        return (input ?? '').trim().toLowerCase() === (Platform.desktop as string);
    }

    /**
     * Helper method for resolving flag values.
     *
     * @param flag The input flag.
     * @param defaultValue The default value for a flag.
     * @returns If the input flag can be cast to a string that is not undefined/null/empty then
     * the string value will be returned. Otherwise, the provided default value will be returned.
     */
    public static resolveFlag(flag: string | undefined, defaultValue: string): string {
        return flag?.trim() ?? defaultValue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static createFlag(type: FlagsConfigType, isRequired: boolean, supportsDesktop = false): any {
        switch (type) {
            case FlagsConfigType.ApiLevelFlag:
                return {
                    apilevel: Flags.string({
                        char: 'l',
                        description: messages.getMessage('apiLevelFlagDescription'),
                        required: isRequired,
                        validate: (level: string) => CommandLineUtils.validateApiLevelFlag(level)
                    })
                };
            case FlagsConfigType.PlatformFlag:
                return {
                    platform: Flags.option({
                        char: 'p',
                        description: messages.getMessage('platformFlagDescription'),
                        required: true,
                        options: supportsDesktop
                            ? ([Platform.desktop, Platform.ios, Platform.android] as const)
                            : ([Platform.ios, Platform.android] as const)
                    })({ required: isRequired })
                };
            case FlagsConfigType.LogLevelFlag:
                return {
                    loglevel: Flags.string({
                        description: messages.getMessage('logLevelFlagDescription'),
                        required: false,
                        default: LoggerLevel[LoggerLevel.WARN],
                        validate: (level: string) => CommandLineUtils.validateLogLevelFlag(level) // (LoggerLevel as any)[(level ?? '').trim().toUpperCase()]
                    })
                };
            case FlagsConfigType.JsonFlag:
                return {
                    json: Flags.boolean({
                        description: messages.getMessage('jsonFlagDescription'),
                        required: false,
                        default: false
                    })
                };
            case FlagsConfigType.OutputFormatFlag:
                return {
                    outputFormat: Flags.option({
                        char: 'f',
                        description: messages.getMessage('outputFormatFlagDescription'),
                        options: [OutputFormat.cli, OutputFormat.api] as const,
                        default: OutputFormat.cli
                    })({ required: isRequired })
                };
        }
    }

    public static async flagParser(
        input: string | boolean,
        context: Command,
        opts: CustomOptions & OptionFlag<string, CustomOptions>
    ): Promise<unknown> {
        const validateFunction = opts.validate as (flag: unknown) => boolean;

        if (validateFunction && !validateFunction(input)) {
            // get the examples array (if any) and reduce it
            // to only keep the string examples
            const examples = (context.constructor as typeof SfCommand).examples?.reduce(
                (results: string[], item: unknown) => {
                    if (typeof item === 'string') {
                        results.push(item.toString());
                    }
                    return results;
                },
                []
            );

            return Promise.reject(
                new SfError(messages.getMessage('error:invalidFlagValue', [input]), undefined, examples)
            );
        }

        return Promise.resolve(input);
    }

    private static validateApiLevelFlag(flagValue: string): boolean {
        return flagValue.trim().length > 0; // if it doesn't follow semver then we'll automatically consider it as a code name
    }

    private static validateLogLevelFlag(flagValue: string): boolean {
        const level = (flagValue ?? '').trim().toUpperCase();

        return (
            level === 'TRACE' ||
            level === '10' ||
            level === 'DEBUG' ||
            level === '20' ||
            level === 'INFO' ||
            level === '30' ||
            level === 'WARN' ||
            level === '40' ||
            level === 'ERROR' ||
            level === '50' ||
            level === 'FATAL' ||
            level === '60'
        );
    }
}
