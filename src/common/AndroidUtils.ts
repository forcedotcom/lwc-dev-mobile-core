/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger } from '@salesforce/core';
import * as childProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    AndroidPackage,
    AndroidPackages,
    AndroidVirtualDevice
} from './AndroidTypes';
import { Version } from './Common';
import { CommonUtils } from './CommonUtils';
import { PlatformConfig } from './PlatformConfig';
import { LaunchArgument } from './PreviewConfigFile';
import { PreviewUtils } from './PreviewUtils';

const spawn = childProcess.spawn;
type StdioOptions = childProcess.StdioOptions;

const LOGGER_NAME = 'force:lightning:local:androidutils';
const WINDOWS_OS = 'win32';
const ANDROID_SDK_MANAGER_NAME = 'sdkmanager';
const ANDROID_AVD_MANAGER_NAME = 'avdmanager';
const ANDROID_ADB_NAME = 'adb';
const DEFAULT_ADB_CONSOLE_PORT = 5554;

export enum AndroidSDKRootSource {
    androidHome = 'ANDROID_HOME',
    androidSDKRoot = 'ANDROID_SDK_ROOT'
}

export interface AndroidSDKRoot {
    rootLocation: string;
    rootSource: AndroidSDKRootSource;
}

export class AndroidUtils {
    /**
     * Initialized the logger used by AndroidUtils
     */
    public static async initializeLogger(): Promise<void> {
        AndroidUtils.logger = await Logger.child(LOGGER_NAME);
        return Promise.resolve();
    }

    /**
     * Converts a path to UNIX style path.
     *
     * @param dirPath Input path.
     * @returns UNIX style path.
     */
    public static convertToUnixPath(dirPath: string): string {
        return dirPath.replace(/[\\]+/g, '/');
    }

    /**
     * Indicates whether Android packages are cached or not.
     *
     * @returns True if cached, False otherwise.
     */
    public static isCached(): boolean {
        return !AndroidUtils.packageCache.isEmpty();
    }

    /**
     * Indicates whether user has set a value for JAVA_HOME environment variable.
     *
     * @returns True if set, False otherwise.
     */
    public static isJavaHomeSet(): boolean {
        return process.env.JAVA_HOME
            ? process.env.JAVA_HOME.trim().length > 0
            : false;
    }

    /**
     * Clears all caches that AndroidUtils uses.
     */
    public static clearCaches() {
        AndroidUtils.emulatorCommand = undefined;
        AndroidUtils.androidCmdLineToolsBin = undefined;
        AndroidUtils.androidPlatformTools = undefined;
        AndroidUtils.avdManagerCommand = undefined;
        AndroidUtils.adbShellCommand = undefined;
        AndroidUtils.sdkManagerCommand = undefined;
        AndroidUtils.sdkRoot = undefined;
        AndroidUtils.packageCache = new AndroidPackages();
    }

    /**
     * Attempt to run sdkmanager and see if it throws any exceptions. If no errors are encountered then all prerequisites are met.
     * But if an error is encountered then we'll try to see if it is due to unsupported Java version or something else.
     *
     * @returns If prerequisites are met, then returns the location of Android command line tools.
     */
    public static async androidSDKPrerequisitesCheck(): Promise<string> {
        return AndroidUtils.fetchAndroidCmdLineToolsLocation()
            .then((result) => Promise.resolve(result))
            .catch((error) => {
                const e: Error = error;
                const stack = e.stack || '';
                const idx = stack.indexOf(
                    'java.lang.NoClassDefFoundError: javax/xml/bind/annotation/XmlSchema'
                );

                if (!AndroidUtils.isJavaHomeSet()) {
                    return Promise.reject(new Error('JAVA_HOME is not set.'));
                } else if (idx !== -1) {
                    return Promise.reject(
                        new Error('unsupported Java version.')
                    );
                } else if (error.status && error.status === 127) {
                    return Promise.reject(
                        new Error(
                            `SDK Manager not found. Expected at ${AndroidUtils.getSdkManagerCommand()}`
                        )
                    );
                } else {
                    return Promise.reject(error);
                }
            });
    }

    /**
     * Attempts to fetch the location of Android command line tools.
     *
     * @returns The location of Android command line tools.
     */
    public static async fetchAndroidCmdLineToolsLocation(): Promise<string> {
        if (!AndroidUtils.getAndroidSdkRoot()) {
            return Promise.reject(new Error('Android SDK root is not set.'));
        }

        return CommonUtils.executeCommandAsync(
            `${AndroidUtils.getSdkManagerCommand()} --version`
        ).then((result) =>
            Promise.resolve(AndroidUtils.getAndroidCmdLineToolsBin())
        );
    }

