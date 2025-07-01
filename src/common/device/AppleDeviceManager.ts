/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { Logger, SfError } from '@salesforce/core';
import { Version } from '../Common.js';
import { CommonUtils } from '../CommonUtils.js';
import { PlatformConfig } from '../PlatformConfig.js';
import { AppleDevice, AppleOSType, AppleRuntime } from './AppleDevice.js';
import { DeviceType } from './BaseDevice.js';

export class AppleDeviceManager {
    private logger?: Logger;

    public constructor(logger?: Logger) {
        this.logger = logger;
    }

    /**
     * Runs the command `xcrun simctl list devices available --json` then parses the output to enumerate
     * a list of available devices. By using `osFilters` you can further filter the types of devices that
     * you would like to be included in the results.
     *
     * @param osFilters Array of `{ osType: string; minOSVersion: Version }` objects which can be used to further
     * filter the results and only include the devices that match the provided filters. Defaults to only include
     * devices running on iOS 13.0.0 or later.
     *
     * For example, to include various OS types and versions you can provide:
     * ```
     * [
     *   { osType: AppleOSType.iOS, minOSVersion: new Version(12, 0, 0) }, // iOS 12 or newer
     *   { osType: AppleOSType.watchOS, minOSVersion: new Version(10, 5, 0) }, // watchOS 10.5 or newer
     *   { osType: AppleOSType.tvOS, minOSVersion: new Version(17, 5, 0) }, // tvOS 17.5 or newer
     * ]
     * ```
     *
     * You can also pass in `null` for osFilters in order to skip filtering and include all discovered devices.
     *
     * @returns An array of available devices filtered using the `osFilter` parameter.
     */
    public async enumerateDevices(
        osFilters: Array<{ osType: string; minOSVersion: Version }> | null = [
            { osType: AppleOSType.iOS, minOSVersion: Version.from(PlatformConfig.iOSConfig().minSupportedRuntime)! }
        ]
    ): Promise<AppleDevice[]> {
        try {
            const availableSimulatorRuntimes = await this.enumerateRuntimes(osFilters);
            const command = '/usr/bin/xcrun simctl list devices available --json';
            const result = await CommonUtils.executeCommandAsync(command, this.logger);
            if (result.stdout && result.stdout.length > 0) {
                const devices = this.parseEnumerationJSONString(result.stdout, availableSimulatorRuntimes);
                return devices;
            } else if (result.stderr && result.stderr.length > 0) {
                this.logger?.warn(result.stderr);
            }
        } catch (error) {
            this.logger?.warn(error);
        }
        return [];
    }

