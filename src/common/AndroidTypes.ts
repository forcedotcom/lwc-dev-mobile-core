/* eslint-disable @typescript-eslint/member-ordering */

/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import fs from 'node:fs';
import { Logger } from '@salesforce/core';
import { Version } from './Common.js';

export class AndroidPackages {
    /**
     * Attempts to parse the output of `sdkmanager --list` command.
     *
     * @param rawStringInput The string blob that is the output of `sdkmanager --list` command.
     * @returns An AndroidPackages object containing an array of platforms and system images.
     */
    public static parseRawPackagesString(rawStringInput: string, logger?: Logger): AndroidPackages {
        const startIndx = rawStringInput.toLowerCase().indexOf('installed packages:', 0);
        const endIndx = rawStringInput.toLowerCase().indexOf('available packages:', startIndx);
        const rawString = rawStringInput.substring(startIndx, endIndx);
        const packages: AndroidPackages = new AndroidPackages();

        // Installed packages:
        const lines = rawString.split('\n');
        if (lines.length > 0) {
            let i = 0;
            for (; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes('path')) {
                    i = i + 2; // skip ---- and header
                    break; // start of installed packages
                }
            }

            for (; i < lines.length; i++) {
                const rawStringSplits: string[] = lines[i].split('|');
                if (rawStringSplits.length > 1) {
                    const path = rawStringSplits[0].trim();
                    if (path.startsWith('platforms;android-') || path.startsWith('system-images;android-')) {
                        const pathName = path.replace('platforms;', '').replace('system-images;', '');
                        let versionString = pathName.replace('android-', '');
                        if (versionString.includes(';')) {
                            versionString = versionString.substring(0, versionString.indexOf(';'));
                        }
                        let version: Version | string | null = Version.from(versionString);
                        if (version === null) {
                            logger?.warn(
                                `parseRawPackagesString(): '${versionString}' does not follow semantic versioning format... will consider it as a codename.`
                            );
                            version = versionString;
                        }
                        const description = rawStringSplits[2].trim();
                        const locationOfPack = rawStringSplits.length > 2 ? rawStringSplits[3].trim() : '';
                        const pkg = new AndroidPackage(pathName, version, description, locationOfPack);
                        if (path.startsWith('platforms;android-')) {
                            packages.platforms.push(pkg);
                        } else {
                            packages.systemImages.push(pkg);
                        }
                    }
                }

                if (lines[i].includes('Available Packages:')) {
                    break;
                }
            }
        }
        return packages;
    }

    /**
     * Checks to see if the object is empty (i.e the platforms and system images are both empty)
     *
     * @returns True if empty, false otherwise.
     */
    public isEmpty(): boolean {
        return this.platforms.length < 1 && this.systemImages.length < 1;
    }

    /**
     * Creates a readable string of AndroidPackage object data.
     *
     * @param packageArray The array of package objects to render.
     * @returns A readable string of package object data.
     */
    public static packageArrayAsString(packageArray: AndroidPackage[]): string {
        let packagesString = '';
        for (const androidPackage of packageArray) {
            packagesString += `${androidPackage.toString()}\n`;
        }
        return packagesString;
    }

    /**
     * A string representation of the different package data.
     *
     * @returns The string containing the Android package data.
     */
    public toString(): string {
        let retString = 'platforms:\n';
        retString += AndroidPackages.packageArrayAsString(this.platforms);
        retString += 'system images:\n';
        retString += AndroidPackages.packageArrayAsString(this.systemImages);
        return retString;
    }

    public platforms: AndroidPackage[] = [];
    public systemImages: AndroidPackage[] = [];
}

export class AndroidPackage {
    public get platformAPI(): string {
        const tokens: string[] = this.path.split(';');
        return tokens.length > 0 ? tokens[0] : '';
    }

    public get platformEmulatorImage(): string {
        const tokens: string[] = this.path.split(';');
        return tokens.length > 1 ? tokens[1] : '';
    }

    public get abi(): string {
        const tokens: string[] = this.path.split(';');
        return tokens.length > 2 ? tokens[2] : '';
    }

    public path: string;
    public version: Version | string;
    public description: string;
    public location: string;

    public constructor(path: string, version: Version | string, description: string, location: string) {
        this.path = path;
        this.version = version;
        this.description = description;
        this.location = location;
    }

    /**
     * A log-readable string of the AndroidPackage data.
     *
     * @returns A readable string of the AndroidPackage data.
     */
    public toString(): string {
        return `path: ${this.path}, version: ${this.version.toString()}, description: ${this.description}, location: ${
            this.location
        }`;
    }
}