    /**
     * Attempts to fetch the location of Android platform tools.
     *
     * @returns The location of Android platform tools.
     */
    public static async fetchAndroidSDKPlatformToolsLocation(): Promise<string> {
        if (!AndroidUtils.getAndroidSdkRoot()) {
            return Promise.reject(new Error('Android SDK root is not set.'));
        }

        return CommonUtils.executeCommandAsync(
            `${AndroidUtils.getAdbShellCommand()} --version`
        ).then((result) =>
            Promise.resolve(AndroidUtils.getAndroidPlatformTools())
        );
    }

    /**
     * Attempts to fetch all Android packages that are installed on a user's machine.
     *
     * @returns The installed packages.
     */
    public static async fetchInstalledPackages(): Promise<AndroidPackages> {
        if (!AndroidUtils.getAndroidSdkRoot()) {
            return Promise.reject(new Error('Android SDK root is not set.'));
        }

        if (AndroidUtils.isCached()) {
            return Promise.resolve(AndroidUtils.packageCache);
        }

        return CommonUtils.executeCommandAsync(
            `${AndroidUtils.getSdkManagerCommand()} --list`
        ).then((result) => {
            if (result.stdout && result.stdout.length > 0) {
                const packages = AndroidPackages.parseRawPackagesString(
                    result.stdout
                );
                AndroidUtils.packageCache = packages;
            }
            return Promise.resolve(AndroidUtils.packageCache);
        });
    }

    /**
     * Attempts to fetch all supported Android device types (e.g Pixel, Pixel_XL, Pixel_C)
     *
     * @returns The supported Android device types.
     */
    public static async getSupportedDevices(): Promise<string[]> {
        return Promise.resolve(
            PlatformConfig.androidConfig().supportedDeviceTypes
        );
    }

    /**
     * Attempts to fetch all available Android virtual devices.
     *
     * @returns An array of all available Android virtual devices.
     */
    public static async fetchEmulators(): Promise<AndroidVirtualDevice[]> {
        let devices: AndroidVirtualDevice[] = [];
        return CommonUtils.executeCommandAsync(
            AndroidUtils.getAvdManagerCommand() + ' list avd'
        )
            .then((result) => {
                if (result.stdout && result.stdout.length > 0) {
                    devices = AndroidVirtualDevice.parseRawString(
                        result.stdout
                    );
                }
                return Promise.resolve(devices);
            })
            .catch((error) => {
                AndroidUtils.logger.warn(error);
                return Promise.resolve(devices);
            });
    }

    /**
     * Attempts to find all Android API packages that are installed on a user's machine and that are above minSupportedRuntime version
     * (and optionally that have matching supported emulator images).
     *
     * @param mustHaveSupportedEmulatorImages Indicates whether the API packages must have matching supported emulator images.
     * @returns An array of Android API packages meeting the conditions.
     */
    public static async fetchAllAvailableApiPackages(
        mustHaveSupportedEmulatorImages: boolean
    ): Promise<AndroidPackage[]> {
        const minSupportedRuntime = Version.from(
            PlatformConfig.androidConfig().minSupportedRuntime
        );

        return AndroidUtils.fetchInstalledPackages()
            .then((allPackages) => {
                if (allPackages.isEmpty()) {
                    return Promise.reject(
                        new Error(
                            `No Android API packages are installed. Minimum supported Android API package version is ${
                                PlatformConfig.androidConfig()
                                    .minSupportedRuntime
                            }`
                        )
                    );
                }

                const matchingPlatforms = allPackages.platforms.filter((pkg) =>
                    pkg.version.sameOrNewer(minSupportedRuntime)
                );

                if (matchingPlatforms.length < 1) {
                    return Promise.reject(
                        new Error(
                            `Could not locate a supported Android API package. Minimum supported Android API package version is ${
                                PlatformConfig.androidConfig()
                                    .minSupportedRuntime
                            }`
                        )
                    );
                }

                return Promise.resolve(matchingPlatforms);
            })
            .then(async (matchingPlatforms) => {
                let results: AndroidPackage[] = [];

                if (mustHaveSupportedEmulatorImages) {
                    for (const pkg of matchingPlatforms) {
                        try {
                            const emulatorImage = await AndroidUtils.packageWithRequiredEmulatorImages(
                                pkg
                            );

                            // if it has a supported emulator image then include it
                            if (emulatorImage) {
                                results.push(pkg);
                            }
                        } catch (error) {
                            this.logger.warn(
                                `Could not find emulator image for Android API package ${pkg.path}: ${error}`
                            );
                        }
                    }
                } else {
                    results = matchingPlatforms;
                }

                // Sort the packages with latest version by negating the comparison result
                results.sort((a, b) => a.version.compare(b.version) * -1);
                return Promise.resolve(results);
            });
    }

