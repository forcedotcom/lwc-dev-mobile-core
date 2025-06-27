/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { Logger, Messages, SfError } from '@salesforce/core';
import { CommonUtils } from './CommonUtils.js';
import { LaunchArgument } from './device/BaseDevice.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

const XCRUN_CMD = '/usr/bin/xcrun';
const DEVICE_TYPE_PREFIX = 'com.apple.CoreSimulator.SimDeviceType';
const RUNTIME_TYPE_PREFIX = 'com.apple.CoreSimulator.SimRuntime';

export class IOSUtils {
    /**
     * Attempts to launch a simulator.
     *
     * @param udid The UDID of the simulator to launch.
     * @param waitForBoot Optional boolean indicating whether it should wait for the device to boot up. Defaults to true.
     */
    public static async bootDevice(udid: string, waitForBoot = true, logger?: Logger): Promise<void> {
        const command = `${XCRUN_CMD} simctl boot ${udid}`;
        return CommonUtils.executeCommandAsync(command, logger)
            .then(() => {
                if (waitForBoot) {
                    return IOSUtils.waitUntilDeviceIsReady(udid, logger);
                } else {
                    return Promise.resolve();
                }
            })
            .catch((error) => {
                if (!IOSUtils.isDeviceAlreadyBootedError(error as Error)) {
                    return Promise.reject(new SfError(`The command '${command}' failed to execute ${error}`));
                } else {
                    return Promise.resolve();
                }
            });
    }

    /**
     * Attempts to shutdown a simulator.
     *
     * @param udid The UDID of the simulator to shut down.
     */
    public static async shutdownDevice(udid: string, logger?: Logger): Promise<void> {
        const command = `${XCRUN_CMD} simctl shutdown ${udid}`;
        try {
            await CommonUtils.executeCommandAsync(command, logger);
        } catch (error) {
            logger?.warn(error);
        }
    }

    /**
     * Attempts to create a new simulator device.
     *
     * @param simulatorName The name for the simulator.
     * @param deviceType The type of device to use for the simulator (e.g iPhone-8)
     * @param runtime The runtime to use for the device (e.g iOS-13)
     */
    public static async createNewDevice(
        simulatorName: string,
        deviceType: string,
        runtime: string,
        logger?: Logger
    ): Promise<string> {
        const command = `${XCRUN_CMD} simctl create '${simulatorName}' ${DEVICE_TYPE_PREFIX}.${deviceType} ${RUNTIME_TYPE_PREFIX}.${runtime}`;
        return CommonUtils.executeCommandAsync(command, logger)
            .then((result) => Promise.resolve(result.stdout.trim()))
            .catch((error) => Promise.reject(new SfError(`The command '${command}' failed to execute ${error}`)));
    }

    /**
     * Attempts to wait for a simulator to finish booting up.
     */
    public static async waitUntilDeviceIsReady(udid: string, logger?: Logger): Promise<void> {
        const command = `${XCRUN_CMD} simctl bootstatus "${udid}"`;
        return CommonUtils.executeCommandAsync(command, logger)
            .then(() => Promise.resolve())
            .catch((error) => Promise.reject(new SfError(`The command '${command}' failed to execute ${error}`)));
    }

    /**
     * Attempts to launch the simulator app, which hosts all simulators.
     */
    public static async launchSimulatorApp(logger?: Logger): Promise<void> {
        const command = 'open -a Simulator';
        return CommonUtils.executeCommandAsync(command, logger)
            .then(() => Promise.resolve())
            .catch((error) => Promise.reject(new SfError(`The command '${command}' failed to execute ${error}`)));
    }

    /**
     * Attempts to launch the browser in a booted simulator and navigates to the provided URL.
     *
     * @param udid The UDID of the simulator.
     * @param url The URL to navigate to.
     */
    public static async launchURLInBootedSimulator(udid: string, url: string, logger?: Logger): Promise<void> {
        const command = `${XCRUN_CMD} simctl openurl "${udid}" ${url}`;
        CommonUtils.startCliAction(
            messages.getMessage('launchBrowserAction'),
            messages.getMessage('openBrowserWithUrlStatus', [url])
        );
        return CommonUtils.executeCommandAsync(command, logger)
            .then(() => Promise.resolve())
            .catch((error) => Promise.reject(new SfError(`The command '${command}' failed to execute ${error}`)));
    }

    /**
     * Attempts to launch a native app in a simulator to preview LWC components. If the app is not installed then this method will attempt to install it first.
     *
     * @param udid The UDID of the simulator.
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param targetApp The bundle ID of the app to be launched.
     * @param targetAppArguments Extra arguments to be passed to the app upon launch.
     */
    public static async launchAppInBootedSimulator(
        udid: string,
        targetApp: string,
        appBundlePath?: string,
        targetAppArguments?: LaunchArgument[],
        logger?: Logger
    ): Promise<void> {
        CommonUtils.startCliAction(messages.getMessage('launchAppAction'));

        if (appBundlePath && appBundlePath.trim().length > 0) {
            const installMsg = messages.getMessage('installAppStatus', [appBundlePath.trim()]);
            logger?.info(installMsg);
            CommonUtils.updateCliAction(installMsg);
            const installCommand = `${XCRUN_CMD} simctl install ${udid} '${appBundlePath.trim()}'`;
            await CommonUtils.executeCommandAsync(installCommand, logger);
        }

        let launchArgs = '';
        targetAppArguments?.forEach((arg) => {
            launchArgs += `${arg.name}=${arg.value} `;
        });

        const terminateCommand = `${XCRUN_CMD} simctl terminate "${udid}" ${targetApp}`;
        const launchCommand = `${XCRUN_CMD} simctl launch "${udid}" ${targetApp} ${launchArgs}`;

        // attempt at terminating the app first (in case it is already running) and then try to launch it again with new arguments.
        // if we hit issues with terminating, just ignore and continue.
        try {
            const terminateMsg = messages.getMessage('terminateAppStatus', [targetApp]);
            logger?.info(terminateMsg);
            CommonUtils.updateCliAction(terminateMsg);
            await CommonUtils.executeCommandAsync(terminateCommand, logger);
        } catch {
            // ignore and continue
        }

        const launchMsg = messages.getMessage('launchAppStatus', [targetApp]);
        logger?.info(launchMsg);
        CommonUtils.updateCliAction(launchMsg);
        await CommonUtils.executeCommandAsync(launchCommand, logger);

        CommonUtils.stopCliAction();
    }

    private static isDeviceAlreadyBootedError(error: Error): boolean {
        return error.message ? error.message.toLowerCase().match('state: booted') !== null : false;
    }
}
