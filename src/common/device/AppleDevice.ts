/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { Logger } from '@salesforce/core';
import { Version } from '../Common.js';
import { IOSUtils } from '../IOSUtils.js';
import { BaseDevice, DeviceType, LaunchArgument } from './BaseDevice.js';

export type AppleRuntime = {
    bundlePath: string;
    identifier: string;
    isAvailable: boolean;
    isInternal: boolean;
    name: string;
    platform: string;
    runtimeRoot: string;
    version: string;
};

export enum AppleOSType {
    iOS = 'iOS',
    tvOS = 'tvOS',
    watchOS = 'watchOS',
    xrOS = 'xrOS'
}

export class AppleDevice implements BaseDevice {
    public logger?: Logger;
    public readonly id: string;
    public readonly name: string;
    public readonly deviceType: DeviceType;
    public readonly osType: string;
    public readonly osVersion: string | Version;

    public constructor(
        id: string,
        name: string,
        deviceType: DeviceType,
        osType: string,
        osVersion: Version,
        logger?: Logger
    ) {
        this.id = id;
        this.name = name;
        this.deviceType = deviceType;
        this.osType = osType;
        this.osVersion = osVersion;
        this.logger = logger;
    }

    /**
     * A string representation of an AppleDevice which includes Device Name, OS Type, OS Version, and udid
     */
    public toString(): string {
        return `${this.name}, ${this.osType} ${this.osVersion.toString()}, ${this.id}`;
    }

    /**
     * Attempts to boot up the device.
     *
     * @param waitForBoot Optional boolean indicating whether to wait for the device to boot up. Defaults to true.
     */
    public async boot(waitForBoot = true): Promise<void> {
        // Booting the device will not give it a window. We also need to launch
        // the simulator app in order for the booted device(s) to get a window.
        await IOSUtils.bootDevice(this.id, waitForBoot, this.logger);
        await IOSUtils.launchSimulatorApp(this.logger);
    }

    /**
     * Attempts to reboot the device.
     *
     * @param waitForBoot Optional boolean indicating whether to wait for the device to boot up. Defaults to true.
     */
    public async reboot(waitForBoot = true): Promise<void> {
        // `xcrun simctl` does not provide a way to reboot a device.
        // Instead we need to shutdown and again start up a device.
        await this.shutdown();
        await this.boot(waitForBoot);
    }

    /**
     * Attempts to shutdown the device.
     */
    public async shutdown(): Promise<void> {
        await IOSUtils.shutdownDevice(this.id, this.logger);
    }

    /**
     * Attempts to launch the browser and navigate to the provided URL.
     *
     * @param url The URL to navigate to.
     */
    public async openUrl(url: string): Promise<void> {
        await IOSUtils.launchURLInBootedSimulator(this.id, url, this.logger);
    }

    /**
     * Attempts to launch a native app on the device. If the app is not installed then this method will attempt to install it first.
     *
     * @param target The bundle ID of the app to be launched. Eg "com.salesforce.chatter"
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param targetAppArguments Extra arguments to be passed to the app upon launch.
     */
    public async launchApp(
        target: string,
        appBundlePath?: string,
        targetAppArguments?: LaunchArgument[]
    ): Promise<void> {
        await IOSUtils.launchAppInBootedSimulator(this.id, target, appBundlePath, targetAppArguments, this.logger);
    }
}
