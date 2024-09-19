/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Logger, Messages, SfError } from '@salesforce/core';
import { AndroidUtils } from '../AndroidUtils.js';
import { Version } from '../Common.js';
import { CryptoUtils, SSLCertificateData } from '../CryptoUtils.js';
import { CommonUtils } from '../CommonUtils.js';
import { BaseDevice, DeviceType, LaunchArgument } from './BaseDevice.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

export enum AndroidOSType {
    googleAPIs = 'google apis',
    googlePlayStore = 'google apis playstore',
    androidDesktop = 'android desktop',
    googleTV = 'google tv',
    androidWear = 'android wear',
    androidAutomotive = 'android automotive'
}

export enum BootMode {
    normal = 'normal',
    systemWritablePreferred = 'systemWritablePreferred',
    systemWritableMandatory = 'systemWritableMandatory'
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
     * @param bootMode Optional enum indicating the boot mode. Defaults to Normal.
     * @param coldBoot Optional boolean indicating whether we should perform a cold boot. Defaults to false.
     */
    public async boot(waitForBoot = true, bootMode = BootMode.normal, coldBoot = false): Promise<void> {
        if (this.isPlayStore) {
            if (bootMode === BootMode.systemWritableMandatory) {
                throw new SfError(messages.getMessage('playStoreNotWritableError'));
            } else if (bootMode === BootMode.systemWritablePreferred) {
                this.logger?.warn(messages.getMessage('playStoreNotWritableWarning'));
            }
        }

        await this.startEmulator(bootMode, coldBoot, waitForBoot);
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
            await this.rebootEmulator(waitForBoot);
        }
    }

    /**
     * Attempts to shutdown the device.
     */
    public async shutdown(): Promise<void> {
        await this.stopEmulator(true);
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
     * Determines if a specific app is installed on the device.
     *
     * @param target The bundle ID of the app. Eg "com.salesforce.chatter"
     * @returns A boolean indicating if the app is installed on the device or not.
     */
    public async hasApp(target: string): Promise<boolean> {
        // If the caller passes in package id + activity name, just grab the package id.
        const pkgId = target.split('/')[0];
        let result = '';
        try {
            result = await AndroidUtils.executeAdbCommand(
                `shell "pm list packages | grep '${pkgId}'"`,
                this.port,
                this.logger
            );
        } catch {
            // ignore and continue
        }

        return Promise.resolve(result?.trim() ? true : false);
    }

    /**
     * Attempts to launch a native app on the device. If the app is not installed then this method will attempt to install it first.
     *
     * @param target The bundle ID of the app to be launched + the activity name to be used when launching the app. Eg "com.salesforce.chatter/.Chatter"
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param launchArguments Extra arguments to be passed to the app upon launch.
     */
    public async launchApp(target: string, appBundlePath?: string, launchArguments?: LaunchArgument[]): Promise<void> {
        await AndroidUtils.launchAppInBootedEmulator(this.port, target, appBundlePath, launchArguments, this.logger);
    }

    /**
     * Checks to see if a certificate is already installed on the device.
     *
     * @param certData An SSLCertificateData object containing the certificate data.
     * @returns A boolean indicating if a certificate is already installed on the device or not.
     */
    public async isCertInstalled(certData: SSLCertificateData): Promise<boolean> {
        // For Android emulators, certificates are installed in files named as their subject hash.
        // We can query the device to see if it has the file with the name as the subject hash of the
        // provided certificate. If so then we can say that the cert is already installed.
        const subjectHash = CryptoUtils.getSubjectHashOld(certData);
        const fileName = `${subjectHash}.0`; // this is the special file name

        try {
            // start adb as root so that we can query specific folder location
            await AndroidUtils.executeAdbCommand('root', this.port, this.logger);

            // see if the file exists already
            const result = await AndroidUtils.executeAdbCommand(
                'shell "ls /data/misc/user/0/cacerts-added"',
                this.port,
                this.logger
            );
            return result.includes(fileName);
        } catch (error) {
            // If file doesn't exist then an error is thrown on some versions of adb.
            // Also determining if cert is already installed is a best effort so if any errors
            // occur we will continue and assume that cert is not installed.
            this.logger?.warn(error);
        }
        return false;
    }

    /**
     * Installs a certificate on the device.
     *
     * @param certData An SSLCertificateData object containing the certificate data.
     */
    public async installCert(certData: SSLCertificateData): Promise<void> {
        // For Android emulators, we need to save the PEM certificate in a file named as the cert subject hash.
        const subjectHash = CryptoUtils.getSubjectHashOld(certData);
        const pemContent = certData.pemCertificate ?? CryptoUtils.derToPem(certData.derCertificate);
        const fileName = `${subjectHash}.0`; // this is the special file name
        const certFilePath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(certFilePath, pemContent);

        // We then need to push the file to the emulator (needs to be root-mountable).
        CommonUtils.updateCliAction(messages.getMessage('bootingWritable'));
        await this.boot(true, BootMode.systemWritableMandatory, false);

        CommonUtils.updateCliAction(messages.getMessage('adbRoot'));
        await AndroidUtils.executeAdbCommand('root', this.port, this.logger);

        CommonUtils.updateCliAction(messages.getMessage('remountSystemWritableStatus'));
        await AndroidUtils.executeAdbCommand('remount', this.port, this.logger);

        CommonUtils.updateCliAction(messages.getMessage('certificateInstall'));
        await AndroidUtils.executeAdbCommand(
            `push ${certFilePath} /data/misc/user/0/cacerts-added/${fileName}`,
            this.port,
            this.logger
        );
        await AndroidUtils.executeAdbCommand(
            `shell "su 0 chmod 644 /data/misc/user/0/cacerts-added/${fileName}"`,
            this.port,
            this.logger
        );
        await AndroidUtils.executeAdbCommand(
            `shell "su 0 chown root:root /data/misc/user/0/cacerts-added/${fileName}"`,
            this.port,
            this.logger
        );

        CommonUtils.updateCliAction(messages.getMessage('rebootChangesStatus'));
        await this.reboot();
    }

    /**
     * Mounts adb as root with writable system access for the AVD that is running on the specified port. If the AVD currently
     * is not launched with writable system access, this function will restart it with write access first then remounts as root.
     */
    public async mountAsRootWritableSystem(): Promise<void> {
        // First attempt to start the emulator with writable system. Since it is already running, startEmulator() will check
        // to see if it is also running with writable system already or not. If so then nothing will happen and startEmulator()
        // will just return. Otherwise startEmulator() will power off the emulator first, then relaunch it with writable system,
        // and finally wait for it to finish booting.
        await this.startEmulator(BootMode.systemWritableMandatory);

        // Now that emulator is launched with writable system, run root command
        await AndroidUtils.executeAdbCommand('root', this.port, this.logger);

        // For API 29 or higher there are a few more steps to be done before we can remount after rooting
        if (Version.sameOrNewer(this.osVersion, Version.from('29')!)) {
            const verificationIsAlreadyDisabled = (
                await AndroidUtils.executeAdbCommand('shell avbctl get-verification', this.port, this.logger)
            ).includes('disabled');

            const verityIsAlreadyDisabled = (
                await AndroidUtils.executeAdbCommand('shell avbctl get-verity', this.port, this.logger)
            ).includes('disabled');

            if (!verificationIsAlreadyDisabled || !verityIsAlreadyDisabled) {
                CommonUtils.updateCliAction(messages.getMessage('disableAVBVerityStatus'));
            }

            if (!verificationIsAlreadyDisabled) {
                // Disable Android Verified Boot
                await AndroidUtils.executeAdbCommand('shell avbctl disable-verification', this.port, this.logger);
            }

            if (!verityIsAlreadyDisabled) {
                // Disable Verity
                await AndroidUtils.executeAdbCommand('disable-verity', this.port, this.logger);
            }

            // If AVB and Verity were not disabled already and we had to run
            // commands to disable them, then reboot for changes to take effect.
            if (!verificationIsAlreadyDisabled || !verityIsAlreadyDisabled) {
                CommonUtils.updateCliAction(messages.getMessage('rebootChangesStatus'));

                // Reboot for changes to take effect
                await this.reboot(true);

                // Root again
                await AndroidUtils.executeAdbCommand('root', this.port, this.logger);
            }
        }

        CommonUtils.updateCliAction(messages.getMessage('remountSystemWritableStatus'));
        // Now we're ready to remount and truly have root & writable access to system
        await AndroidUtils.executeAdbCommand('remount', this.port, this.logger);
    }

    /**
     * Attempts to launch the emulator and returns the ADB port that the emulator was launched on.
     *
     * @param bootMode Optional enum indicating the boot mode. Defaults to Normal.
     * @param coldBoot Optional boolean indicating whether we should perform a cold boot. Defaults to false.
     * @param waitForBoot Optional boolean indicating whether it should wait for the device to finish booting up. Defaults to true.
     * @returns The ADB port that the emulator was launched on.
     */
    private async startEmulator(bootMode = BootMode.normal, coldBoot = false, waitForBoot = true): Promise<void> {
        const port = await AndroidUtils.emulatorHasPort(this.id, this.logger);
        const resolvedPortNumber = port ? port : await AndroidUtils.getNextAvailableAdbPort(this.logger);

        if (resolvedPortNumber === port) {
            // Already booted and running on a port, so determine whether need to relaunch with system writable or not.
            const isAlreadyWritable = await AndroidUtils.isEmulatorSystemWritable(resolvedPortNumber, this.logger);

            // If it is already writable or it is not mandatory to have a writable system then we're done so just return its port.
            if (isAlreadyWritable || bootMode !== BootMode.systemWritableMandatory) {
                this.port = resolvedPortNumber;
                return;
            } else {
                // It is mandatory to have writable system but the emulator is already booted without it.
                // Shut it down and relaunch it in the right mode.
                CommonUtils.updateCliAction(messages.getMessage('notWritableSystemShutDownStatus'));
                await this.stopEmulator(true);
            }
        }

        let msgKey = '';
        const writable = bootMode !== BootMode.normal;
        if (resolvedPortNumber === port) {
            msgKey = writable ? 'emulatorRelaunchWritableStatus' : 'emulatorRelaunchNotWritableStatus';
        } else {
            msgKey = writable ? 'emulatorLaunchWritableStatus' : 'emulatorLaunchNotWritableStatus';
        }

        CommonUtils.updateCliAction(messages.getMessage(msgKey, [this.id, resolvedPortNumber]));

        // We intentionally use spawn and ignore stdio here b/c emulator command can
        // spit out a bunch of output to stderr where they are not really errors. This
        // is specially true on Windows platform. So instead we spawn the process to launch
        // the emulator and later attempt at polling the emulator to see if it failed to boot.
        const writableFlag = writable ? '-writable-system' : '';
        const coldFlag = coldBoot ? '-no-snapshot-load' : '';
        const child = childProcess.spawn(
            `${AndroidUtils.getEmulatorCommand()} @${this.id} -port ${resolvedPortNumber} ${writableFlag} ${coldFlag}`,
            { detached: true, shell: true, stdio: 'ignore' }
        );
        child.unref();

        if (waitForBoot) {
            CommonUtils.updateCliAction(messages.getMessage('waitForBootStatus', [this.id]));
            await AndroidUtils.waitUntilDeviceIsReady(resolvedPortNumber, this.logger);
        }

        this.port = resolvedPortNumber;
    }

    /**
     * Attempts to power off an emulator.
     *
     * @param waitForPowerOff Optional boolean indicating whether it should wait for the device to shut down. Defaults to true.
     */
    private async stopEmulator(waitForPowerOff = true): Promise<void> {
        await AndroidUtils.executeAdbCommand('emu kill', this.port, this.logger);
        if (waitForPowerOff) {
            await AndroidUtils.waitUntilDeviceIsPoweredOff(this.port, this.logger);
        }
    }

    /**
     * Attempts to reboot an emulator.
     *
     * @param waitForBoot Optional boolean indicating whether it should wait for the device to boot up. Defaults to true.
     */
    private async rebootEmulator(waitForBoot = true): Promise<void> {
        try {
            await AndroidUtils.executeAdbCommand('shell reboot', this.port, this.logger);
        } catch (error) {
            // Sometimes the command `adb shell reboot` completes with an error even though it has
            // successfully rebooted the device. So we will just log the error and continue to wait
            // for device to become ready. If that step times out then reboot was not successful.
            this.logger?.warn(error);
        }

        if (waitForBoot) {
            await AndroidUtils.waitUntilDeviceIsReady(this.port, this.logger);
        }
    }
}
