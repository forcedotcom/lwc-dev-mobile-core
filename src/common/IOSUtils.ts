/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, LoggerLevelValue, Messages, SfError } from '@salesforce/core';
import util from 'util';
import { Version } from '../common/Common';
import { CommonUtils } from './CommonUtils';
import { IOSSimulatorDevice } from './IOSTypes';
import { PlatformConfig } from './PlatformConfig';
import { LaunchArgument } from './PreviewConfigFile';
import { PreviewUtils } from './PreviewUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'common'
);

const XCRUN_CMD = '/usr/bin/xcrun';
const DEVICE_TYPE_PREFIX = 'com.apple.CoreSimulator.SimDeviceType';
const RUNTIME_TYPE_PREFIX = 'com.apple.CoreSimulator.SimRuntime';
const LOGGER_NAME = 'force:lightning:local:iosutils';

export class IOSUtils {
    /**
     * Initialized the logger used by IOSUtils
     */
    public static async initializeLogger(
        level?: LoggerLevelValue
    ): Promise<void> {
        IOSUtils.logger = await Logger.child(LOGGER_NAME);
        IOSUtils.logger.setLevel(level);
        return Promise.resolve();
    }

    /**
     * Attempts to launch a simulator.
     *
     * @param udid The UDID of the simulator to launch.
     * @param waitForBoot Optional boolean indicating whether it should wait for the device to boot up. Defaults to true.
     */
    public static async bootDevice(
        udid: string,
        waitForBoot = true
    ): Promise<void> {
        const command = `${XCRUN_CMD} simctl boot ${udid}`;
        return CommonUtils.executeCommandAsync(command)
            .then(() => {
                if (waitForBoot) {
                    return IOSUtils.waitUntilDeviceIsReady(udid);
                } else {
                    return Promise.resolve();
                }
            })
            .catch((error) => {
                if (!IOSUtils.isDeviceAlreadyBootedError(error)) {
                    return Promise.reject(
                        new SfError(
                            `The command '${command}' failed to execute ${error}`
                        )
                    );
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
        runtime: string
    ): Promise<string> {
        const command = `${XCRUN_CMD} simctl create '${simulatorName}' ${DEVICE_TYPE_PREFIX}.${deviceType} ${RUNTIME_TYPE_PREFIX}.${runtime}`;
        return CommonUtils.executeCommandAsync(command)
            .then((result) => Promise.resolve(result.stdout.trim()))
            .catch((error) =>
                Promise.reject(
                    new SfError(
                        `The command '${command}' failed to execute ${error}`
                    )
                )
            );
    }

    /**
     * Attempts to get the info about a simulator.
     *
     * @param simulatorIdentifier The udid or the name for the simulator.
     * @returns An IOSSimulatorDevice object containing the info of a simulator, or NULL if not found.
     */
    public static async getSimulator(
        simulatorIdentifier: string
    ): Promise<IOSSimulatorDevice | null> {
        return IOSUtils.getSupportedSimulators()
            .then((devices) => {
                for (const device of devices) {
                    if (simulatorIdentifier === device.udid) {
                        return Promise.resolve(device);
                    } else if (simulatorIdentifier === device.name) {
                        return Promise.resolve(device);
                    }
                }

                IOSUtils.logger.info(
                    `Unable to find simulator: ${simulatorIdentifier}`
                );
                return Promise.resolve(null);
            })
            .catch((error) => {
                IOSUtils.logger.warn(error);
                return Promise.resolve(null);
            });
    }

    /**
     * Attempts to get a list of simulators that are supported.
     *
     * @returns An array of IOSSimulatorDevice objects containing the info about the supported simulators.
     */
    public static async getSupportedSimulators(): Promise<
        IOSSimulatorDevice[]
    > {
        let supportedRuntimes: string[] = [];

        return IOSUtils.getSupportedRuntimes()
            .then((runtimes) => {
                supportedRuntimes = runtimes;
                return CommonUtils.executeCommandAsync(
                    `${XCRUN_CMD} simctl list --json devices available`
                );
            })
            .then((result) => {
                const devices = IOSSimulatorDevice.parseJSONString(
                    result.stdout,
                    supportedRuntimes
                );

                return Promise.resolve(devices);
            })
            .catch((error) => {
                IOSUtils.logger.warn(error);
                return Promise.resolve([]);
            });
    }

    /**
     * Attempts to get a list of device types that are supported.
     *
     * @returns An array of strings containing the supported device types.
     */
    public static async getSupportedDevices(): Promise<string[]> {
        const cmd = `${XCRUN_CMD} simctl list --json devicetypes`;
        return CommonUtils.executeCommandAsync(cmd)
            .then((result) => {
                const identifier = 'identifier';
                const deviceTypesKey = 'devicetypes';
                const deviceMatchRegex = /SimDeviceType.iPhone-[8,1,X]/;
                const devicesObj: any = JSON.parse(result.stdout);
                const devices: any[] = devicesObj[deviceTypesKey] || [];
                const matchedDevices: any[] = devices.filter((entry) => {
                    return (
                        entry[identifier] &&
                        entry[identifier].match(deviceMatchRegex)
                    );
                });

                if (matchedDevices) {
                    return Promise.resolve(
                        matchedDevices.map(
                            (entry) => entry.identifier.split('.')[4]
                        )
                    );
                } else {
                    return Promise.reject(
                        new SfError(
                            `Could not find any available devices. Command '${cmd}' returned an empty list.`
                        )
                    );
                }
            })
            .catch((error) =>
                Promise.reject(
                    new SfError(
                        `Could not find any available devices. ${error}`
                    )
                )
            );
    }

    /**
     * Attempts to get a list of runtimes that are supported.
     *
     * @returns An array of strings containing the supported runtimes.
     */
    public static async getSupportedRuntimes(): Promise<string[]> {
        return IOSUtils.getSimulatorRuntimes().then((configuredRuntimes) => {
            const minSupportedRuntimeIOS = Version.from(
                PlatformConfig.iOSConfig().minSupportedRuntime
            );
            if (minSupportedRuntimeIOS === null) {
                return Promise.reject(
                    new SfError(
                        `${
                            PlatformConfig.iOSConfig().minSupportedRuntime
                        } is not a supported version format.`
                    )
                );
            }

            const rtIntersection = configuredRuntimes.filter(
                (configuredRuntime) => {
                    const configuredRuntimeVersion = Version.from(
                        configuredRuntime.toLowerCase().replace('ios-', '')
                    );
                    if (configuredRuntimeVersion === null) {
                        // We haven't hit a use case where Apple does unconventional version
                        // specifications like Google will do with their codename "versions".
                        // So for now, this is a 'miss' on the iOS side. Prove me wrong, Apple!
                        IOSUtils.logger.warn(
                            `getSupportedRuntimes(): getSimulatorRuntimes() returned '${configuredRuntime}', which is not a supported version format.`
                        );
                        return false;
                    }

                    return configuredRuntimeVersion.sameOrNewer(
                        minSupportedRuntimeIOS
                    );
                }
            );

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
    public static async getSimulatorRuntimes(): Promise<string[]> {
        const runtimesCmd = `${XCRUN_CMD} simctl list --json runtimes available`;
        return CommonUtils.executeCommandAsync(runtimesCmd)
            .then((result) => {
                // eslint-disable-next-line no-useless-escape
                const runtimeMatchRegex = /.*SimRuntime\.((iOS)-[\d\-]+)$/;
                const RUNTIMES_KEY = 'runtimes';
                const ID_KEY = 'identifier';
                const runtimesObj: any = JSON.parse(result.stdout);
                const runtimes: any[] = runtimesObj[RUNTIMES_KEY] || [];
                let filteredRuntimes = runtimes.filter((entry) => {
                    return (
                        entry[ID_KEY] && entry[ID_KEY].match(runtimeMatchRegex)
                    );
                });
                filteredRuntimes = filteredRuntimes.sort().reverse();
                filteredRuntimes = filteredRuntimes.map((entry) => {
                    return (entry[ID_KEY] as string).replace(
                        runtimeMatchRegex,
                        '$1'
                    );
                });
                if (filteredRuntimes && filteredRuntimes.length > 0) {
                    return Promise.resolve(filteredRuntimes);
                } else {
                    return Promise.reject(
                        new SfError(
                            `The command '${runtimesCmd}' could not find any available runtimes`
                        )
                    );
                }
            })
            .catch((error) => {
                return Promise.reject(
                    new SfError(
                        `The command '${runtimesCmd}' failed: ${error}, error code: ${error.code}`
                    )
                );
            });
    }

    /**
     * Attempts to wait for a simulator to finish booting up.
     */
    public static async waitUntilDeviceIsReady(udid: string): Promise<void> {
        const command = `${XCRUN_CMD} simctl bootstatus "${udid}"`;
        return CommonUtils.executeCommandAsync(command)
            .then(() => Promise.resolve())
            .catch((error) =>
                Promise.reject(
                    new SfError(
                        `The command '${command}' failed to execute ${error}`
                    )
                )
            );
    }

    /**
     * Attempts to launch the simulator app, which hosts all simulators.
     */
    public static async launchSimulatorApp(): Promise<void> {
        const command = `open -a Simulator`;
        return CommonUtils.executeCommandAsync(command)
            .then(() => Promise.resolve())
            .catch((error) =>
                Promise.reject(
                    new SfError(
                        `The command '${command}' failed to execute ${error}`
                    )
                )
            );
    }

    /**
     * Attempts to launch the browser in a booted simulator and navigates to the provided URL.
     *
     * @param udid The UDID of the simulator.
     * @param url The URL to navigate to.
     */
    public static async launchURLInBootedSimulator(
        udid: string,
        url: string
    ): Promise<void> {
        const command = `${XCRUN_CMD} simctl openurl "${udid}" ${url}`;
        CommonUtils.startCliAction(
            messages.getMessage('launchBrowserAction'),
            util.format(messages.getMessage('openBrowserWithUrlStatus'), url)
        );
        return CommonUtils.executeCommandAsync(command)
            .then(() => Promise.resolve())
            .catch((error) =>
                Promise.reject(
                    new SfError(
                        `The command '${command}' failed to execute ${error}`
                    )
                )
            );
    }

    /**
     * Attempts to launch a native app in a simulator to preview LWC components. If the app is not installed then this method will attempt to install it first.
     *
     * @param udid The UDID of the simulator.
     * @param compName Name of the LWC component.
     * @param projectDir Path to the LWC project root directory.
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param targetApp The bundle ID of the app to be launched.
     * @param targetAppArguments Extra arguments to be passed to the app upon launch.
     * @param serverAddress Optional address for the server that is serving the LWC component. This will be passed to the app as an extra argument upon launch.
     * @param serverPort Optional port for the server that is serving the LWC component. This will be passed to the app as an extra argument upon launch.
     */
    public static async launchAppInBootedSimulator(
        udid: string,
        compName: string,
        projectDir: string,
        appBundlePath: string | undefined,
        targetApp: string,
        targetAppArguments: LaunchArgument[],
        serverAddress: string | undefined,
        serverPort: string | undefined
    ): Promise<void> {
        let thePromise: Promise<{ stdout: string; stderr: string }>;
        if (appBundlePath && appBundlePath.trim().length > 0) {
            const installMsg = util.format(
                messages.getMessage('installAppStatus'),
                appBundlePath.trim()
            );
            IOSUtils.logger.info(installMsg);
            CommonUtils.startCliAction(
                messages.getMessage('launchAppAction'),
                installMsg
            );
            const installCommand = `${XCRUN_CMD} simctl install ${udid} '${appBundlePath.trim()}'`;
            thePromise = CommonUtils.executeCommandAsync(installCommand);
        } else {
            thePromise = Promise.resolve({ stdout: '', stderr: '' });
        }

        return thePromise
            .then(async () => {
                let launchArgs =
                    `${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}=${compName}` +
                    ` ${PreviewUtils.PROJECT_DIR_ARG_PREFIX}=${projectDir}`;

                if (serverAddress) {
                    launchArgs += ` ${PreviewUtils.SERVER_ADDRESS_PREFIX}=${serverAddress}`;
                }

                if (serverPort) {
                    launchArgs += ` ${PreviewUtils.SERVER_PORT_PREFIX}=${serverPort}`;
                }

                targetAppArguments.forEach((arg) => {
                    launchArgs += ` ${arg.name}=${arg.value}`;
                });

                const terminateCommand = `${XCRUN_CMD} simctl terminate "${udid}" ${targetApp}`;
                const launchCommand = `${XCRUN_CMD} simctl launch "${udid}" ${targetApp} ${launchArgs}`;

                // attempt at terminating the app first (in case it is already running) and then try to launch it again with new arguments.
                // if we hit issues with terminating, just ignore and continue.
                try {
                    const terminateMsg = util.format(
                        messages.getMessage('terminateAppStatus'),
                        targetApp
                    );
                    IOSUtils.logger.info(terminateMsg);
                    CommonUtils.updateCliAction(terminateMsg);
                    await CommonUtils.executeCommandAsync(terminateCommand);
                } catch {
                    // ignore and continue
                }

                const launchMsg = util.format(
                    messages.getMessage('launchAppStatus'),
                    targetApp
                );
                IOSUtils.logger.info(launchMsg);
                CommonUtils.updateCliAction(launchMsg);
                return CommonUtils.executeCommandAsync(launchCommand);
            })
            .then(() => Promise.resolve());
    }

    private static logger: Logger = new Logger(LOGGER_NAME);

    private static isDeviceAlreadyBootedError(error: Error): boolean {
        return error.message
            ? error.message.toLowerCase().match('state: booted') !== null
            : false;
    }
}
