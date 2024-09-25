/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger } from '@salesforce/core';
import { Version } from './Common.js';

export class AndroidPackages {
    public platforms: AndroidPackage[] = [];
    public systemImages: AndroidPackage[] = [];

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
     * Checks to see if the object is empty (i.e the platforms and system images are both empty)
     *
     * @returns True if empty, false otherwise.
     */
    public isEmpty(): boolean {
        return this.platforms.length < 1 && this.systemImages.length < 1;
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
}

export class AndroidPackage {
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
