/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { flags, FlagsConfig } from '@salesforce/command';
import { Messages, SfdxError, Logger } from '@salesforce/core';
import { OutputFlags } from '@oclif/parser';
import util from 'util';

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
        if (resolvedFlag && resolvedFlag.length > 0) {
            return resolvedFlag;
        } else {
            return defaultValue;
        }
    }

    public static get apiLevelFlagConfig() {
        const flagsConfig: FlagsConfig = {
            apilevel: flags.string({
                char: 'a',
                description: messages.getMessage('apiLevelFlagDescription'),
                longDescription: messages.getMessage('apiLevelFlagDescription'),
                required: false
            })
        };
        return flagsConfig;
    }

    public static validateApiLevelFlag(
        commandFlags: OutputFlags<any>,
        recommendations: string[]
    ): Promise<void> {
        if (commandFlags.apilevel) {
            if (CommandLineUtils.platformFlagIsIOS(commandFlags.platform)) {
                CommandLineUtils.logger.warn(
                    'The apiLevel flag does not apply to the iOS platform... ignoring.'
                );
                return Promise.resolve();
            }

            try {
                Version.from(commandFlags.apilevel);
            } catch (error) {
                return Promise.reject(
                    new SfdxError(
                        util.format(
                            messages.getMessage(
                                'error:invalidApiLevelFlagsDescription'
                            ),
                            error
                        ),
                        'lwc-dev-mobile-core',
                        recommendations
                    )
                );
            }
        }

        return Promise.resolve();
    }

    public static get platformFlagConfig() {
        const flagsConfig: FlagsConfig = {
            platform: flags.string({
                char: 'p',
                description: messages.getMessage('platformFlagDescription'),
                longDescription: messages.getMessage('platformFlagDescription'),
                required: true
            })
        };
        return flagsConfig;
    }

    public static validatePlatformFlag(
        commandFlags: OutputFlags<any>,
        recommendations: string[]
    ): Promise<void> {
        if (!CommandLineUtils.platformFlagIsValid(commandFlags.platform)) {
            return Promise.reject(
                new SfdxError(
                    messages.getMessage('error:invalidInputFlagsDescription'),
                    'lwc-dev-mobile-core',
                    recommendations
                )
            );
        }

        return Promise.resolve();
    }

    private static logger: Logger = new Logger(LOGGER_NAME);
}

// tslint:disable-next-line: max-classes-per-file
export class Version {
    /**
     * Creates a Version object that follows semantic versioning syntax.
     * @param input A version string that follows semantic versioning syntax.
     * @returns A Version object that follows semantic versioning syntax: major.minor.patch
     */
    public static from(input: string): Version {
        const acceptedRange = /[0-9\-\.]+/g;
        const original = input.trim().toLowerCase();
        const invalidChars = original.replace(acceptedRange, '');
        if (invalidChars.length > 0) {
            throw new Error(`Invalid version string: ${input}`);
        }

        // support version strings using - or . as separators (e.g 13-0-4 and 13.0.4)
        const parts = original.replace(/-/gi, '.').split('.');
        const major = parts.length >= 1 ? Number.parseInt(parts[0], 10) : 0;
        const minor = parts.length >= 2 ? Number.parseInt(parts[1], 10) : 0;
        const patch = parts.length >= 3 ? Number.parseInt(parts[2], 10) : 0;

        // this shouldn't really happen now, but just in case
        if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
            throw new Error(`Invalid version string: ${input}`);
        }

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
}