    /**
     * Runs the command `xcrun simctl list runtimes available --json` then parses the output to enumerate
     * a list of available runtimes. By using `osFilters` you can further filter the types of runtimes that
     * you would like to be included in the results.
     *
     * @param osFilters Array of `{ osType: string; minOSVersion: Version }` objects which can be used to further
     * filter the results and only include the runtimes that match the provided filters. Defaults to only include
     * devices running on iOS 13.0.0 or later.
     *
     * For example, to include various OS types and versions you can provide:
     * ```
     * [
     *   { osType: AppleOSType.iOS, minOSVersion: new Version(12, 0, 0) }, // iOS 12 and newer
     *   { osType: AppleOSType.watchOS, minOSVersion: new Version(10, 5, 0) }, // watchOS 10.5 and newer
     *   { osType: AppleOSType.tvOS, minOSVersion: new Version(17, 5, 0) }, // tvOS 17.5 and newer
     * ]
     * ```
     *
     * You can also pass in `null` for osFilters in order to skip filtering and include all discovered devices.
     *
     * @returns An array of available runtimes filtered using the `osFilter` parameter.
     */
    public async enumerateRuntimes(
        osFilters: Array<{ osType: string; minOSVersion: Version }> | null = [
            { osType: AppleOSType.iOS, minOSVersion: Version.from(PlatformConfig.iOSConfig().minSupportedRuntime)! }
        ]
    ): Promise<AppleRuntime[]> {
        const runtimesCmd = '/usr/bin/xcrun simctl list runtimes available --json';
        const result = await CommonUtils.executeCommandAsync(runtimesCmd, this.logger);
        const { runtimes } = JSON.parse(result.stdout) as { runtimes: AppleRuntime[] };

        let finalResults = runtimes ?? [];

        // If filtering parameters are provided then filter the results first
        if (osFilters) {
            finalResults = finalResults.filter((runtime) => {
                const runtimeVersion = Version.from(runtime.version);
                if (runtimeVersion === null) {
                    // We haven't hit a use case where Apple does unconventional version
                    // specifications like Google will do with their codename "versions".
                    // So for now, this is a 'miss' on the iOS side. Prove me wrong, Apple!
                    this.logger?.warn(
                        `enumerateRuntimes - ${runtime.version} is not a supported version format for ${runtime.identifier}`
                    );
                    return false;
                }

                const matchingOs = osFilters.find((filter) => filter.osType === runtime.platform);

                try {
                    return matchingOs && Version.sameOrNewer(runtimeVersion, matchingOs.minOSVersion);
                } catch {
                    return false;
                }
            });
        }

        // generate runtimeName and typeName from identifier
        finalResults.forEach((runtime) => {
            runtime.runtimeName = runtime.identifier?.split('.')?.pop() ?? runtime.identifier;
            runtime.supportedDeviceTypes.forEach((deviceType) => {
                deviceType.typeName = deviceType.identifier?.split('.')?.pop() ?? deviceType.identifier;
            });
        });

        if (finalResults.length > 0) {
            return finalResults;
        } else {
            throw new SfError(`The command '${runtimesCmd}' could not find any supported runtimes.`);
        }
    }

    public async getDevice(idOrName: string): Promise<AppleDevice | undefined> {
        const allDevices = await this.enumerateDevices(null);
        const match = allDevices.find((device) => device.id === idOrName || device.name === idOrName);
        return match;
    }

    /**
     * Attempts to parse the output of `xcrun simctl list devices available --json` command which enumerates the list
     * of available devices.
     *
     * @param jsonString The JSON string blob that is the output of `xcrun simctl list devices available --json` command.
     * @param runtimeDefinitions Array of supported runtime definitions. Devices whose runtime is not included in this array will not be included in the result.
     * @returns An array of AppleDevice objects containing information about the devices.
     */
    private parseEnumerationJSONString(jsonString: string, runtimeDefinitions: AppleRuntime[]): AppleDevice[] {
        const { devices } = JSON.parse(jsonString) as { devices: object };
        const entries = devices ? Object.entries(devices) : [];
        const results: AppleDevice[] = [];

        for (const entry of entries) {
            const runtimeId = entry[0];
            const runtimeDefinition = runtimeDefinitions.find((def) => def.identifier === runtimeId);
            if (runtimeDefinition) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const runtimeDevices = entry[1] as any[];
                for (const runtimeDevice of runtimeDevices) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const id = runtimeDevice.udid as string;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const name = runtimeDevice.name as string;

                    const osType = runtimeDefinition.platform;

                    let deviceType = DeviceType.unknown;
                    switch (osType) {
                        case AppleOSType.iOS.valueOf():
                            deviceType = DeviceType.mobile;
                            break;
                        case AppleOSType.tvOS.valueOf():
                            deviceType = DeviceType.tv;
                            break;
                        case AppleOSType.watchOS.valueOf():
                            deviceType = DeviceType.watch;
                            break;
                        case AppleOSType.xrOS.valueOf():
                            deviceType = DeviceType.vr;
                            break;
                    }

                    const osVersion = Version.from(runtimeDefinition.version);

                    if (id && name && osVersion) {
                        results.push(new AppleDevice(id, name, deviceType, osType, osVersion, this.logger));
                    }
                }
            }
        }

        // Sort by name in ascending order and then by os version in descending order. This way
        // if our CLI commands are launched using a device name which is not unique (eg. iPhone 11)
        // rather than device id which is unique, then among the devices with the same name we will
        // end up choosing the one with the newer version os b/c it will appear first in this list.
        return results.sort((a, b) =>
            a.name === b.name ? Version.compare(a.osVersion, b.osVersion) : a.name < b.name ? -1 : 1
        );
    }
}