    /**
     * Checks for and returns a supported Android API package that also has matching supported emulator images installed.
     *
     * @param apiLevel Optional parameter. When defined, it indicates a specific API level to find the API package for.
     * When not defined, the latest supported API package (with matching supported emulator images) that is installed
     * on user's machine is fetched. Defaults to undefined.
     * @returns A supported Android API package.
     */
    public static async fetchSupportedAndroidAPIPackage(
        apiLevel?: string
    ): Promise<AndroidPackage> {
        const targetRuntime: Version | undefined = apiLevel
            ? Version.from(apiLevel)
            : undefined;

        return AndroidUtils.fetchAllAvailableApiPackages(true).then(
            (packages) => {
                let matchingPlatforms = packages;
                if (targetRuntime) {
                    matchingPlatforms = packages.filter((pkg) =>
                        pkg.version.same(targetRuntime)
                    );
                    if (matchingPlatforms.length < 1) {
                        return Promise.reject(
                            new Error(
                                `Could not locate Android API package (with matching emulator images) for API level ${apiLevel}.`
                            )
                        );
                    }
                }

                if (matchingPlatforms.length < 1) {
                    return Promise.reject(
                        new Error(
                            `Could not locate a supported Android API package with matching emulator images. Minimum supported Android API package version is ${
                                PlatformConfig.androidConfig()
                                    .minSupportedRuntime
                            }`
                        )
                    );
                }

                return Promise.resolve(matchingPlatforms[0]);
            }
        );
    }

    /**
     * Attempts to fetch the Android package for a supported emulator image target (e.g. Google APIs, default, Google Play).
     *
     * @param apiLevel Optional parameter. When defined, it indicates a specific API level to find the emulator package for.
     * When not defined, the latest supported API level that is installed on user's machine is used. Defaults to undefined.
     * @returns Android package of a supported emulator.
     */
    public static async fetchSupportedEmulatorImagePackage(
        apiLevel?: string
    ): Promise<AndroidPackage> {
        let installedAndroidPackage: AndroidPackage;

        return AndroidUtils.fetchSupportedAndroidAPIPackage(apiLevel)
            .then((pkg) => {
                installedAndroidPackage = pkg;
                return AndroidUtils.packageWithRequiredEmulatorImages(
                    installedAndroidPackage
                );
            })
            .then((emulatorImage) => {
                if (emulatorImage) {
                    return Promise.resolve(emulatorImage);
                } else {
                    return Promise.reject(
                        new Error(
                            `Could not locate an emulator image. Requires any one of these [${PlatformConfig.androidConfig().supportedImages.join(
                                ','
                            )} for ${[installedAndroidPackage.platformAPI]}]`
                        )
                    );
                }
            })
            .catch((error) =>
                Promise.reject(
                    new Error(`Could not find android emulator packages.`)
                )
            );
    }

    /**
     * Returns the next available ADB port (usually to be used for launching an emulator on that port).
     *
     * @returns A number representing the next available ADB port.
     */
    public static async getNextAndroidAdbPort(): Promise<number> {
        // need to incr by 2, one for console port and next for adb
        return AndroidUtils.getCurrentAdbPort().then((adbPort) =>
            adbPort < PlatformConfig.androidConfig().defaultAdbPort
                ? Promise.resolve(PlatformConfig.androidConfig().defaultAdbPort)
                : Promise.resolve(adbPort + 2)
        );
    }

    /**
     * Checks whether an emulator with a given name is available.
     *
     * @param emulatorName Name of an emulator (e.g Pixel XL, Nexus_6_API_30).
     * @returns True if an emulator with a given name is available, False otherwise.
     */
    public static async hasEmulator(emulatorName: string): Promise<boolean> {
        return AndroidUtils.resolveEmulatorImage(
            emulatorName
        ).then((resolvedEmulator) =>
            Promise.resolve(resolvedEmulator !== undefined)
        );
    }

    /**
     * Attempts to create a new Android virtual device.
     *
     * @param emulatorName Name to be used for the emulator (e.g Pixel XL, Nexus_6_API_30).
     * @param emulatorImage An emulator image type to be used (e.g google_apis, default, google_apis_playstore)
     * @param platformAPI A platform API to be used (e.g android-30, android-28)
     * @param device A device type to be used (e.g pixel, pixel_xl, pixel_c)
     * @param abi The ABI to be used (e.g x86, x86_64)
     */
    public static async createNewVirtualDevice(
        emulatorName: string,
        emulatorImage: string,
        platformAPI: string,
        device: string,
        abi: string
    ): Promise<void> {
        // Just like Android Studio AVD Manager GUI interface, replace blank spaces with _ so that the ID of this AVD
        // doesn't have blanks (since that's not allowed). AVD Manager will automatially replace _ back with blank
        // to generate user friendly display names.
        const resolvedName = emulatorName.replace(/ /gi, '_');

        const createAvdCommand = `${AndroidUtils.getAvdManagerCommand()} create avd -n ${resolvedName} --force -k ${AndroidUtils.systemImagePath(
            platformAPI,
            emulatorImage,
            abi
        )} --device ${device} --abi ${abi}`;

        return new Promise((resolve, reject) => {
            try {
                const child = AndroidUtils.spawnChild(createAvdCommand);
                if (child) {
                    child.stdin.setDefaultEncoding('utf8');
                    child.stdin.write('no');
                    child.stdout.on('data', () => {
                        setTimeout(() => {
                            resolve(true);
                        }, 3000);
                    });
                    child.stdout.on('exit', () => resolve(true));
                    child.stderr.on('error', (err) => {
                        reject(
                            new Error(
                                `Could not create emulator. Command failed: ${createAvdCommand}\n${err}`
                            )
                        );
                    });
                    child.stderr.on('data', (data) => {
                        const msg = data.toString() as string;
                        if (msg && msg.includes('Error:')) {
                            reject(
                                new Error(
                                    `Could not create emulator. Command failed: ${createAvdCommand}\n${data}`
                                )
                            );
                        }
                    });
                } else {
                    reject(new Error(`Could not create emulator.`));
                }
            } catch (error) {
                reject(new Error(`Could not create emulator. ${error}`));
            }
        }).then((resolve) => AndroidUtils.updateEmulatorConfig(emulatorName));
    }

