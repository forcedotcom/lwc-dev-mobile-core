/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { Logger, SfError } from '@salesforce/core';
import { AndroidUtils } from '../AndroidUtils.js';
import { Version } from '../Common.js';
import { BaseDevice, DeviceType, LaunchArgument } from './BaseDevice.js';

export enum AndroidOSType {
    googleAPIs = 'google_apis',
    googlePlayStore = 'google_apis_playstore',
    androidDesktop = 'android-desktop',
    googleTV = 'google-tv',
    androidWear = 'android-wear',
    androidAutomotive = 'android-automotive'
}

export class AndroidDevice implements BaseDevice {
    public logger?: Logger;
    public readonly id: string;
    public readonly name: string;
    public readonly deviceType: DeviceType;
    public readonly osType: string;
    public readonly osVersion: string | Version;
    public readonly isPlayStore: boolean;

    private port: number = -1;

    public constructor(
        id: string,
        name: string,
        deviceType: DeviceType,
        osType: string,
        osVersion: Version | string,
        isPlayStore: boolean,
        logger?: Logger
    ) {
        this.id = id;
        this.name = name;
        this.deviceType = deviceType;
        this.osType = osType;
        this.osVersion = osVersion;
        this.isPlayStore = isPlayStore;
        this.logger = logger;
    }

    /**
     * A string representation of an AppleDevice which includes Device Name, OS Type, and OS Version
     */
    public toString(): string {
        return `${this.name}, ${this.osType} ${this.osVersion.toString()}`;
    }

    public emulatorPort(): number {
        return this.port;
    }

    /**
     * Attempts to boot up the device.
     *
     * @param waitForBoot Optional boolean indicating whether to wait for the device to boot up. Defaults to true.
     * @param systemWritable Optional boolean indicating whether the emulator should launch with the '-writable-system' flag. Defaults to false.
     */
    public async boot(waitForBoot = true, systemWritable = false): Promise<void> {
        if (systemWritable && this.isPlayStore) {
            throw new SfError('Play Store devices cannot be booted with writable system.');
        }

        this.port = await AndroidUtils.startEmulator(this.id, systemWritable, waitForBoot, this.logger);
    }

    /**
     * Attempts to reboot the device.
     *
     * @param waitForBoot Optional boolean indicating whether to wait for the device to boot up. Defaults to true.
     */
    public async reboot(waitForBoot = true): Promise<void> {
        if (this.port === -1) {
            // Has not been booted yet so instead of rebooting just start it up.
            await this.boot(waitForBoot);
        } else {
            await AndroidUtils.rebootEmulator(this.port, waitForBoot);
        }
    }

    /**
     * Attempts to shutdown the device.
     */
    public async shutdown(): Promise<void> {
        await AndroidUtils.stopEmulator(this.port, true, this.logger);
    }

    /**
     * Attempts to launch the browser and navigate to the provided URL.
     *
     * @param url The URL to navigate to.
     */
    public async openUrl(url: string): Promise<void> {
        await AndroidUtils.launchURLIntent(url, this.port, this.logger);
    }

    /**
     * Attempts to launch a native app on the device. If the app is not installed then this method will attempt to install it first.
     *
     * @param target The bundle ID of the app to be launched + the activity name to be used when launching the app. Eg "com.salesforce.chatter/.Chatter"
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param targetAppArguments Extra arguments to be passed to the app upon launch.
     */
    public async launchApp(
        target: string,
        appBundlePath?: string,
        targetAppArguments?: LaunchArgument[]
    ): Promise<void> {
        await AndroidUtils.launchAppInBootedEmulator(this.port, target, appBundlePath, targetAppArguments, this.logger);
    }
}