export class AndroidVirtualDevice {
    /**
     * Attempts to parse the output of `avdmanager list avd` command.
     *
     * @param rawStringInput The string blob that is the output of `avdmanager list avd` command.
     * @returns An array of AndroidVirtualDevice objects containing information about each AVD.
     */
    public static parseRawString(rawString: string, logger?: Logger): AndroidVirtualDevice[] {
        const avds = AndroidVirtualDevice.getAvdDefinitions(rawString);
        const devices: AndroidVirtualDevice[] = [];

        for (const avd of avds) {
            const name = AndroidVirtualDevice.getValueForKey(avd, 'name:');
            const device = AndroidVirtualDevice.getValueForKey(avd, 'device:');
            const path = AndroidVirtualDevice.getValueForKey(avd, 'path:');
            const target = AndroidVirtualDevice.getValueForKey(avd, 'target:');
            const api = AndroidVirtualDevice.getValueForKey(avd, 'based on:');

            if (name && device && path && target && api) {
                const filePath = path.replace(`${name}.avd`, `${name}.ini`);
                let apiLevel: Version | string | null = null;
                try {
                    const configFile = fs.readFileSync(filePath, 'utf8');
                    const targetAPI = configFile
                        .split('\n')
                        .filter((entry) => entry.startsWith('target='))
                        .map((entry) => entry.replace('target=', '').trim().toLowerCase())
                        .map((entry) => entry.replace('android-', ''));
                    apiLevel = Version.from(targetAPI[0]);
                    if (apiLevel === null) {
                        logger?.warn(
                            `parseRawString(): '${targetAPI[0]}' does not follow semantic versioning format... will consider it as a codename.`
                        );
                        apiLevel = targetAPI[0];
                    }
                } catch (error) {
                    // fetching apiLevel is a best effort, so ignore and continue
                }

                devices.push(new AndroidVirtualDevice(name, device, path, target, api, apiLevel!));
            }
        }

        return devices;
    }

    /*
        When we run 'avdmanager list avd' it returns the results (along with any errors)
        as raw string in the following format:

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

        In the following method, we parse the raw string result and break it up into
        <device definition> chunks, and skip the <device error info> sections
    */
    private static getAvdDefinitions(rawString: string): string[][] {
        // get rid of the error sections (if any)
        const errIdx = rawString.indexOf('\n\n');
        const cleanedRawString = errIdx > 0 ? rawString.substring(0, errIdx - 1) : rawString;

        const lowerCasedRawString = cleanedRawString.toLowerCase();
        let position = 0;
        const results: string[][] = [];

        // now parse the device definition sections
        while (position !== -1) {
            const startIdx = lowerCasedRawString.indexOf('name:', position);
            let endIdx = -1;

            if (startIdx > -1) {
                const sepIdx = lowerCasedRawString.indexOf('---', startIdx);
                endIdx = sepIdx > -1 ? sepIdx - 1 : -1;

                let chunk =
                    endIdx > -1 ? cleanedRawString.substring(startIdx, endIdx) : cleanedRawString.substring(startIdx);
                chunk = chunk.replace('Tag/ABI:', '\nTag/ABI:'); // put ABI info on a line of its own
                const split = chunk.split('\n');
                results.push(split);
            }

            position = endIdx;
        }

        return results;
    }

    private static getValueForKey(array: string[], key: string): string | null {
        for (const item of array) {
            const trimmed = item.trim();

            if (trimmed.toLowerCase().startsWith(key.toLowerCase())) {
                const value = trimmed.substring(key.length + 1).trim(); // key.length + 1 to skip over ':' separator
                return value;
            }
        }
        return null;
    }

    public name: string;
    public displayName: string;
    public deviceName: string;
    public path: string;
    public target: string;
    public api: string;
    public apiLevel: Version | string;

    public constructor(
        name: string,
        deviceName: string,
        path: string,
        target: string,
        api: string,
        apiLevel: Version | string
    ) {
        this.name = name;
        this.displayName = name.replace(/[_-]/gi, ' ').trim(); // eg. Pixel_XL --> Pixel XL, tv-emulator --> tv emulator
        // eslint-disable-next-line no-useless-escape
        this.deviceName = deviceName.replace(/\([^\(]*\)/gi, '').trim(); // eg. Nexus 5X (Google) --> Nexus 5X
        this.path = path.trim();
        // eslint-disable-next-line no-useless-escape
        this.target = target.replace(/\([^\(]*\)/gi, '').trim(); // eg. Google APIs (Google Inc.) --> Google APIs
        this.api = api.trim();
        this.apiLevel = apiLevel;
    }

    /**
     * A string representation of an AndroidVirtualDevice which includes Display Name, Device Name, API
     */
    public toString(): string {
        return `${this.displayName}, ${this.deviceName}, ${this.api}`;
    }
}
