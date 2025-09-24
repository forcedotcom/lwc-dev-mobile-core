/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Logger, SfError } from '@salesforce/core';
import { Version } from '../Common.js';
import { CommonUtils } from '../CommonUtils.js';
import { CryptoUtils, SSLCertificateData } from '../CryptoUtils.js';
import { IOSUtils } from '../IOSUtils.js';
import { BaseDevice, DeviceState, DeviceType, LaunchArgument } from './BaseDevice.js';

export type AppleDeviceType = {
    bundlePath: string; // e.g: /Library/Developer/CoreSimulator/Profiles/DeviceTypes/iPhone 16 Pro.simdevicetype
    name: string; // e.g: iPhone 16 Pro Max
    identifier: string; // e.g: com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max
    productFamily: string; // e.g: iPhone
    typeName: string; // e.g: iPhone-16-Pro-Max
};

export type AppleRuntime = {
    buildversion: string; // e.g: 20A360
    bundlePath: string; // e.g: /Library/Developer/CoreSimulator/Volumes/iOS_20A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.0.simruntime
    identifier: string; // e.g: com.apple.CoreSimulator.SimRuntime.iOS-16-0
    isAvailable: boolean;
    isInternal: boolean;
    name: string; // e.g: iOS 16.0
    platform: string; // e.g: iOS
    runtimeRoot: string; // e.g: /Library/Developer/CoreSimulator/Volumes/iOS_20A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.0.simruntime/Contents/Resources/RuntimeRoot
    runtimeName: string; // e.g: iOS-16-0
    supportedArchitectures: string[]; // e.g: [  x86_64, arm64 ]
    supportedDeviceTypes: AppleDeviceType[];
    version: string; // e.g: 16.0
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
    public readonly state: DeviceState;

    public constructor(
        id: string,
        name: string,
        deviceType: DeviceType,
        osType: string,
        osVersion: Version,
        state: DeviceState,
        logger?: Logger
    ) {
        this.id = id;
        this.name = name;
        this.deviceType = deviceType;
        this.osType = osType;
        this.osVersion = osVersion;
        this.state = state;
        this.logger = logger;
    }

    /**
     * A string representation of an AppleDevice which includes Device Name, OS Type, OS Version, udid and state
     */
    public toString(): string {
        return `${this.name}, ${this.osType} ${this.osVersion.toString()}, ${this.id}, ${this.state}`;
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
     * Determines if a specific app is installed on the device.
     *
     * @param target The bundle ID of the app. Eg "com.salesforce.chatter"
     * @returns A boolean indicating if the app is installed on the device or not.
     */
    public async isAppInstalled(target: string): Promise<boolean> {
        let result = '';
        try {
            result = CommonUtils.executeCommandSync(
                `xcrun simctl listapps ${this.id} | grep "${target}"`,
                undefined,
                this.logger
            );
        } catch {
            // ignore and continue
        }

        return Promise.resolve(result ? true : false);
    }

    /**
     * Attempts to install a native app on the device.
     *
     * @param appBundlePath Path to the app bundle of the native app.
     */
    public async installApp(appBundlePath: string): Promise<void> {
        const installCommand = `/usr/bin/xcrun simctl install ${this.id} '${appBundlePath.trim()}'`;
        await CommonUtils.executeCommandAsync(installCommand, this.logger);
    }

    /**
     * Attempts to launch a native app on the device. If the app is not installed then this method will attempt to install it first.
     *
     * @param target The bundle ID of the app to be launched. Eg "com.salesforce.chatter"
     * @param launchArguments Extra arguments to be passed to the app upon launch.
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     */
    public async launchApp(target: string, launchArguments?: LaunchArgument[], appBundlePath?: string): Promise<void> {
        await IOSUtils.launchAppInBootedSimulator(this.id, target, appBundlePath, launchArguments, this.logger);
    }

    /**
     * Checks to see if a certificate is already installed on the device.
     *
     * @param certData An SSLCertificateData object containing the certificate data.
     * @returns A boolean indicating if a certificate is already installed on the device or not.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars , class-methods-use-this
    public async isCertInstalled(certData: SSLCertificateData): Promise<boolean> {
        // Information about the certificates that are installed on a simulator is usually stored at
        // ~/Library/Developer/CoreSimulator/Devices/<Device UDID>/data/Library/Keychains/keychain-2-debug.db
        //
        // The keychain/cert info stored in this DB is in an encrypted format and it is difficult to parse out.
        // For Apple simulators we can just use `simctl keychain` to force install a cert and overwrite if it
        // already exists on the device so for now we're not implementing this and can invest to do so in the
        // future if it is really necessary.
        return Promise.reject(new SfError('Not Implemented'));
    }

    /**
     * Installs a certificate on the device.
     *
     * @param certData An SSLCertificateData object containing the certificate data.
     */
    public async installCert(certData: SSLCertificateData): Promise<void> {
        // For iOS simulators we can use `simctl keychain` command along with a DER certificate file
        // to auto install (which also will overwrite if cert already exist on device)
        const derContent = certData.derCertificate ?? CryptoUtils.pemToDer(certData.pemCertificate);
        const certFilePath = path.join(os.tmpdir(), 'localhost.der');
        fs.writeFileSync(certFilePath, derContent);

        const cmd = `/usr/bin/xcrun simctl keychain ${this.id} add-root-cert ${certFilePath}`;
        await CommonUtils.executeCommandAsync(cmd, this.logger);
    }
}