    /**
     * Attempts to launch an emulator and returns the ADB port that the emulator was launched on.
     *
     * @param emulatorName Name of the emulator to be launched (e.g Pixel XL, Nexus_6_API_30).
     * @param requestedPortNumber The ADB port to launch the emulator on. Note that this may not be the actual port that the emulator starts on.
     * @param writable Whether the emulator should launch with the '-writable-system' flag.
     * @returns The actual ADB port that the emulator was launched on.
     */
    public static async startEmulator(
        emulatorName: string,
        requestedPortNumber: number,
        writable: boolean = false
    ): Promise<number> {
        return AndroidUtils.resolveEmulatorImage(emulatorName).then(
            (resolvedEmulator) => {
                // This shouldn't happen b/c we make sure an emulator exists
                // before calling this method, but keeping it just in case
                if (resolvedEmulator === undefined) {
                    return Promise.reject(
                        new Error(`Invalid emulator: ${emulatorName}`)
                    );
                }

                if (AndroidUtils.isEmulatorAlreadyRunning(resolvedEmulator)) {
                    // get port number from emu-launch-params.txt
                    const portNumber = AndroidUtils.resolveEmulatorPort(
                        resolvedEmulator,
                        requestedPortNumber
                    );
                    return Promise.resolve(portNumber);
                }

                try {
                    // We intentionally use spawn and ignore stdio here b/c emulator command can
                    // spit out a bunch of output to stderr where they are not really errors. This
                    // is specially true on Windows platform. So istead we spawn the process to launch
                    // the emulator and later attempt at polling the emulator to see if it failed to boot.
                    const child = spawn(
                        `${AndroidUtils.getEmulatorCommand()} @${resolvedEmulator} -port ${requestedPortNumber}${
                            writable ? ' -writable-system' : ''
                        }`,
                        { detached: true, shell: true, stdio: 'ignore' }
                    );
                    child.unref();
                    return Promise.resolve(requestedPortNumber);
                } catch (error) {
                    return Promise.reject(error);
                }
            }
        );
    }

    /**
     * Attempts to wait for an Android virtual device to finish booting on an ADB port.
     *
     * @param portNumber The ADB port of the Android virtual device.
     */
    public static async waitUntilDeviceIsReady(
        portNumber: number
    ): Promise<void> {
        const quote = process.platform === WINDOWS_OS ? '"' : "'";
        const bootCmd = `shell ${quote}while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done;${quote}`;
        const command = `${AndroidUtils.getAdbShellCommand()} -s emulator-${portNumber} wait-for-device ${bootCmd}`;
        const timeout = PlatformConfig.androidConfig()
            .deviceBootReadinessWaitTime;

        const waitUntilReadyPromise = CommonUtils.promiseWithTimeout(
            timeout,
            CommonUtils.executeCommandAsync(command),
            `Timeout waiting for emulator-${portNumber} to boot.`
        );

        return waitUntilReadyPromise.then(() => Promise.resolve());
    }

    /**
     * Attempts to launch a URL in the emulator browser.
     *
     * @param url The URL to be launched.
     * @param portNumber The ADB port of an Android virtual device.
     */
    public static async launchURLIntent(
        url: string,
        portNumber: number
    ): Promise<void> {
        const openUrlCommand = `${AndroidUtils.getAdbShellCommand()} -s emulator-${portNumber} shell am start -a android.intent.action.VIEW -d ${url}`;
        CommonUtils.startCliAction(
            'Launching',
            `Opening browser with url ${url}`
        );
        return CommonUtils.executeCommandAsync(openUrlCommand).then(() =>
            Promise.resolve()
        );
    }

