/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import * as childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Logger, Messages, SfError } from '@salesforce/core';
import { AndroidPackage, AndroidPackages } from './AndroidTypes.js';
import { Version } from './Common.js';
import { CommonUtils } from './CommonUtils.js';
import { PlatformConfig } from './PlatformConfig.js';
import { LaunchArgument } from './device/BaseDevice.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

const WINDOWS_OS = 'win32';
const ANDROID_SDK_MANAGER_NAME = 'sdkmanager';
const ANDROID_AVD_MANAGER_NAME = 'avdmanager';
const ANDROID_ADB_NAME = 'adb';

export enum AndroidSDKRootSource {
    androidHome = 'ANDROID_HOME',
    androidSDKRoot = 'ANDROID_SDK_ROOT'
}

export type AndroidSDKRoot = {
    rootLocation: string;
    rootSource: AndroidSDKRootSource;
};

export class AndroidUtils {
    private static packageCache: AndroidPackages = new AndroidPackages();
    private static emulatorCommand: string | undefined;
    private static androidCmdLineToolsBin: string | undefined;
    private static androidPlatformTools: string | undefined;
    private static avdManagerCommand: string | undefined;
    private static adbShellCommand: string | undefined;
    private static sdkManagerCommand: string | undefined;
    private static sdkRoot: AndroidSDKRoot | undefined;

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
        return process.env.JAVA_HOME ? process.env.JAVA_HOME.trim().length > 0 : false;
    }

    /**
     * Clears all caches that AndroidUtils uses.
     */
    public static clearCaches(): void {
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
    public static async androidSDKPrerequisitesCheck(logger?: Logger): Promise<string> {
        return AndroidUtils.fetchAndroidCmdLineToolsLocation(logger)
            .then((result) => Promise.resolve(result))
            .catch((error) => {
                if (!AndroidUtils.isJavaHomeSet()) {
                    return Promise.reject(new SfError('JAVA_HOME is not set.'));
                } else if (
                    ((error as Error).stack ?? '').includes(
                        'java.lang.NoClassDefFoundError: javax/xml/bind/annotation/XmlSchema'
                    )
                ) {
                    return Promise.reject(new SfError('unsupported Java version.'));
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                } else if (error.status === 127) {
                    return Promise.reject(
                        new SfError(`SDK Manager not found. Expected at ${AndroidUtils.getSdkManagerCommand()}`)
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
    public static async fetchAndroidCmdLineToolsLocation(logger?: Logger): Promise<string> {
        if (!AndroidUtils.getAndroidSdkRoot()) {
            return Promise.reject(new SfError('Android SDK root is not set.'));
        }

        return CommonUtils.executeCommandAsync(`${AndroidUtils.getSdkManagerCommand()} --version`, logger).then(() =>
            Promise.resolve(AndroidUtils.getAndroidCmdLineToolsBin())
        );
    }

    /**
     * Attempts to fetch the location of Android platform tools.
     *
     * @returns The location of Android platform tools.
     */
    public static async fetchAndroidSDKPlatformToolsLocation(logger?: Logger): Promise<string> {
        if (!AndroidUtils.getAndroidSdkRoot()) {
            return Promise.reject(new SfError('Android SDK root is not set.'));
        }

        return CommonUtils.executeCommandAsync(
            `${AndroidUtils.getAdbShellCommand()} --version`,
            logger
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ).then((result) => Promise.resolve(AndroidUtils.getAndroidPlatformTools()));
    }

    /**
     * Attempts to fetch all Android packages that are installed on a user's machine.
     *
     * @returns The installed packages.
     */
    public static async fetchInstalledPackages(logger?: Logger): Promise<AndroidPackages> {
        if (!AndroidUtils.getAndroidSdkRoot()) {
            return Promise.reject(new SfError('Android SDK root is not set.'));
        }

        if (AndroidUtils.isCached()) {
            logger?.debug('fetchInstalledPackages(): returning cached packages.');
            return Promise.resolve(AndroidUtils.packageCache);
        }

        logger?.debug('fetchInstalledPackages(): Packages not cached. Retrieving.');
        return CommonUtils.executeCommandAsync(`${AndroidUtils.getSdkManagerCommand()} --list`, logger).then(
            (result) => {
                if (result.stdout && result.stdout.length > 0) {
                    const packages = AndroidPackages.parseRawPackagesString(result.stdout, logger);
                    AndroidUtils.packageCache = packages;
                }
                logger?.debug(`fetchInstalledPackages(): Retrieved packages:\n${AndroidUtils.packageCache.toString()}`);
                return Promise.resolve(AndroidUtils.packageCache);
            }
        );
    }

    /**
     * Attempts to fetch all supported Android device types (e.g Pixel, Pixel_XL, Pixel_C)
     *
     * @returns The supported Android device types.
     */
    public static async getSupportedDeviceTypes(): Promise<string[]> {
        return Promise.resolve(PlatformConfig.androidConfig().supportedDeviceTypes);
    }

    /**
     * Attempts to find all Android API packages that are installed on a user's machine and that are above minSupportedRuntime version
     * (and optionally that have matching supported emulator images).
     *
     * @param mustHaveSupportedEmulatorImages Indicates whether the API packages must have matching supported emulator images.
     * @returns An array of Android API packages meeting the conditions.
     */
    public static async fetchAllAvailableApiPackages(
        mustHaveSupportedEmulatorImages: boolean,
        logger?: Logger
    ): Promise<AndroidPackage[]> {
        const configuredMinSupportedRuntime = PlatformConfig.androidConfig().minSupportedRuntime;
        const minSupportedRuntime = Version.from(configuredMinSupportedRuntime);
        if (minSupportedRuntime === null) {
            return Promise.reject(new SfError(`${configuredMinSupportedRuntime} is not a supported version format.`));
        }
        logger?.debug(`fetchAllAvailableApiPackages(): minSupportedRuntime: ${minSupportedRuntime.toString()}`);

        return AndroidUtils.fetchInstalledPackages(logger)
            .then((allPackages) => {
                if (allPackages.isEmpty()) {
                    return Promise.reject(
                        new SfError(
                            `No Android API packages are installed. Minimum supported Android API package version is ${configuredMinSupportedRuntime}`
                        )
                    );
                }

                const matchingPlatforms = allPackages.platforms.filter((pkg) =>
                    Version.sameOrNewer(pkg.version, minSupportedRuntime)
                );
                logger?.debug(
                    `fetchAllAvailableApiPackages(): Installed platforms with versions >= ${minSupportedRuntime.toString()}:\n${AndroidPackages.packageArrayAsString(
                        matchingPlatforms
                    )}`
                );

                if (matchingPlatforms.length < 1) {
                    return Promise.reject(
                        new SfError(
                            `Could not locate a supported Android API package. Minimum supported Android API package version is ${configuredMinSupportedRuntime}`
                        )
                    );
                }

                return Promise.resolve(matchingPlatforms);
            })
            .then(async (matchingPlatforms) => {
                let results: AndroidPackage[] = [];

                logger?.debug(
                    `fetchAllAvailableApiPackages(): mustHaveSupportedEmulatorImages: ${mustHaveSupportedEmulatorImages}`
                );
                if (mustHaveSupportedEmulatorImages) {
                    for (const pkg of matchingPlatforms) {
                        try {
                            // eslint-disable-next-line no-await-in-loop
                            const emulatorImage = await AndroidUtils.packageWithRequiredEmulatorImages(pkg, logger);

                            // if it has a supported emulator image then include it
                            if (emulatorImage) {
                                logger?.debug(`Found supported emulator for platform: ${pkg.toString()}`);
                                results.push(pkg);
                            } else {
                                logger?.debug(
                                    `fetchAllAvailableApiPackages(): Package does not have an associated emulator image: ${pkg.toString()}`
                                );
                            }
                        } catch (error) {
                            logger?.warn(
                                `Could not find emulator image for Android API package ${pkg.path}: ${(
                                    error as Error
                                ).toString()}`
                            );
                        }
                    }
                } else {
                    results = matchingPlatforms;
                }

                // Sort the packages with latest version by negating the comparison result
                results.sort((a, b) => Version.compare(a.version, b.version) * -1);
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
    public static async fetchSupportedAndroidAPIPackage(apiLevel?: string, logger?: Logger): Promise<AndroidPackage> {
        let targetRuntime: Version | string | undefined;
        if (apiLevel) {
            const parsedVersion = Version.from(apiLevel);
            if (parsedVersion === null) {
                logger?.warn(
                    `fetchSupportedAndroidAPIPackage(): '${apiLevel}' does not follow semantic versioning format... will consider it as a codename.`
                );
                targetRuntime = apiLevel;
            } else {
                targetRuntime = parsedVersion;
            }
        }

        return AndroidUtils.fetchAllAvailableApiPackages(true, logger).then((packages) => {
            let matchingPlatforms = packages;
            if (targetRuntime) {
                matchingPlatforms = packages.filter((pkg) => Version.same(pkg.version, targetRuntime));
                if (matchingPlatforms.length < 1) {
                    return Promise.reject(
                        new SfError(
                            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                            `Could not locate Android API package (with matching emulator images) for API level ${apiLevel}.`
                        )
                    );
                }
            }

            if (matchingPlatforms.length < 1) {
                return Promise.reject(
                    new SfError(
                        `Could not locate a supported Android API package with matching emulator images. Minimum supported Android API package version is ${
                            PlatformConfig.androidConfig().minSupportedRuntime
                        }`
                    )
                );
            }

            return Promise.resolve(matchingPlatforms[0]);
        });
    }

    /**
     * Attempts to fetch the Android package for a supported emulator image target (e.g. Google APIs, default, Google Play).
     *
     * @param apiLevel Optional parameter. When defined, it indicates a specific API level to find the emulator package for.
     * When not defined, the latest supported API level that is installed on user's machine is used. Defaults to undefined.
     * @returns Android package of a supported emulator.
     */
    public static async fetchSupportedEmulatorImagePackage(
        apiLevel?: string,
        logger?: Logger
    ): Promise<AndroidPackage> {
        let installedAndroidPackage: AndroidPackage;

        return AndroidUtils.fetchSupportedAndroidAPIPackage(apiLevel, logger)
            .then((pkg) => {
                installedAndroidPackage = pkg;
                return AndroidUtils.packageWithRequiredEmulatorImages(installedAndroidPackage, logger);
            })
            .then((emulatorImage) => {
                if (emulatorImage) {
                    return Promise.resolve(emulatorImage);
                } else {
                    return Promise.reject(
                        new SfError(
                            `Could not locate an emulator image. Requires any one of these [${PlatformConfig.androidConfig().supportedImages.join(
                                ','
                            )} for ${installedAndroidPackage.platformAPI}]`
                        )
                    );
                }
            })
            .catch((error) => {
                logger?.error(`Could not find android emulator packages.\n${error}`);
                return Promise.reject(new SfError('Could not find android emulator packages.'));
            });
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
        abi: string,
        logger?: Logger
    ): Promise<void> {
        // Just like Android Studio AVD Manager GUI interface, replace blank spaces with _ so that the ID of this AVD
        // doesn't have blanks (since that's not allowed). AVD Manager will automatically replace _ back with blank
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
                            new SfError(
                                `Could not create emulator. Command failed: ${createAvdCommand}\n${err.message}`
                            )
                        );
                    });
                    child.stderr.on('data', (data: Buffer) => {
                        if (data.includes('Error:')) {
                            reject(
                                new SfError(
                                    `Could not create emulator. Command failed: ${createAvdCommand}\n${data.toString()}`
                                )
                            );
                        }
                    });
                } else {
                    reject(new SfError('Could not create emulator.'));
                }
            } catch (error) {
                reject(new SfError(`Could not create emulator. ${(error as Error).toString()}`));
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        }).then((resolve) => AndroidUtils.updateEmulatorConfig(resolvedName, logger));
    }

    /**
     * Determines if an emulator was launched with -writable-system parameter by looking at its emu-launch-params.txt file.
     *
     * @param portNumber The ADB port of the Android virtual device.
     * @returns A boolean indicating whether the emulator on the given port was launched with -writable-system parameter
     */
    public static async isEmulatorSystemWritable(portNumber: number, logger?: Logger): Promise<boolean> {
        try {
            await AndroidUtils.ensureValidEmulatorAuthToken(logger);

            const emuPath = (await AndroidUtils.executeAdbCommand('emu avd path', portNumber, logger))
                .split('\n')[0]
                .trim();

            const paramFile = path.join(emuPath, 'emu-launch-params.txt');

            const launchParams = fs.readFileSync(paramFile, 'utf8');
            return launchParams.includes('-writable-system');
        } catch (error) {
            logger?.warn(`Unable to determine if emulator is system writable: ${(error as Error).toString()}`);
        }

        return false;
    }

    /**
     * Given an emulator that is running on a port, it returns the name of the AVD that is running on that port.
     *
     * @param portNumber The ADB port of the Android virtual device.
     * @returns The name of the AVD that is running on that specified port.
     */
    public static async fetchEmulatorNameFromPort(portNumber: number, logger?: Logger): Promise<string> {
        return AndroidUtils.ensureValidEmulatorAuthToken(logger)
            .then(() => AndroidUtils.executeAdbCommand('emu avd name', portNumber, logger))
            .then((result) => result.split('\n')[0].trim());
    }

    /**
     * Attempts to wait for an Android virtual device to finish booting on an ADB port.
     *
     * @param portNumber The ADB port of the Android virtual device.
     */
    public static async waitUntilDeviceIsReady(portNumber: number, logger?: Logger): Promise<void> {
        const quote = process.platform === WINDOWS_OS ? '"' : "'";
        const command = `wait-for-device shell ${quote}while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done;${quote}`;
        const timeout = PlatformConfig.androidConfig().deviceReadinessWaitTime;

        const waitUntilReadyPromise = CommonUtils.promiseWithTimeout(
            timeout,
            AndroidUtils.executeAdbCommand(command, portNumber, logger),
            messages.getMessage('bootTimeOut', [`emulator-${portNumber}`])
        );

        return waitUntilReadyPromise.then(() => Promise.resolve());
    }

    /**
     * Attempts to wait for an Android virtual device to power off. It determines whether a device is powered off
     * by continuously running 'adb devices' command and see if this particular device is no longer in the list.
     *
     * @param portNumber The ADB port of the Android virtual device.
     */
    public static async waitUntilDeviceIsPoweredOff(portNumber: number, logger?: Logger): Promise<void> {
        const command =
            process.platform === WINDOWS_OS
                ? `powershell -Command "while($(adb devices | findstr emulator-${portNumber})){ Start-Sleep -s 1 }"`
                : `while [[ -n $(adb devices | grep emulator-${portNumber}) ]]; do sleep 1; done;`;
        const timeout = PlatformConfig.androidConfig().deviceReadinessWaitTime;

        const waitUntilReadyPromise = CommonUtils.promiseWithTimeout(
            timeout,
            CommonUtils.executeCommandAsync(command, logger),
            messages.getMessage('powerOffTimeOut', [`emulator-${portNumber}`])
        );

        return waitUntilReadyPromise.then(() =>
            // It may often be the case that the device is removed from 'adb devices' list too quickly
            // specially on Windows platform. So we also wait an extra 5 seconds.
            CommonUtils.delay(5000)
        );
    }

    /**
     * Attempts to execute an ADB command on an Android virtual device, and will retry the command if it fails.
     *
     * @param command The command to be executed. This should not include 'adb' command itself.
     * @param portNumber The ADB port of the Android virtual device.
     * @param numRetries Optional parameter that indicates the number of times the command will be executed again if ADB comes back with an error. Defaults to AndroidConfig.AdbNumRetryAttempts.
     * @param retryDelay Optional parameter that indicates the milliseconds of delay before retrying again. Defaults to AndroidConfig.AdbRetryAttemptDelay.
     */
    public static async executeAdbCommand(
        command: string,
        portNumber: number,
        logger?: Logger,
        numRetries: number = PlatformConfig.androidConfig().AdbNumRetryAttempts,
        retryDelay: number = PlatformConfig.androidConfig().AdbRetryAttemptDelay
    ): Promise<string> {
        const adbCmd = `${AndroidUtils.getAdbShellCommand()} -s emulator-${portNumber} ${command}`;

        let allOutput = '';

        for (let i = 0; i <= numRetries; i++) {
            let result: { stdout: string; stderr: string } = {
                stdout: '',
                stderr: ''
            };
            let err: Error | undefined;

            try {
                // eslint-disable-next-line no-await-in-loop
                result = await CommonUtils.executeCommandAsync(adbCmd, logger);
            } catch (error) {
                err = error as Error;
            }

            allOutput =
                (err ? err.toString() : '') +
                (result.stderr ? '\n' + result.stderr : '') +
                (result.stdout ? '\n' + result.stdout : '');

            // ADB is terrible and in addition to actual errors it may also send warnings or even success messages to stderr.
            // For example if you run the command 'adb shell reboot -p' to power down a device, when done it prints the success
            // message 'Done\n' to stderr. And sometimes ADB prints error messages to stdout instead of stderr. So we first gether
            // all outputs into one and then explicitly check to see if an error has occurred or not.
            if (allOutput && allOutput.toLowerCase().includes('error:')) {
                logger?.warn(
                    `ADB command '${adbCmd}' failed. Retrying ${numRetries - i} more times.\n${result.stderr}\n${
                        result.stdout
                    }`
                );
                if (i < numRetries) {
                    // If we still have more retries left, delay and retry
                    // eslint-disable-next-line no-await-in-loop
                    await CommonUtils.delay(retryDelay);
                }
            } else {
                return Promise.resolve(result.stdout);
            }
        }

        // If we got here then it means that the command failed to execute successfully after all retries (if any)
        return Promise.reject(new SfError(allOutput));
    }

    /**
     * Attempts to launch a URL in the emulator browser.
     *
     * @param url The URL to be launched.
     * @param portNumber The ADB port of an Android virtual device.
     */
    public static async launchURLIntent(url: string, portNumber: number, logger?: Logger): Promise<void> {
        const openUrlCommand = `shell am start -a android.intent.action.VIEW -d ${url}`;
        CommonUtils.startCliAction(
            messages.getMessage('launchBrowserAction'),
            messages.getMessage('openBrowserWithUrlStatus', [url])
        );
        return AndroidUtils.executeAdbCommand(openUrlCommand, portNumber, logger).then(() => Promise.resolve());
    }

    /**
     * @returns " on Windows and ' on other platforms
     */
    public static platformSpecificPathQuote(): string {
        return process.platform === WINDOWS_OS ? '"' : "'";
    }

    /**
     * Attempts to launch a native app in an emulator to preview LWC components. If the app is not installed then this method will attempt to install it first.
     *
     * @param emulatorPort The ADB port of an Android virtual device.
     * @param target The bundle ID of the app to be launched + the activity name to be used when launching the app. Eg "com.salesforce.chatter/.Chatter"
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param targetAppArguments Extra arguments to be passed to the app upon launch.
     */
    public static async launchAppInBootedEmulator(
        emulatorPort: number,
        target: string,
        appBundlePath?: string,
        targetAppArguments?: LaunchArgument[],
        logger?: Logger
    ): Promise<void> {
        CommonUtils.startCliAction(messages.getMessage('launchAppAction'));

        if (appBundlePath && appBundlePath.trim().length > 0) {
            const installMsg = messages.getMessage('installAppStatus', [appBundlePath.trim()]);
            logger?.info(installMsg);
            CommonUtils.updateCliAction(installMsg);
            const pathQuote = AndroidUtils.platformSpecificPathQuote();
            const installCommand = `install -r -t ${pathQuote}${appBundlePath.trim()}${pathQuote}`;
            await AndroidUtils.executeAdbCommand(installCommand, emulatorPort, logger);
        }

        let launchArgs = '';
        targetAppArguments?.forEach((arg) => {
            launchArgs += `--es "${arg.name}" "${arg.value}" `;
        });

        const pkgId = target.split('/')[0];
        const terminateCommand = `shell am force-stop ${pkgId}`;
        const launchCommand =
            `shell am start -S -n "${target}"` +
            ' -a android.intent.action.MAIN' +
            ' -c android.intent.category.LAUNCHER' +
            ` ${launchArgs}`;

        // attempt at terminating the app first (in case it is already running) and then try to launch it again with new arguments.
        // if we hit issues with terminating, just ignore and continue.
        try {
            const terminateMsg = messages.getMessage('terminateAppStatus', [pkgId]);
            logger?.info(terminateMsg);
            CommonUtils.updateCliAction(terminateMsg);
            await AndroidUtils.executeAdbCommand(terminateCommand, emulatorPort, logger);
        } catch {
            // ignore and continue
        }

        const launchMsg = messages.getMessage('launchAppStatus', [target]);
        logger?.info(launchMsg);
        CommonUtils.updateCliAction(launchMsg);
        await AndroidUtils.executeAdbCommand(launchCommand, emulatorPort, logger);

        CommonUtils.stopCliAction();
    }

    // This method is public for testing purposes.
    public static async updateEmulatorConfig(emulatorName: string, logger?: Logger): Promise<void> {
        return AndroidUtils.readEmulatorConfig(emulatorName, logger).then((config) => {
            if (config.size === 0) {
                // If we cannot edit the AVD config, fail silently.
                // This will be a degraded experience but should still work.
                return Promise.resolve();
            }

            // Ensure value for runtime.network.latency is in lowercase.
            // Otherwise the device may not be able to launch via AVD Manager.
            const networkLatency = config.get('runtime.network.latency');
            if (networkLatency) {
                config.set('runtime.network.latency', networkLatency.trim().toLocaleLowerCase());
            }

            // Ensure value for runtime.network.speed is in lowercase.
            // Otherwise the device may not be able to launch via AVD Manager.
            const networkSpeed = config.get('runtime.network.speed');
            if (networkSpeed) {
                config.set('runtime.network.speed', networkSpeed.trim().toLocaleLowerCase());
            }

            // Utilize hardware.
            config.set('hw.keyboard', 'yes');
            config.set('hw.gpu.mode', 'auto');
            config.set('hw.gpu.enabled', 'yes');

            // Give emulator the appropriate skin.
            let skinName = config.get('hw.device.name') ?? '';
            if (skinName) {
                if (skinName === 'pixel') {
                    skinName = 'pixel_silver';
                } else if (skinName === 'pixel_xl') {
                    skinName = 'pixel_xl_silver';
                }
                const sdkRoot = AndroidUtils.getAndroidSdkRoot();
                config.set('skin.name', skinName);
                config.set('skin.path', `${sdkRoot?.rootLocation ?? ''}/skins/${skinName}`);
                config.set('skin.dynamic', 'yes');
                config.set('showDeviceFrame', 'yes');
            }

            AndroidUtils.writeEmulatorConfig(emulatorName, config, logger);
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
            AndroidUtils.androidPlatformTools = path.join(sdkRoot?.rootLocation ?? '', 'platform-tools');
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
            const home = process.env.ANDROID_HOME?.trim();
            const root = process.env.ANDROID_SDK_ROOT?.trim();

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
            AndroidUtils.androidCmdLineToolsBin = path.join(sdkRoot?.rootLocation ?? '', 'cmdline-tools');

            // It is possible to install various versions of the command line tools side-by-side
            // In this case the directory structure would be based on tool versions:
            //
            //    cmdline-tools/1.0/bin
            //    cmdline-tools/2.1/bin
            //    cmdline-tools/3.0/bin
            //    cmdline-tools/4.0-beta01/bin
            //    cmdline-tools/latest/bin
            //
            // Below, we get the list of all directories, then sort them descending and grab the first one.
            // This would either resolve to 'latest' or the latest versioned folder name
            if (fs.existsSync(AndroidUtils.androidCmdLineToolsBin)) {
                const content = fs.readdirSync(AndroidUtils.androidCmdLineToolsBin);
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
            AndroidUtils.emulatorCommand = path.join(sdkRoot?.rootLocation ?? '', 'emulator', 'emulator');
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
            AndroidUtils.adbShellCommand = path.join(AndroidUtils.getAndroidPlatformTools(), ANDROID_ADB_NAME);
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

    public static async emulatorHasPort(emulatorName: string, logger?: Logger): Promise<number | null> {
        try {
            const ports = await AndroidUtils.getAllCurrentlyUsedAdbPorts(logger);
            for (const port of ports) {
                // eslint-disable-next-line no-await-in-loop
                const name = await AndroidUtils.fetchEmulatorNameFromPort(port, logger);
                if (name === emulatorName) {
                    return port;
                }
            }
        } catch (error) {
            logger?.warn(`Unable to determine if emulator is already running: ${(error as Error).toString()}`);
        }

        return null;
    }

    public static async getNextAvailableAdbPort(logger?: Logger): Promise<number> {
        return AndroidUtils.getAllCurrentlyUsedAdbPorts(logger).then((ports) => {
            const adbPort =
                ports.length > 0
                    ? ports.sort().reverse()[0] + 2 // need to incr by 2, one for console port and next for adb
                    : PlatformConfig.androidConfig().defaultAdbPort;

            return Promise.resolve(adbPort);
        });
    }

    private static async getAllCurrentlyUsedAdbPorts(logger?: Logger): Promise<number[]> {
        let ports: number[] = [];
        const command = `${AndroidUtils.getAdbShellCommand()} devices`;
        return CommonUtils.executeCommandAsync(command, logger).then((result) => {
            if (result.stdout) {
                ports = result.stdout
                    .split('\n')
                    .filter((avd: string) => avd.toLowerCase().startsWith('emulator'))
                    .map((value) => {
                        const array = value.match(/\d+/);
                        const portNumbers = array ? array.map(Number) : [0];
                        return portNumbers[0];
                    });
            }
            return Promise.resolve(ports);
        });
    }

    private static async packageWithRequiredEmulatorImages(
        androidPackage: AndroidPackage,
        logger?: Logger
    ): Promise<AndroidPackage | undefined> {
        const installedSystemImages = await AndroidUtils.fetchInstalledSystemImages(logger);
        const platformAPI = androidPackage.platformAPI;
        const supportedImages = PlatformConfig.androidConfig().supportedImages.join('|');
        const supportedArchitectures = PlatformConfig.androidConfig().supportedArchitectures.join('|');
        const regex = RegExp(`.*(${platformAPI}.*);(${supportedImages});(${supportedArchitectures})`);

        for (const img of installedSystemImages) {
            if (img.path.match(regex) !== null) {
                return Promise.resolve(img);
            }
        }

        return Promise.resolve(undefined);
    }

    private static systemImagePath(platformAPI: string, emuImage: string, abi: string): string {
        const pathName = `system-images;${platformAPI};${emuImage};${abi}`;
        if (process.platform === WINDOWS_OS) {
            return pathName;
        }
        return `'${pathName}'`;
    }

    private static async fetchInstalledSystemImages(logger?: Logger): Promise<AndroidPackage[]> {
        return AndroidUtils.fetchInstalledPackages(logger).then((packages) => packages.systemImages);
    }

    // NOTE: detaching a process in windows seems to detach the streams. Prevent spawn from detaching when
    // used in Windows OS for special handling of some commands (adb).
    private static spawnChild(command: string): childProcess.ChildProcessWithoutNullStreams {
        if (process.platform === WINDOWS_OS) {
            const child = childProcess.spawn(command, { shell: true });
            return child;
        } else {
            const child = childProcess.spawn(command, {
                shell: true,
                detached: true
            });
            child.unref();
            return child;
        }
    }

    private static readEmulatorConfig(emulatorName: string, logger?: Logger): Promise<Map<string, string>> {
        const filePath = CommonUtils.resolveUserHomePath(
            path.join('~', '.android', 'avd', `${emulatorName}.avd`, 'config.ini')
        );
        try {
            const configFile = fs.readFileSync(filePath, 'utf8');
            const configMap = new Map<string, string>();
            for (const line of configFile.split('\n')) {
                const config = line.split('=');
                if (config.length > 1) {
                    configMap.set(config[0], config[1]);
                }
            }

            return Promise.resolve(configMap);
        } catch (error) {
            logger?.warn(`Unable to read emulator config ${filePath}: ${(error as Error).toString()}`);
            return Promise.resolve(new Map<string, string>());
        }
    }

    private static writeEmulatorConfig(emulatorName: string, config: Map<string, string>, logger?: Logger): void {
        let configString = '';
        // This looks wrong, but the callback signature of forEach is function(value,key,map).
        config.forEach((value, key) => {
            configString += key + '=' + value + '\n';
        });
        const filePath = CommonUtils.resolveUserHomePath(
            path.join('~', '.android', 'avd', `${emulatorName}.avd`, 'config.ini')
        );
        try {
            fs.writeFileSync(filePath, configString, 'utf8');
        } catch (error) {
            // If we cannot edit the AVD config, fail silently.
            // This will be a degraded experience but should still work.
            logger?.warn(`Unable to write emulator config to ${filePath}: ${(error as Error).toString()}`);
        }
    }

    /**
     * There is a bug in adb where `adb emu ...` commands will silently fail if the
     * .emulator_console_auth_token file on the user's machine is empty instead of
     * containing a valid auth token. Not clear how this file may get into this state
     * but it seems that this can happen on Windows machines more often.
     *
     * The solution is simple. Just delete the empty file and in the next call to
     * `adb emu ...`, the file will be regenerated by adb and will contain a new
     * auth token. To further read on this see https://github.com/tim-smart/dart_emulators/issues/4
     */
    private static async ensureValidEmulatorAuthToken(logger?: Logger): Promise<void> {
        const filePath = CommonUtils.resolveUserHomePath('~/.emulator_console_auth_token');
        if (fs.existsSync(filePath)) {
            const content = await CommonUtils.readTextFile(filePath, logger);
            if (!content) {
                fs.rmSync(filePath);
            }
        }
    }
}
