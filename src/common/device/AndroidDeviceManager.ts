/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import fs from 'node:fs';
import path from 'node:path';
import { Logger } from '@salesforce/core';
import { AndroidUtils } from '../AndroidUtils.js';
import { CaseInsensitiveStringMap, Version } from '../Common.js';
import { CommonUtils } from '../CommonUtils.js';
import { PlatformConfig } from '../PlatformConfig.js';
import { AndroidDevice, AndroidOSType } from './AndroidDevice.js';
import { DeviceType } from './BaseDevice.js';

export class AndroidDeviceManager {
    private logger?: Logger;

    public constructor(logger?: Logger) {
        this.logger = logger;
    }

    /**
     * Runs the command `avdmanager list avd` then parses the output to enumerate a list of available devices.
     * By using `osFilters` you can further filter the types of devices that you would like to be included in the results.
     *
     * @param osFilters Array of `{ osType: string; minOSVersion: Version }` objects which can be used to further
     * filter the results and only include the devices that match the provided filters. Defaults to only include
     * devices running on Google APIs 23 or later.
     *
     * For example, to include various OS types and versions you can provide:
     * ```
     * [
     *   { osType: AndroidOSType.googleAPIs, minOSVersion: new Version(33, 0, 0) }, // Google APIs 33 or newer
     *   { osType: AndroidOSType.googlePlayStore, minOSVersion: new Version(34, 0, 0) }, // Google APIs Play Store 34 or newer
     *   { osType: AndroidOSType.androidWear, minOSVersion: new Version(3, 0, 0) }, // Android Wear 3 or newer
     * ]
     * ```
     *
     * You can also pass in `null` for osFilters in order to skip filtering and include all discovered devices.
     *
     * @returns An array of available devices filtered using the `osFilter` parameter.
     */
    public async enumerateDevices(
        osFilters: Array<{ osType: string; minOSVersion: Version }> | null = [
            {
                osType: AndroidOSType.googleAPIs,
                minOSVersion: Version.from(PlatformConfig.androidConfig().minSupportedRuntime)!
            }
        ]
    ): Promise<AndroidDevice[]> {
        const results = await this.fetchEmulators(osFilters);
        return results;
    }

    public async getDevice(idOrName: string): Promise<AndroidDevice | undefined> {
        const allDevices = await this.enumerateDevices(null);
        const match = allDevices.find((device) => device.id === idOrName || device.name === idOrName);
        return match;
    }

    /**
     * Runs the command `avdmanager list avd` then parses the output to enumerate a list of available devices.
     * By using `osFilters` you can further filter the types of devices that you would like to be included in the results.
     *
     * @param osFilters Array of `{ osType: string; minOSVersion: Version }` objects which can be used to further
     * filter the results and only include the devices that match the provided filters. Defaults to only include
     * devices running on Google APIs 23 or later.
     *
     * For example, to include various OS types and versions you can provide:
     * ```
     * [
     *   { osType: AndroidOSType.googleAPIs, minOSVersion: new Version(33, 0, 0) }, // Google APIs 33 or newer
     *   { osType: AndroidOSType.googlePlayStore, minOSVersion: new Version(34, 0, 0) }, // Google APIs Play Store 34 or newer
     *   { osType: AndroidOSType.androidWear, minOSVersion: new Version(3, 0, 0) }, // Android Wear 3 or newer
     * ]
     * ```
     *
     * You can also pass in `null` for osFilters in order to skip filtering and include all discovered devices.
     *
     * @returns An array of available devices filtered using the `osFilter` parameter.
     */
    private async fetchEmulators(
        osFilters: Array<{ osType: string; minOSVersion: Version }> | null = [
            {
                osType: AndroidOSType.googleAPIs,
                minOSVersion: Version.from(PlatformConfig.androidConfig().minSupportedRuntime)!
            }
        ]
    ): Promise<AndroidDevice[]> {
        let devices: AndroidDevice[] = [];

        try {
            const command = `${AndroidUtils.getAvdManagerCommand()} list avd`;
            const result = await CommonUtils.executeCommandAsync(command, this.logger);
            if (result.stdout && result.stdout.length > 0) {
                devices = this.parseEnumerationRawString(result.stdout);
            } else if (result.stderr && result.stderr.length > 0) {
                this.logger?.warn(result.stderr);
            }
        } catch (error) {
            this.logger?.warn(error);
        }

        // If filtering parameters are provided then filter the results first
        if (osFilters) {
            devices = devices.filter((device) => {
                const matchingOS = osFilters.find((filter) => filter.osType === device.osType);
                try {
                    return matchingOS && Version.sameOrNewer(device.osVersion, matchingOS.minOSVersion);
                } catch {
                    return false;
                }
            });
        }

        return devices;
    }