    /**
     * Attempts to launch a native app in an emulator to preview LWC components. If the app is not installed then this method will attempt to install it first.
     *
     * @param compName Name of the LWC component.
     * @param projectDir Path to the LWC project root directory.
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param targetApp The bundle ID of the app to be launched.
     * @param targetAppArguments Extra arguments to be passed to the app upon launch.
     * @param launchActivity Activity name to be used for launching the app.
     * @param portNumber The ADB port of an Android virtual device.
     * @param serverAddress Optional address for the server that is serving the LWC component. This will be passed to the app as an extra argument upon launch.
     * @param serverPort Optional port for the server that is serving the LWC component. This will be passed to the app as an extra argument upon launch.
     */
    public static async launchNativeApp(
        compName: string,
        projectDir: string,
        appBundlePath: string | undefined,
        targetApp: string,
        targetAppArguments: LaunchArgument[],
        launchActivity: string,
        portNumber: number,
        serverAddress: string | undefined,
        serverPort: string | undefined
    ): Promise<void> {
        let thePromise: Promise<{ stdout: string; stderr: string }>;
        if (appBundlePath && appBundlePath.trim().length > 0) {
            const installMsg = `Installing app ${appBundlePath.trim()} to emulator`;
            AndroidUtils.logger.info(installMsg);
            CommonUtils.startCliAction('Launching', installMsg);
            const pathQuote = process.platform === WINDOWS_OS ? '"' : "'";
            const installCommand = `${AndroidUtils.getAdbShellCommand()} -s emulator-${portNumber} install -r -t ${pathQuote}${appBundlePath.trim()}${pathQuote}`;
            thePromise = CommonUtils.executeCommandAsync(installCommand);
        } else {
            thePromise = Promise.resolve({ stdout: '', stderr: '' });
        }

        return thePromise
            .then(() => {
                let launchArgs =
                    `--es "${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}" "${compName}"` +
                    ` --es "${PreviewUtils.PROJECT_DIR_ARG_PREFIX}" "${projectDir}"`;

                if (serverAddress) {
                    launchArgs += ` --es "${PreviewUtils.SERVER_ADDRESS_PREFIX}" "${serverAddress}"`;
                }

                if (serverPort) {
                    launchArgs += ` --es "${PreviewUtils.SERVER_PORT_PREFIX}" "${serverPort}"`;
                }

                targetAppArguments.forEach((arg) => {
                    launchArgs += ` --es "${arg.name}" "${arg.value}"`;
                });

                const launchCommand =
                    `${AndroidUtils.getAdbShellCommand()} -s emulator-${portNumber}` +
                    ` shell am start -S -n "${targetApp}/${launchActivity}"` +
                    ' -a android.intent.action.MAIN' +
                    ' -c android.intent.category.LAUNCHER' +
                    ` ${launchArgs}`;

                const launchMsg = `Launching app ${targetApp} in emulator`;
                AndroidUtils.logger.info(launchMsg);
                CommonUtils.startCliAction('Launching', launchMsg);

                return CommonUtils.executeCommandAsync(launchCommand);
            })
            .then(() => Promise.resolve());
    }

    /**
     * Given an emulator name and a requested emulator port, this method checks to see if the emulator
     * is indeed launched on that port and if not then it will return the actual port.
     *
     * @param emulatorName Name of the emulator
     * @param requestedPortNumber Requested port for an emulator.
     * @returns The actual port for an emulator.
     */
    public static resolveEmulatorPort(
        emulatorName: string,
        requestedPortNumber: number
    ): number {
        // Just like Android Studio AVD Manager GUI interface, replace blank spaces with _ so that the ID of this AVD
        // doesn't have blanks (since that's not allowed). AVD Manager will automatially replace _ back with blank
        // to generate user friendly display names.
        const resolvedName = emulatorName.replace(/ /gi, '_');

        // if config file does not exist, its created but not launched so use the requestedPortNumber
        // else we will read it from emu-launch-params.txt file.
        const launchFileName = CommonUtils.resolveUserHomePath(
            path.join(
                `~`,
                '.android',
                'avd',
                `${resolvedName}.avd`,
                'emu-launch-params.txt'
            )
        );
        let adjustedPort = requestedPortNumber;
        if (fs.existsSync(launchFileName)) {
            const data = fs.readFileSync(launchFileName, 'utf8').toString();
            // find the following string in file, absence of port indicates use of default port
            // -port
            // 5572
            adjustedPort = DEFAULT_ADB_CONSOLE_PORT;
            const portArgumentString = '-port';
            const portStringIndx = data.indexOf(portArgumentString);
            if (portStringIndx > -1) {
                const portIndx = data.indexOf(
                    '55',
                    portStringIndx + portArgumentString.length
                );
                if (portIndx > -1) {
                    const parsedPort = parseInt(
                        data.substring(portIndx, portIndx + 4),
                        10
                    );
                    // port numbers must be in the range if present
                    if (parsedPort >= 5554 && parsedPort <= 5584) {
                        adjustedPort = parsedPort;
                    }
                }
            }
        }
        return adjustedPort;
    }

