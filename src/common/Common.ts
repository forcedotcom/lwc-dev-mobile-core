/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError, Logger } from '@salesforce/core';
import util from 'util';
//import { CustomOptions, FlagParserContext, OptionFlag } from '@oclif/core/lib/interfaces/parser';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'common'
);

const LOGGER_NAME = 'force:lightning:local:common';

export class MapUtils {
    /**
     * Enables filtering operation on Map types.
     */
    public static filter<K, V>(
        map: Map<K, V>,
        predicate: (k: K, v: V) => boolean
    ) {
        const aMap = new Map<K, V>();
        if (map == null) {
            return aMap;
        }
        const entries = Array.from(map.entries());
        for (const [key, value] of entries) {
            if (predicate(key, value) === true) {
                aMap.set(key, value);
            }
        }
        return aMap;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class SetUtils {
    /**
     * Enables filtering operation on Set types.
     */
    public static filter<V>(set: Set<V>, predicate: (v: V) => boolean) {
        const aSet = new Set<V>();
        if (set == null) {
            return aSet;
        }
        const entries = Array.from(set.entries());
        for (const [value] of entries) {
            if (predicate(value) === true) {
                aSet.add(value);
            }
        }
        return aSet;
    }
}

export enum FlagsConfigType {
    Platform,
    ApiLevel
}

// tslint:disable-next-line: max-classes-per-file
export class CommandLineUtils {
    public static IOS_FLAG = 'ios';
    public static ANDROID_FLAG = 'android';

    /**
     * Checks to see if a flag is targeting iOS.
     * @param input The input flag.
     * @returns True if flag is targeting iOS.
     */
    public static platformFlagIsIOS(input: string): boolean {
        if (input) {
            return input.toLowerCase() === CommandLineUtils.IOS_FLAG;
        }
        return false;
    }

    /**
     * Checks to see if a flag is targeting Android.
     * @param input The input flag.
     * @returns True if flag is targeting Android.
     */
    public static platformFlagIsAndroid(input: string): boolean {
        if (input) {
            return input.toLowerCase() === CommandLineUtils.ANDROID_FLAG;
        }
        return false;
    }

    /**
     * Checks to see if a platform flag has a valid value.
     * @param platformFlag The platform flag.
     * @returns True if flag is valid (i.e either targeting iOS or Android).
     */
    public static platformFlagIsValid(platformFlag: string) {
        return (
            CommandLineUtils.platformFlagIsIOS(platformFlag) ||
            CommandLineUtils.platformFlagIsAndroid(platformFlag)
        );
    }

    /**
     * Helper method for resolving flag values.
     * @param flag The input flag.
     * @param defaultValue The default value for a flag.
     * @returns If the input flag can be cast to a string that is not undefined/null/empty then
     * the string value will be returned. Otherwise, the provided default value will be returned.
     */
    public static resolveFlag(flag: any, defaultValue: string): string {
        const resolvedFlag = flag as string;
        if (resolvedFlag && resolvedFlag.trim().length > 0) {
            return resolvedFlag;
        } else {
            return defaultValue;
        }
    }

    public static createFlagConfig(
        type: FlagsConfigType,
        isRequired: boolean,
        flagFailureActionMessages: string[]
    ): any {
        switch (type) {
            case FlagsConfigType.ApiLevel:
                return {
                    apilevel: Flags.string({
                        char: 'l',
                        description: messages.getMessage(
                            'apiLevelFlagDescription'
                        ),
                        longDescription: messages.getMessage(
                            'apiLevelFlagDescription'
                        ),
                        required: isRequired,
                        parse: (flag /*, context, options*/) =>
                            CommandLineUtils.commandFlagParser(
                                flag,
                                //context,
                                //options,
                                CommandLineUtils.validateApiLevelFlag,
                                flagFailureActionMessages
                            )
                    })
                };
            case FlagsConfigType.Platform:
                return {
                    platform: Flags.string({
                        char: 'p',
                        description: messages.getMessage(
                            'platformFlagDescription'
                        ),
                        longDescription: messages.getMessage(
                            'platformFlagDescription'
                        ),
                        required: isRequired,
                        parse: (flag /*, context, options*/) =>
                            CommandLineUtils.commandFlagParser(
                                flag,
                                //context,
                                //options,
                                CommandLineUtils.validatePlatformFlag,
                                flagFailureActionMessages
                            )
                    })
                };
        }
    }

    private static commandFlagParser(
        flag: any,
        //context: FlagParserContext,
        //options: CustomOptions & OptionFlag<any, CustomOptions>,
        checkFunction: (input: any) => boolean,
        actionMessages: string[]
    ): Promise<any> {
        return checkFunction(flag)
            ? Promise.resolve(flag)
            : Promise.reject(
                  new SfError(
                      util.format(
                          messages.getMessage('error:invalidFlagValue'),
                          flag
                      ),
                      undefined,
                      actionMessages
                  )
              );
    }

    private static validateApiLevelFlag(flag: string): boolean {
        return Version.from(flag) !== null;
    }

    private static validatePlatformFlag(flag: string): boolean {
        return CommandLineUtils.platformFlagIsValid(flag);
    }
}

// tslint:disable-next-line: max-classes-per-file
export class Version {
    /**
     * Creates a Version object from a string that follows a basic versioning syntax
     * of x[.y[.z]] or x[-y[-z]].
     * @param input A version string that follows the basic syntax of x[.y[.z]] or x[-y[-z]].
     * @returns A Version object from the parsed data, or null if the string does not follow
     * the format.
     */
    public static from(input: string): Version | null {
        // Regex matches any valid value for x[.y[.z]] or x[-y[-z]]. Some examples include:
        // "1.0.0"   - Valid
        // "2-1-2"   - Valid
        // "3.1-4"   - Invalid
        // "4.5"     - Valid
        // "6"       - Valid
        // "7..8"    - Invalid
        // "001.002" - Invalid
        const versionRegex =
            /^(?<Major>0|[1-9]\d*)((?<Separator>[-.])(?<Minor>0|[1-9]\d*))?(\k<Separator>(?<Patch>0|[1-9]\d*))?$/;
        const trimmedInput = input.trim();
        const versionMatch = versionRegex.exec(trimmedInput);
        if (versionMatch === null) {
            this.logger.warn(`'${trimmedInput}' is not valid version format.`);
            return null;
        }

        const major =
            versionMatch.groups?.Major !== undefined
                ? Number.parseInt(versionMatch.groups.Major, 10)
                : 0;
        const minor =
            versionMatch.groups?.Minor !== undefined
                ? Number.parseInt(versionMatch.groups.Minor, 10)
                : 0;
        const patch =
            versionMatch.groups?.Patch !== undefined
                ? Number.parseInt(versionMatch.groups.Patch, 10)
                : 0;

        return new Version(major, minor, patch);
    }

    public readonly major: number;
    public readonly minor: number;
    public readonly patch: number;

    constructor(major: number, minor: number, patch: number) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    /**
     * Verifies that the input version is an exact match.
     * @param inputVersion Input version object.
     * @returns True if the input version is an exact match.
     */
    public same(inputVersion: Version): boolean {
        return this.compare(inputVersion) === 0;
    }

    /**
     * Verifies that the input version is same or newer version.
     * @param inputVersion Input version object.
     * @returns True if the input version is same or newer version.
     */
    public sameOrNewer(inputVersion: Version): boolean {
        return this.compare(inputVersion) > -1;
    }

    /**
     * Compares the version object to an input version and returns a number indicating the comparison result.
     * @param inputVersion Input version object.
     * @returns -1 if input version is newer, 0 if it is the same, and 1 if it is older.
     */
    public compare(another: Version): number {
        const v1 = this.major * 100 + this.minor * 10 + this.patch;
        const v2 = another.major * 100 + another.minor * 10 + another.patch;

        if (v1 === v2) {
            return 0;
        } else if (v1 < v2) {
            return -1;
        } else {
            return 1;
        }
    }

    /**
     * Logging-friendly format is x.y.z.
     * @returns String representation of the version, i.e. x.y.z.
     */
    public toString(): string {
        return `${this.major}.${this.minor}.${this.patch}`;
    }

    private static logger: Logger = new Logger(LOGGER_NAME);
}
