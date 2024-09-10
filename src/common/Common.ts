/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */

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

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

export class CaseInsensitiveStringMap {
    private map = new Map<string, string>();

    // Set a key-value pair, normalizing the key to lowercase
    public set(key: string, value: string): void {
        this.map.set(key.toLowerCase(), value);
    }

    // Get a value by a case-insensitive key
    public get(key: string): string | undefined {
        return this.map.get(key.toLowerCase());
    }

    // Check if the map contains a case-insensitive key
    public has(key: string): boolean {
        return this.map.has(key.toLowerCase());
    }

    // Delete a key-value pair by a case-insensitive key
    public delete(key: string): boolean {
        return this.map.delete(key.toLowerCase());
    }

    /**
     * Takes an input string containing one or more lines of data. The data per line
     * is expected to have the format of <key><separator><value> where <separator> is
     * either : or =
     *
     * It will then parse the input and converts it to a map of keys and values.
     */
    public static fromString(input: string): CaseInsensitiveStringMap {
        const resultMap = new CaseInsensitiveStringMap();
        const lines = input.split(/\r?\n/);

        for (const line of lines) {
            // Find the first occurrence of : or =
            const match = line.match(/[:=]/);
            if (match) {
                const index = match.index!;
                const key = line.slice(0, index).trim(); // Key is the part before the first : or =
                const value = line.slice(index + 1).trim(); // Value is the part after the first : or =
                resultMap.set(key, value);
            }
        }

        return resultMap;
    }
}

export class MapUtils {
    /**
     * Enables filtering operation on Map types.
     */
    public static filter<K, V>(map: Map<K, V>, predicate: (k: K, v: V) => boolean): Map<K, V> {
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

export class SetUtils {
    /**
     * Enables filtering operation on Set types.
     */
    public static filter<V>(set: Set<V>, predicate: (v: V) => boolean): Set<V> {
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

export enum Platform {
    desktop = 'desktop',
    ios = 'ios',
    android = 'android'
}

export enum FlagsConfigType {
    PlatformFlag,
    ApiLevelFlag,
    LogLevelFlag,
    JsonFlag
}

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
    public static resolveFlag(flag: any, defaultValue: string): string {
        const resolvedFlag = flag as string;
        if (resolvedFlag && resolvedFlag.trim().length > 0) {
            return resolvedFlag;
        } else {
            return defaultValue;
        }
    }

    public static createFlag(type: FlagsConfigType, isRequired: boolean, supportsDesktop = false): any {
        switch (type) {
            case FlagsConfigType.ApiLevelFlag:
                return {
                    apilevel: Flags.string({
                        char: 'l',
                        description: messages.getMessage('apiLevelFlagDescription'),
                        required: isRequired,
                        validate: CommandLineUtils.validateApiLevelFlag
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
                        validate: (level: string) => level && (LoggerLevel as any)[level.trim().toUpperCase()]
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
        }
    }

    public static async flagParser(
        input: string | boolean,
        context: Command,
        opts: CustomOptions & OptionFlag<string, CustomOptions>
    ): Promise<any> {
        const validateFunction = opts.validate as (flag: any) => boolean;

        if (validateFunction && !validateFunction(input)) {
            // get the examples array (if any) and reduce it
            // to only keep the string examples
            const examples = (context.constructor as typeof SfCommand).examples?.reduce(
                (results: string[], item: any) => {
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

    private static validateApiLevelFlag(flag: string): boolean {
        return flag.trim().length > 0; // if it doesn't follow semver then we'll automatically consider it as a code name
    }
}

export class Version {
    /**
     * Creates a Version object from a string that follows a basic versioning syntax
     * of x[.y[.z]] or x[-y[-z]].
     *
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
            return null;
        }

        const major = versionMatch.groups?.Major !== undefined ? Number.parseInt(versionMatch.groups.Major, 10) : 0;
        const minor = versionMatch.groups?.Minor !== undefined ? Number.parseInt(versionMatch.groups.Minor, 10) : 0;
        const patch = versionMatch.groups?.Patch !== undefined ? Number.parseInt(versionMatch.groups.Patch, 10) : 0;

        return new Version(major, minor, patch);
    }

    public readonly major: number;
    public readonly minor: number;
    public readonly patch: number;

    public constructor(major: number, minor: number, patch: number) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    /**
     * Compares 2 version objects and returns true if they are the same.
     *
     * @param v1 The first version object (can be of type Version or string)
     * @param v2 The second version object (can be of type Version or string)
     * @returns True if the inputs represent the same version.
     * @throws comparing 2 versions of type string is not supported and an error will be thrown.
     */
    public static same(v1: Version | string, v2: Version | string): boolean {
        return Version.compare(v1, v2) === 0;
    }

    /**
     * Compares 2 version objects and returns true if the first version is same or newer than the second version.
     *
     * @param v1 The first version object (can be of type Version or string)
     * @param v2 The second version object (can be of type Version or string)
     * @returns True if the first version is same or newer than the second version.
     * @throws comparing 2 versions of type string is not supported and an error will be thrown.
     */
    public static sameOrNewer(v1: Version | string, v2: Version | string): boolean {
        return Version.compare(v1, v2) >= 0;
    }

    /**
     * Compares 2 version objects and returns a number indicating the comparison result.
     *
     * @param v1 The first version object (can be of type Version or string)
     * @param v2 The second version object (can be of type Version or string)
     * @returns -1 if first version is older, 0 if it is the same, and 1 if it is newer.
     * @throws comparing 2 versions of type string is not supported and an error will be thrown.
     */
    public static compare(v1: Version | string, v2: Version | string): number {
        const version1 = typeof v1 === 'string' ? Version.from(v1) : v1;
        const version2 = typeof v2 === 'string' ? Version.from(v2) : v2;

        if (version1 === null && version2 === null) {
            // They are both strings that represent codename versions. The only
            // supported scenario is when they both are the same codename, otherwise
            // we don't have a way of knowing which codename is newer than the other.
            if (
                v1.toString().localeCompare(v2.toString(), undefined, {
                    sensitivity: 'accent'
                }) === 0
            ) {
                return 0;
            }
            throw new Error(messages.getMessage('error:version:codename:comparing'));
        } else if (version1 === null) {
            // v1 is a codenamed version and since on Android codenamed versions are always
            // the "bleeding edge" (i.e the latest) then it will always be newer than v2.
            return 1;
        } else if (version2 === null) {
            // same as the above comment, if v2 is a codenamed version then it is
            // the latest and so v1 will always be older.
            return -1;
        } else {
            // they are both semver so convert to number and compare
            const num1 = version1.major * 100 + version1.minor * 10 + version1.patch;
            const num2 = version2.major * 100 + version2.minor * 10 + version2.patch;

            if (num1 === num2) {
                return 0;
            } else if (num1 < num2) {
                return -1;
            } else {
                return 1;
            }
        }
    }

    /**
     * Logging-friendly format is x.y.z.
     *
     * @returns String representation of the version, i.e. x.y.z.
     */
    public toString(): string {
        return `${this.major}.${this.minor}.${this.patch}`;
    }
}