    // This method is public for testing purposes.
    public static async updateEmulatorConfig(
        emulatorName: string
    ): Promise<void> {
        return AndroidUtils.readEmulatorConfig(emulatorName).then((config) => {
            if (config.size === 0) {
                // If we cannot edit the AVD config, fail silently.
                // This will be a degraded experience but should still work.
                return Promise.resolve();
            }

            // Ensure value for runtime.network.latency is in lowercase.
            // Otherwise the device may not be launchable via AVD Manager.
            const networkLatency = config.get('runtime.network.latency');
            if (networkLatency) {
                config.set(
                    'runtime.network.latency',
                    networkLatency.trim().toLocaleLowerCase()
                );
            }

            // Ensure value for runtime.network.speed is in lowercase.
            // Otherwise the device may not be launchable via AVD Manager.
            const networkSpeed = config.get('runtime.network.speed');
            if (networkSpeed) {
                config.set(
                    'runtime.network.speed',
                    networkSpeed.trim().toLocaleLowerCase()
                );
            }

            // Utilize hardware.
            config.set('hw.keyboard', 'yes');
            config.set('hw.gpu.mode', 'auto');
            config.set('hw.gpu.enabled', 'yes');

            // Give emulator the appropriate skin.
            let skinName = config.get('hw.device.name') || '';
            if (skinName) {
                if (skinName === 'pixel') {
                    skinName = 'pixel_silver';
                } else if (skinName === 'pixel_xl') {
                    skinName = 'pixel_xl_silver';
                }
                const sdkRoot = AndroidUtils.getAndroidSdkRoot();
                config.set('skin.name', skinName);
                config.set(
                    'skin.path',
                    `${
                        (sdkRoot && sdkRoot.rootLocation) || ''
                    }/skins/${skinName}`
                );
                config.set('skin.dynamic', 'yes');
                config.set('showDeviceFrame', 'yes');
            }

            AndroidUtils.writeEmulatorConfig(emulatorName, config);
            return Promise.resolve();
        });
    }

    /**
     * Attempts to get the path to Android platform tools directory.
     *
     * @returns The path to Android platform tools directory.
     */
    public static getAndroidPlatformTools(): string {
        if (!AndroidUtils.androidPlatformTools) {
            const sdkRoot = AndroidUtils.getAndroidSdkRoot();
            AndroidUtils.androidPlatformTools = path.join(
                (sdkRoot && sdkRoot.rootLocation) || '',
                'platform-tools'
            );
        }

        return AndroidUtils.androidPlatformTools;
    }

    /**
     * Attempts to determine the root directory path for Android SDK. It will first look for
     * ANDROID_HOME environment variable. If it exists and point to a valid directory then
     * its value is used. Otherwise it falls back to using ANDROID_SDK_ROOT environment variable.
     *
     * @returns The root directory path for Android SDK.
     */
    public static getAndroidSdkRoot(): AndroidSDKRoot | undefined {
        if (!AndroidUtils.sdkRoot) {
            const home =
                process.env.ANDROID_HOME && process.env.ANDROID_HOME.trim();

            const root =
                process.env.ANDROID_SDK_ROOT &&
                process.env.ANDROID_SDK_ROOT.trim();

            if (home && fs.existsSync(home)) {
                AndroidUtils.sdkRoot = {
                    rootLocation: home,
                    rootSource: AndroidSDKRootSource.androidHome
                };
            } else if (root && fs.existsSync(root)) {
                AndroidUtils.sdkRoot = {
                    rootLocation: root,
                    rootSource: AndroidSDKRootSource.androidSDKRoot
                };
            }
        }

        return AndroidUtils.sdkRoot;
    }

    /**
     * Attempts to get the path to Android command line tools BIN directory. If multiple versions
     * of the command line tool are present, it will attempt to pick the latest version.
     *
     * @returns The path to Android command line tools BIN directory.
     */
    public static getAndroidCmdLineToolsBin(): string {
        if (!AndroidUtils.androidCmdLineToolsBin) {
            const sdkRoot = AndroidUtils.getAndroidSdkRoot();
            AndroidUtils.androidCmdLineToolsBin = path.join(
                (sdkRoot && sdkRoot.rootLocation) || '',
                'cmdline-tools'
            );

            // It is possible to install various versions of the command line tools side-by-side
            // In this case the directory structure would be based on tool versions:
            //
            //    cmdline-tools/1.0/bin
            //    cmdline-tools/2.1/bin
            //    cmdline-tools/3.0/bin
            //    cmdline-tools/4.0-beta01/bin
            //    cmdline-tools/latest/bin
            //
            // Below, we get the list of all directories, then sort them descendingly and grab the first one.
            // This would either resolve to 'latest' or the latest versioned folder name
            if (fs.existsSync(AndroidUtils.androidCmdLineToolsBin)) {
                const content = fs.readdirSync(
                    AndroidUtils.androidCmdLineToolsBin
                );
                if (content && content.length > 0) {
                    content.sort((a, b) => (a > b ? -1 : 1));

                    AndroidUtils.androidCmdLineToolsBin = path.join(
                        AndroidUtils.androidCmdLineToolsBin,
                        content[0],
                        'bin'
                    );
                }
            }
        }

        return AndroidUtils.androidCmdLineToolsBin;
    }