    /**
     * Attempts to parse the output of `avdmanager list avd` command.
     *
     * @param rawString The string blob that is the output of `avdmanager list avd` command.
     * @returns An array of AndroidDevice objects containing information about the devices.
     */
    // eslint-disable-next-line complexity
    private parseEnumerationRawString(rawString: string): AndroidDevice[] {
        const avds = this.getAvdDefinitions(rawString);
        const results: AndroidDevice[] = [];

        for (const avd of avds) {
            const avdPath = avd.get('Path');
            const configINI = avdPath && path.join(avdPath, 'config.ini');

            // Getting detailed info about an AVD is unfortunately not straight forward. First we need to
            // run `avdmanager list avd` command which prints out _some_ info about the AVDs. The info
            // includes path to the location where the AVD files are.
            //
            // In addition to parsing the output of the `avdmanager list avd` command we will also look into
            // the AVD config files at their specific paths to fetch more detailed info as best as we can.
            const configINIContent =
                configINI && fs.existsSync(configINI)
                    ? CaseInsensitiveStringMap.fromString(fs.readFileSync(configINI, 'utf8'))
                    : undefined;

            // First try to get the ID from the config file. If it is not there then try to get it from
            // the parsed output of `avdmanager` command. But note that the `avdmanager` command prints
            // out the ID as `name` instead.
            const id = (configINIContent?.get('AvdId') ?? avd.get('Name'))?.trim();

            // First try to get the name from the config file. If it is not there then try to get it from
            // the parsed output of `avdmanager` command. The `avdmanager` command prints out the ID as
            // `name` where this ID is generated by replacing blank spaces in a display name with _ and -
            // So we go in reverse and replace _ and - in the ID with blank space to get back the name.
            const name = (configINIContent?.get('avd.ini.displayname') ?? id?.replace(/[_-]/gi, ' '))?.trim();

            const isPlayStore =
                (configINIContent?.get('PlayStore.enabled')?.toLowerCase().trim() ?? 'false') === 'true';

            let targetType = configINIContent?.get('tag.id');
            if (!targetType) {
                targetType = avd.get('Target')?.replace(/\([^)]*\)/g, '');
            }
            targetType = targetType?.replace(/[_-]/gi, ' ')?.toLowerCase()?.trim();

            // To get the API level, we can first take a look at config INI and look for `image.sysdir.1`
            // (eg: image.sysdir.1=system-images/android-34/android-wear/arm64-v8a/)
            //
            // If it's not there then look at the AVD INI and look for `target` (eg: target=android-34).
            let targetAPI = configINIContent?.get('image.sysdir.1')?.replace(/.*(android-\d+).*/i, '$1');
            if (!targetAPI) {
                const avdINI = id && path.join(path.dirname(avdPath ?? ''), id + '.ini');
                if (avdINI && fs.existsSync(avdINI)) {
                    const avdINIContent = CaseInsensitiveStringMap.fromString(fs.readFileSync(avdINI, 'utf8'));
                    targetAPI = avdINIContent.get('target');
                }
            }
            targetAPI = targetAPI?.replace(/android-/i, '')?.trim();

            // Include this AVD only if we were able to determine all of the details that we need.
            if (id && name && targetType && targetAPI) {
                const apiVersion = Version.from(targetAPI);

                let deviceType = DeviceType.unknown;
                switch (targetType) {
                    case AndroidOSType.googleAPIs.valueOf():
                    case AndroidOSType.googlePlayStore.valueOf():
                        deviceType = DeviceType.mobile;
                        break;
                    case AndroidOSType.googleTV.valueOf():
                        deviceType = DeviceType.tv;
                        break;
                    case AndroidOSType.androidWear.valueOf():
                        deviceType = DeviceType.watch;
                        break;
                    case AndroidOSType.androidAutomotive.valueOf():
                        deviceType = DeviceType.automotive;
                        break;
                }

                results.push(new AndroidDevice(id, name, deviceType, targetType, apiVersion ?? targetAPI, isPlayStore));
            }
        }

        return results;
    }

    /*
        When we run 'avdmanager list avd' its output has the following format:

        Available Android Virtual Devices:
            <device definition>
        ---------
            <device definition>
        ---------
            <device definition>

        The following Android Virtual Devices could not be loaded:
            <device error info>
        ---------
            <device error info>
        ---------
            <device error info>

        This method parses the output and break it up into device info chunks.
    */
    // eslint-disable-next-line class-methods-use-this
    private getAvdDefinitions(rawString: string): CaseInsensitiveStringMap[] {
        const input = rawString.replace(
            '\n\nThe following Android Virtual Devices could not be loaded:',
            '\n---------'
        );
        const lines = input.trim().split('\n').slice(1); // skip the first line which is superficial line not containing any AVD data
        const separatorPattern = /^-+$/; // Regex to match separator lines with 2 or more dashes
        const chunks: string[] = []; // Array to hold the chunks
        let currentChunk = ''; // Temp string to accumulate data before a separator

        for (const line of lines) {
            if (separatorPattern.test(line.trim())) {
                // If a separator line is found, push the current chunk to result
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                // Reset the current chunk for the next block
                currentChunk = '';
            } else {
                // Add the current line to the current chunk
                currentChunk += line + '\n';
            }
        }

        // Push the last chunk if it has content
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        const results = chunks.map((chunk) => CaseInsensitiveStringMap.fromString(chunk));
        return results;
    }
}
