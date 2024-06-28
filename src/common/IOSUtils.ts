/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfError } from '@salesforce/core';
import { Version } from '../common/Common.js';
import { CommonUtils } from './CommonUtils.js';
import { IOSSimulatorDevice } from './IOSTypes.js';
import { PlatformConfig } from './PlatformConfig.js';
import { LaunchArgument } from './PreviewConfigFile.js';

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
                if (!IOSUtils.isDeviceAlreadyBootedError(error)) {
                    return Promise.reject(new SfError(`The command '${command}' failed to execute ${error}`));
                } else {
                    return Promise.resolve();
                }
            });
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
     * Attempts to get the info about a simulator.
     *
     * @param simulatorIdentifier The udid or the name for the simulator.
     * @returns An IOSSimulatorDevice object containing the info of a simulator, or NULL if not found.
     */
    public static async getSimulator(simulatorIdentifier: string, logger?: Logger): Promise<IOSSimulatorDevice | null> {
        return IOSUtils.getSupportedSimulators(logger)
            .then((devices) => {
                for (const device of devices) {
                    if (simulatorIdentifier === device.udid) {
                        return Promise.resolve(device);
                    } else if (simulatorIdentifier === device.name) {
                        return Promise.resolve(device);
                    }
                }

                logger?.info(`Unable to find simulator: ${simulatorIdentifier}`);
                return Promise.resolve(null);
            })
            .catch((error) => {
                logger?.warn(error);
                return Promise.resolve(null);
            });
    }

    /**
     * Attempts to get a list of simulators that are supported.
     *
     * @returns An array of IOSSimulatorDevice objects containing the info about the supported simulators.
     */
    public static async getSupportedSimulators(logger?: Logger): Promise<IOSSimulatorDevice[]> {
        let supportedRuntimes: string[] = [];

        return IOSUtils.getSupportedRuntimes(logger)
            .then((runtimes) => {
                supportedRuntimes = runtimes;
                return CommonUtils.executeCommandAsync(`${XCRUN_CMD} simctl list --json devices available`, logger);
            })
            .then((result) => {
                const devices = IOSSimulatorDevice.parseJSONString(result.stdout, supportedRuntimes);

                return Promise.resolve(devices);
            })
            .catch((error) => {
                logger?.warn(error);
                return Promise.resolve([]);
            });
    }

    /**
     * Attempts to get a list of device types that are supported.
     *
     * @returns An array of strings containing the supported device types.
     */
    public static async getSupportedDevices(logger?: Logger): Promise<string[]> {
        const cmd = `${XCRUN_CMD} simctl list --json devicetypes`;
        return CommonUtils.executeCommandAsync(cmd, logger)
            .then((result) => {
                const identifier = 'identifier';
                const deviceTypesKey = 'devicetypes';
                const deviceMatchRegex = /SimDeviceType.iPhone-[8,1,X]/;
                const devicesObj = JSON.parse(result.stdout);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const devices: any[] = devicesObj[deviceTypesKey] || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const matchedDevices: any[] = devices.filter((entry) => entry[identifier]?.match(deviceMatchRegex));

                if (matchedDevices) {
                    return Promise.resolve(matchedDevices.map((entry) => entry.identifier.split('.')[4]));
                } else {
                    return Promise.reject(
                        new SfError(`Could not find any available devices. Command '${cmd}' returned an empty list.`)
                    );
                }
            })
            .catch((error) => Promise.reject(new SfError(`Could not find any available devices. ${error}`)));
    }

    /**
     * Attempts to get a list of runtimes that are supported.
     *
     * @returns An array of strings containing the supported runtimes.
     */
    public static async getSupportedRuntimes(logger?: Logger): Promise<string[]> {
        return IOSUtils.getSimulatorRuntimes(logger).then((configuredRuntimes) => {
            const minSupportedRuntimeIOS = Version.from(PlatformConfig.iOSConfig().minSupportedRuntime);
            if (minSupportedRuntimeIOS === null) {
                return Promise.reject(
                    new SfError(`${PlatformConfig.iOSConfig().minSupportedRuntime} is not a supported version format.`)
                );
            }

            const rtIntersection = configuredRuntimes.filter((configuredRuntime) => {
                const configuredRuntimeVersion = Version.from(configuredRuntime.toLowerCase().replace('ios-', ''));
                if (configuredRuntimeVersion === null) {
                    // We haven't hit a use case where Apple does unconventional version
                    // specifications like Google will do with their codename "versions".
                    // So for now, this is a 'miss' on the iOS side. Prove me wrong, Apple!
                    logger?.warn(
                        `getSupportedRuntimes(): getSimulatorRuntimes() returned '${configuredRuntime}', which is not a supported version format.`
                    );
                    return false;
                }

                return Version.sameOrNewer(configuredRuntimeVersion, minSupportedRuntimeIOS);
            });

            if (rtIntersection.length > 0) {
                return Promise.resolve(rtIntersection);
            } else {
                return Promise.reject();
            }
        });
    }

    /**
     * Attempts to get a list of all runtimes that are available.
     *
     * @returns An array of strings containing all of the available runtimes.
     */
    public static async getSimulatorRuntimes(logger?: Logger): Promise<string[]> {
        const runtimesCmd = `${XCRUN_CMD} simctl list --json runtimes available`;
        return CommonUtils.executeCommandAsync(runtimesCmd, logger)
            .then((result) => {
                // eslint-disable-next-line no-useless-escape
                const runtimeMatchRegex = /.*SimRuntime\.((iOS)-[\d\-]+)$/;
                const RUNTIMES_KEY = 'runtimes';
                const ID_KEY = 'identifier';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const runtimesObj: any = JSON.parse(result.stdout);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const runtimes: any[] = runtimesObj[RUNTIMES_KEY] || [];
                let filteredRuntimes = runtimes.filter((entry) => entry[ID_KEY]?.match(runtimeMatchRegex));
                filteredRuntimes = filteredRuntimes.sort().reverse();
                filteredRuntimes = filteredRuntimes.map((entry) =>
                    (entry[ID_KEY] as string).replace(runtimeMatchRegex, '$1')
                );
                if (filteredRuntimes && filteredRuntimes.length > 0) {
                    return Promise.resolve(filteredRuntimes);
                } else {
                    return Promise.reject(
                        new SfError(`The command '${runtimesCmd}' could not find any available runtimes`)
                    );
                }
            })
            .catch((error) =>
                Promise.reject(new SfError(`The command '${runtimesCmd}' failed: ${error}, error code: ${error.code}`))
            );
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
        appBundlePath: string | undefined,
        targetApp: string,
        targetAppArguments: LaunchArgument[],
        logger?: Logger
    ): Promise<void> {
        let thePromise: Promise<{ stdout: string; stderr: string }>;
        if (appBundlePath && appBundlePath.trim().length > 0) {
            const installMsg = messages.getMessage('installAppStatus', [appBundlePath.trim()]);
            logger?.info(installMsg);
            CommonUtils.startCliAction(messages.getMessage('launchAppAction'), installMsg);
            const installCommand = `${XCRUN_CMD} simctl install ${udid} '${appBundlePath.trim()}'`;
            thePromise = CommonUtils.executeCommandAsync(installCommand, logger);
        } else {
            thePromise = Promise.resolve({ stdout: '', stderr: '' });
        }

        return thePromise
            .then(async () => {
                let launchArgs = '';
                targetAppArguments.forEach((arg) => {
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
                return CommonUtils.executeCommandAsync(launchCommand, logger);
            })
            .then(() => {
                CommonUtils.stopCliAction();
                return Promise.resolve();
            });
    }

    private static isDeviceAlreadyBootedError(error: Error): boolean {
        return error.message ? error.message.toLowerCase().match('state: booted') !== null : false;
    }
}