    /**
     * Attempts to get the path to the emulator command executable.
     *
     * @returns The path to the emulator command executable.
     */
    public static getEmulatorCommand(): string {
        if (!AndroidUtils.emulatorCommand) {
            const sdkRoot = AndroidUtils.getAndroidSdkRoot();
            AndroidUtils.emulatorCommand = path.join(
                (sdkRoot && sdkRoot.rootLocation) || '',
                'emulator',
                'emulator'
            );
        }

        return AndroidUtils.emulatorCommand;
    }

    /**
     * Attempts to get the path to the AVD manager command executable.
     *
     * @returns The path to the AVD manager command executable.
     */
    public static getAvdManagerCommand(): string {
        if (!AndroidUtils.avdManagerCommand) {
            AndroidUtils.avdManagerCommand = path.join(
                AndroidUtils.getAndroidCmdLineToolsBin(),
                ANDROID_AVD_MANAGER_NAME
            );
        }

        return AndroidUtils.avdManagerCommand;
    }

    /**
     * Attempts to get the path to the ADB command executable.
     *
     * @returns The path to the ADB command executable.
     */
    public static getAdbShellCommand(): string {
        if (!AndroidUtils.adbShellCommand) {
            AndroidUtils.adbShellCommand = path.join(
                AndroidUtils.getAndroidPlatformTools(),
                ANDROID_ADB_NAME
            );
        }

        return AndroidUtils.adbShellCommand;
    }

    /**
     * Attempts to get the path to the SDKMANAGER command executable.
     *
     * @returns The path to the SDKMANAGER command executable.
     */
    public static getSdkManagerCommand(): string {
        if (!AndroidUtils.sdkManagerCommand) {
            AndroidUtils.sdkManagerCommand = path.join(
                AndroidUtils.getAndroidCmdLineToolsBin(),
                ANDROID_SDK_MANAGER_NAME
            );
        }

        return AndroidUtils.sdkManagerCommand;
    }

    private static logger: Logger = new Logger(LOGGER_NAME);
    private static packageCache: AndroidPackages = new AndroidPackages();
    private static emulatorCommand: string | undefined;
    private static androidCmdLineToolsBin: string | undefined;
    private static androidPlatformTools: string | undefined;
    private static avdManagerCommand: string | undefined;
    private static adbShellCommand: string | undefined;
    private static sdkManagerCommand: string | undefined;
    private static sdkRoot: AndroidSDKRoot | undefined;

    private static async getCurrentAdbPort(): Promise<number> {
        let adbPort = 0;
        const command = `${AndroidUtils.getAdbShellCommand()} devices`;
        return CommonUtils.executeCommandAsync(command)
            .then((result) => {
                if (result.stdout) {
                    let listOfDevices: number[] = result.stdout
                        .split(os.EOL)
                        .filter((avd: string) =>
                            avd.toLowerCase().startsWith('emulator')
                        )
                        .map((value) => {
                            const array = value.match(/\d+/);
                            const portNumbers = array ? array.map(Number) : [0];
                            return portNumbers[0];
                        });
                    if (listOfDevices && listOfDevices.length > 0) {
                        listOfDevices = listOfDevices.sort().reverse();
                        adbPort = listOfDevices[0];
                    }
                }
                return Promise.resolve(adbPort);
            })
            .catch((error) => {
                AndroidUtils.logger.error(error);
                return Promise.resolve(adbPort);
            });
    }

    private static async packageWithRequiredEmulatorImages(
        androidPackage: AndroidPackage
    ): Promise<AndroidPackage | undefined> {
        const installedSystemImages = await AndroidUtils.fetchInstalledSystemImages(
            androidPackage.platformAPI
        );
        const platformAPI = androidPackage.platformAPI;

        for (const architecture of PlatformConfig.androidConfig()
            .supportedArchitectures) {
            for (const image of PlatformConfig.androidConfig()
                .supportedImages) {
                for (const img of installedSystemImages) {
                    if (
                        img.path.match(
                            `(${platformAPI};${image};${architecture})`
                        ) !== null
                    ) {
                        return Promise.resolve(img);
                    }
                }
            }
        }

        return Promise.resolve(undefined);
    }

    private static systemImagePath(
        platformAPI: string,
        emuImage: string,
        abi: string
    ): string {
        const pathName = `system-images;${platformAPI};${emuImage};${abi}`;
        if (process.platform === WINDOWS_OS) {
            return pathName;
        }
        return `'${pathName}'`;
    }

    private static async fetchInstalledSystemImages(
        androidApi: string
    ): Promise<AndroidPackage[]> {
        return AndroidUtils.fetchInstalledPackages().then(
            (packages) => packages.systemImages
        );
    }

    private static isEmulatorAlreadyRunning(emulatorName: string): boolean {
        const findProcessCommand =
            process.platform === WINDOWS_OS
                ? `wmic process where "CommandLine Like \'%qemu-system-x86_64%\'" get CommandLine | findstr /V "wmic process where" | findstr "${emulatorName}"`
                : `ps -ax | grep qemu-system-x86_64 | grep ${emulatorName} | grep -v grep`;

        // ram.img.dirty is a one byte file created when avd is started and removed when avd is stopped.
        const launchFileName = CommonUtils.resolveUserHomePath(
            path.join(
                `~`,
                '.android',
                'avd',
                `${emulatorName}.avd`,
                'snapshots',
                'default_boot',
                'ram.img.dirty'
            )
        );

        // first ensure that ram.img.dirty exists
        if (!fs.existsSync(launchFileName)) {
            return false;
        }

        // then ensure that the process is also running for the selected emulator
        let foundProcess = false;
        try {
            const findResult = CommonUtils.executeCommandSync(
                findProcessCommand
            );
            foundProcess = findResult != null && findResult.trim().length > 0;
        } catch (error) {
            AndroidUtils.logger.debug(
                `Unable to find the emulator process: ${error}`
            );
        }
        return foundProcess;
    }

    // NOTE: detaching a process in windows seems to detach the streams. Prevent spawn from detaching when
    // used in Windows OS for special handling of some commands (adb).
    private static spawnChild(
        command: string
    ): childProcess.ChildProcessWithoutNullStreams {
        if (process.platform === WINDOWS_OS) {
            const child = spawn(command, { shell: true });
            return child;
        } else {
            const child = spawn(command, { shell: true, detached: true });
            child.unref();
            return child;
        }
    }

    // The user can provide us with emulator name as an ID (Pixel_XL) or as display name (Pixel XL).
    // This method can be used to resolve a display name back to an id since emulator commands
    // work with IDs not display names.
    private static async resolveEmulatorImage(
        emulatorName: string
    ): Promise<string | undefined> {
        const emulatorDisplayName = emulatorName.replace(/[_-]/gi, ' ').trim(); // eg. Pixel_XL --> Pixel XL, tv-emulator --> tv emulator

        return CommonUtils.executeCommandAsync(
            `${AndroidUtils.getEmulatorCommand()} -list-avds`
        )
            .then((result) => {
                const listOfAVDs = result.stdout.split(os.EOL);
                for (const avd of listOfAVDs) {
                    const avdDisplayName = avd.replace(/[_-]/gi, ' ').trim();

                    if (
                        avd === emulatorName ||
                        avdDisplayName === emulatorDisplayName
                    ) {
                        return Promise.resolve(avd.trim());
                    }
                }
                return Promise.resolve(undefined);
            })
            .catch((error) => {
                AndroidUtils.logger.error(error);
                return Promise.resolve(undefined);
            });
    }

    private static async readEmulatorConfig(
        emulatorName: string
    ): Promise<Map<string, string>> {
        const filePath = CommonUtils.resolveUserHomePath(
            path.join(
                `~`,
                '.android',
                'avd',
                `${emulatorName}.avd`,
                'config.ini'
            )
        );
        try {
            const configFile = fs.readFileSync(filePath, 'utf8');
            const configMap = new Map();
            for (const line of configFile.split('\n')) {
                const config = line.split('=');
                if (config.length > 1) {
                    configMap.set(config[0], config[1]);
                }
            }

            return configMap;
        } catch (error) {
            AndroidUtils.logger.warn(
                'Unable to read emulator config at: ' + filePath
            );
            return new Map<string, string>();
        }
    }

    private static writeEmulatorConfig(
        emulatorName: string,
        config: Map<string, string>
    ): void {
        let configString = '';
        // This looks wrong, but the callback signature of forEach is function(value,key,map).
        config.forEach((value, key) => {
            configString += key + '=' + value + '\n';
        });
        const filePath = CommonUtils.resolveUserHomePath(
            path.join(
                `~`,
                '.android',
                'avd',
                `${emulatorName}.avd`,
                'config.ini'
            )
        );
        try {
            fs.writeFileSync(filePath, configString, 'utf8');
        } catch (error) {
            // If we cannot edit the AVD config, fail silently.
            // This will be a degraded experience but should still work.
            AndroidUtils.logger.warn(
                'Unable to write emulator config at: ' + filePath
            );
        }
    }
}
