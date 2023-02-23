/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { SfError } from '@salesforce/core';
import fs from 'fs';
import path from 'path';
import { AndroidSDKRootSource, AndroidUtils } from '../AndroidUtils';
import { Version } from '../Common';
import { CommonUtils } from '../CommonUtils';
import { PreviewUtils } from '../PreviewUtils';
import { AndroidMockData } from './AndroidMockData';

describe('Android utils', () => {
    const mockAndroidHome = '/mock-android-home';

    const mockAndroidSdkRoot = '/mock-android-sdk-root';

    const userHome =
        process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

    const mockCmdLineToolsBin = path.normalize(
        path.join(mockAndroidHome, 'cmdline-tools', 'latest', 'bin')
    );
    const sdkCommand = path.normalize(
        path.join(mockCmdLineToolsBin, 'sdkmanager')
    );
    const adbCommand = path.normalize(mockAndroidHome + '/platform-tools/adb');

    let myGenericVersionsCommandBlockMock: jest.Mock<any, [], any>;
    let myGenericVersionsCommandBlockMockThrows: jest.Mock<any, [], any>;
    let myCommandBlockMock: jest.Mock<any, [command: string], any>;
    let badBlockMock: jest.Mock<any, [], any>;
    let throwMock: jest.Mock<any, [], any>;
    let launchCommandMock: jest.Mock<any, [], any>;
    let launchCommandThrowsMock: jest.Mock<any, [], any>;
    let readFileSpy: jest.SpyInstance<any>;
    let writeFileSpy: jest.SpyInstance<any>;

    beforeEach(() => {
        myGenericVersionsCommandBlockMock = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> => {
                return Promise.resolve({
                    stdout: 'mock version 1.0',
                    stderr: ''
                });
            }
        );

        myGenericVersionsCommandBlockMockThrows = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> =>
                Promise.reject(new Error('Command not found!'))
        );

        myCommandBlockMock = jest.fn(
            (command: string): Promise<{ stdout: string; stderr: string }> => {
                let output = '';
                if (command.endsWith('avdmanager list avd')) {
                    output = AndroidMockData.avdList;
                } else if (command.endsWith('emulator -list-avds')) {
                    output = AndroidMockData.emuNames;
                } else if (command.endsWith('adb devices')) {
                    output = 'emulator-5572';
                } else if (command.endsWith('emu avd name')) {
                    output = 'Pixel_4_XL_API_29';
                } else if (command.endsWith('emu avd path')) {
                    output = '/User/test/.android/avd/Pixel_4_XL_API_29.avd';
                } else {
                    output = AndroidMockData.mockRawPackagesString;
                }

                return Promise.resolve({
                    stderr: '',
                    stdout: output
                });
            }
        );

        badBlockMock = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> =>
                Promise.resolve({
                    stderr: '',
                    stdout: AndroidMockData.badMockRawPackagesString
                })
        );

        throwMock = jest.fn((): void => {
            throw new Error('test error');
        });

        launchCommandMock = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> =>
                Promise.resolve({ stdout: '', stderr: '' })
        );

        launchCommandThrowsMock = jest.fn((): string => {
            throw new Error(' Mock Error');
        });

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        jest.spyOn(CommonUtils, 'startCliAction').mockImplementation(() => {});
        jest.spyOn(CommonUtils, 'delay').mockReturnValue(Promise.resolve());
        jest.spyOn(AndroidUtils, 'getAndroidSdkRoot').mockImplementation(() => {
            return {
                rootLocation: mockAndroidHome,
                rootSource: AndroidSDKRootSource.androidHome
            };
        });
        jest.spyOn(AndroidUtils, 'getAndroidCmdLineToolsBin').mockReturnValue(
            mockCmdLineToolsBin
        );
        myCommandBlockMock.mockClear();
        badBlockMock.mockClear();
        AndroidUtils.clearCaches();
        throwMock.mockClear();
        launchCommandMock.mockClear();
        launchCommandThrowsMock.mockClear();
        readFileSpy = jest.spyOn(fs, 'readFileSync');
        writeFileSpy = jest
            .spyOn(fs, 'writeFileSync')
            .mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Should attempt to verify Android SDK prerequisites are met', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myGenericVersionsCommandBlockMock
        );
        await AndroidUtils.androidSDKPrerequisitesCheck();
        expect(myGenericVersionsCommandBlockMock).toHaveBeenCalledWith(
            `${sdkCommand} --version`
        );
    });

    test('Should attempt to look for and find android sdk tools (sdkmanager)', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myGenericVersionsCommandBlockMock
        );
        await AndroidUtils.fetchAndroidCmdLineToolsLocation();
        expect(myGenericVersionsCommandBlockMock).toHaveBeenCalledWith(
            `${sdkCommand} --version`
        );
    });

    test('Should attempt to look for and not find android sdk tools (sdkmanager)', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myGenericVersionsCommandBlockMockThrows
        );
        AndroidUtils.fetchAndroidCmdLineToolsLocation().catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should attempt to look for and find android sdk platform tools', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myGenericVersionsCommandBlockMock
        );
        await AndroidUtils.fetchAndroidSDKPlatformToolsLocation();
        expect(myGenericVersionsCommandBlockMock).toHaveBeenCalledWith(
            `${adbCommand} --version`
        );
    });

    test('Should attempt to look for and not find android sdk platform tools', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myGenericVersionsCommandBlockMockThrows
        );
        AndroidUtils.fetchAndroidSDKPlatformToolsLocation().catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should attempt to invoke the sdkmanager for installed packages', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        await AndroidUtils.fetchInstalledPackages();
        expect(myCommandBlockMock).toHaveBeenCalledWith(`${sdkCommand} --list`);
    });

    test('Should attempt to invoke the sdkmanager and get installed packages', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        const packages = await AndroidUtils.fetchInstalledPackages();
        expect(
            packages.platforms.length + packages.systemImages.length ===
                AndroidMockData.mockRawStringPackageLength
        ).toBe(true);
    });

    test('Should attempt to invoke the sdkmanager and retrieve an empty list for a bad sdkmanager list', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            badBlockMock
        );
        const packages = await AndroidUtils.fetchInstalledPackages();
        expect(packages.isEmpty()).toBe(true);
    });

    test('Should have no cache before first list packages call', async () => {
        expect(AndroidUtils.isCached()).toBeFalsy();
    });

    test('Should establish cache on first call', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        await AndroidUtils.fetchInstalledPackages();
        expect(AndroidUtils.isCached()).toBeTruthy();
    });

    test('Should utilize cache for subsequent calls', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        await AndroidUtils.fetchInstalledPackages();
        await AndroidUtils.fetchInstalledPackages();
        await AndroidUtils.fetchInstalledPackages();
        expect(myCommandBlockMock).toHaveBeenCalledTimes(1);
    });

    test('Should rebuild cache after clear in subsequent calls', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        await AndroidUtils.fetchInstalledPackages();
        await AndroidUtils.fetchInstalledPackages();
        AndroidUtils.clearCaches();
        await AndroidUtils.fetchInstalledPackages();
        expect(myCommandBlockMock).toHaveBeenCalledTimes(2);
    });

    test('Should find a preferred Android package', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        const apiPackage = await AndroidUtils.fetchSupportedAndroidAPIPackage();
        expect(apiPackage !== null && apiPackage.description !== null).toBe(
            true
        );
    });

    test('Should find a preferred Android package at a specific API level', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        const apiPackage = await AndroidUtils.fetchSupportedAndroidAPIPackage(
            '28'
        );
        expect(apiPackage !== null && apiPackage.description !== null).toBe(
            true
        );
        expect(apiPackage.version.same(Version.from('28')!)).toBe(true);
    });

    test('Should not find a preferred Android package', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            badBlockMock
        );
        AndroidUtils.fetchSupportedAndroidAPIPackage().catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should find a preferred Android emulator package', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        const apiPackage =
            await AndroidUtils.fetchSupportedEmulatorImagePackage();
        expect(apiPackage !== null && apiPackage.description !== null).toBe(
            true
        );
    });

    test('Should not find a preferred Android build tools package', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            badBlockMock
        );
        AndroidUtils.fetchSupportedEmulatorImagePackage().catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    // Original Pixel/Pixel XL is a special case for skin path.
    test('Should update Pixel config with skin', async () => {
        const avdName = 'configTest';
        const testConfig = 'hw.device.name=pixel\n';
        const expectedConfig =
            'hw.device.name=pixel\n' +
            'hw.keyboard=yes\n' +
            'hw.gpu.mode=auto\n' +
            'hw.gpu.enabled=yes\n' +
            'skin.name=pixel_silver\n' +
            `skin.path=${mockAndroidHome}/skins/pixel_silver\n` +
            'skin.dynamic=yes\n' +
            'showDeviceFrame=yes\n';

        readFileSpy.mockReturnValue(testConfig);
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readFileSpy).toHaveBeenCalled();
        expect(writeFileSpy).toHaveBeenCalledWith(
            path.normalize(
                `${userHome}/.android/avd/${avdName}.avd/config.ini`
            ),
            expectedConfig,
            'utf8'
        );
    });

    test('Should update Pixel 3 config with skin', async () => {
        const avdName = 'configTest';
        const testConfig = 'hw.device.name=pixel_3\n';
        const expectedConfig =
            'hw.device.name=pixel_3\n' +
            'hw.keyboard=yes\n' +
            'hw.gpu.mode=auto\n' +
            'hw.gpu.enabled=yes\n' +
            'skin.name=pixel_3\n' +
            `skin.path=${mockAndroidHome}/skins/pixel_3\n` +
            'skin.dynamic=yes\n' +
            'showDeviceFrame=yes\n';

        readFileSpy.mockReturnValue(testConfig);
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readFileSpy).toHaveBeenCalled();
        expect(writeFileSpy).toHaveBeenCalledWith(
            path.normalize(
                `${userHome}/.android/avd/${avdName}.avd/config.ini`
            ),
            expectedConfig,
            'utf8'
        );
    });

    test('Should update unknown device config without skin', async () => {
        const avdName = 'configTest';
        const testConfig = 'hw.device.manufacture=Google\n';
        const expectedConfig =
            'hw.device.manufacture=Google\n' +
            'hw.keyboard=yes\n' +
            'hw.gpu.mode=auto\n' +
            'hw.gpu.enabled=yes\n';

        readFileSpy.mockReturnValue(testConfig);
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readFileSpy).toHaveBeenCalled();
        expect(writeFileSpy).toHaveBeenCalledWith(
            path.normalize(
                `${userHome}/.android/avd/${avdName}.avd/config.ini`
            ),
            expectedConfig,
            'utf8'
        );
    });

    test('Should not write config if size is 0', async () => {
        const avdName = 'configTest';
        const testConfig = '';

        readFileSpy.mockReturnValue(testConfig);
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readFileSpy).toHaveBeenCalled();
        expect(writeFileSpy).toHaveBeenCalledTimes(0);
    });

    test('Should not write config on read error', async () => {
        const avdName = 'configTest';

        readFileSpy.mockImplementation(throwMock);
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readFileSpy).toHaveBeenCalled();
        expect(writeFileSpy).toHaveBeenCalledTimes(0);
    });

    test('Should attempt to launch url and resolve.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );
        const url = 'mock.url';
        const port = 1234;
        const expectedCommand = `${adbCommand} -s emulator-${port} shell am start -a android.intent.action.VIEW -d ${url}`;
        await AndroidUtils.launchURLIntent(url, port);
        expect(launchCommandMock).toHaveBeenCalledWith(expectedCommand);
    });

    test('Should attempt to launch url and reject if error is encountered.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandSync').mockImplementation(
            launchCommandThrowsMock
        );
        const url = 'mock.url';
        const port = 1234;
        return AndroidUtils.launchURLIntent(url, port).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should attempt to launch native app and resolve.', async () => {
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const targetApp = 'com.mock.app';
        const targetActivity = '.MainActivity';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const port = 1234;
        const launchArgs =
            `--es "${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}" "${compName}"` +
            ` --es "${PreviewUtils.PROJECT_DIR_ARG_PREFIX}" "${projectDir}"` +
            ` --es "arg1" "val1" --es "arg2" "val2"`;

        const mockCmd = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> =>
                Promise.resolve({
                    stderr: '',
                    stdout: `${targetApp}/.MainActivity`
                })
        );

        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            mockCmd
        );

        await AndroidUtils.launchNativeApp(
            compName,
            projectDir,
            undefined,
            targetApp,
            targetAppArgs,
            targetActivity,
            port,
            undefined,
            undefined
        );

        expect(mockCmd).toBeCalledTimes(1);
        expect(mockCmd).nthCalledWith(
            1,
            `${adbCommand} -s emulator-${port}` +
                ` shell am start -S -n "${targetApp}/${targetActivity}"` +
                ' -a android.intent.action.MAIN' +
                ' -c android.intent.category.LAUNCHER' +
                ` ${launchArgs}`
        );
    });

    test('Should attempt to launch native app and reject if error is encountered.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandSync').mockImplementation(
            launchCommandThrowsMock
        );
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const targetApp = 'com.mock.app';
        const targetActivity = '.MainActivity';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const port = 1234;
        return AndroidUtils.launchNativeApp(
            compName,
            projectDir,
            undefined,
            targetApp,
            targetAppArgs,
            targetActivity,
            port,
            undefined,
            undefined
        ).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should attempt to install native app then launch it.', async () => {
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const appBundlePath = '/mock/path/MyTestApp.apk';
        const targetApp = 'com.mock.app';
        const targetActivity = '.MainActivity';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const port = 1234;
        const launchArgs =
            `--es "${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}" "${compName}"` +
            ` --es "${PreviewUtils.PROJECT_DIR_ARG_PREFIX}" "${projectDir}"` +
            ` --es "arg1" "val1" --es "arg2" "val2"`;

        const mockCmd = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> =>
                Promise.resolve({
                    stderr: '',
                    stdout: `${targetApp}/.MainActivity`
                })
        );

        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            mockCmd
        );

        await AndroidUtils.launchNativeApp(
            compName,
            projectDir,
            appBundlePath,
            targetApp,
            targetAppArgs,
            targetActivity,
            port,
            undefined,
            undefined
        );

        const pathQuote = process.platform === 'win32' ? '"' : "'";

        expect(mockCmd).toBeCalledTimes(2);
        expect(mockCmd).nthCalledWith(
            1,
            `${adbCommand} -s emulator-${port} install -r -t ${pathQuote}${appBundlePath.trim()}${pathQuote}`
        );
        expect(mockCmd).nthCalledWith(
            2,
            `${adbCommand} -s emulator-${port}` +
                ` shell am start -S -n "${targetApp}/${targetActivity}"` +
                ' -a android.intent.action.MAIN' +
                ' -c android.intent.category.LAUNCHER' +
                ` ${launchArgs}`
        );
    });

    test('Should resolve ANDROID_HOME as SDK root', async () => {
        process.env.ANDROID_HOME = mockAndroidHome;
        delete process.env.ANDROID_SDK_ROOT; // set it to undefined
        jest.restoreAllMocks();
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        const sdkRoot = AndroidUtils.getAndroidSdkRoot();
        const rootPath = (sdkRoot && sdkRoot.rootLocation) || '';
        expect(rootPath).toBe(mockAndroidHome);
    });

    test('Should resolve ANDROID_SDK_ROOT as SDK root', async () => {
        delete process.env.ANDROID_HOME; // set it to undefined
        process.env.ANDROID_SDK_ROOT = mockAndroidSdkRoot;
        jest.restoreAllMocks();
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        const sdkRoot = AndroidUtils.getAndroidSdkRoot();
        const rootPath = (sdkRoot && sdkRoot.rootLocation) || '';
        expect(rootPath).toBe(mockAndroidSdkRoot);
    });

    test('Should resolve ANDROID_HOME as SDK root if both ANDROID_HOME and ANDROID_SDK_ROOT are set', async () => {
        process.env.ANDROID_HOME = mockAndroidHome;
        process.env.ANDROID_SDK_ROOT = mockAndroidSdkRoot;
        jest.restoreAllMocks();
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        const sdkRoot = AndroidUtils.getAndroidSdkRoot();
        const rootPath = (sdkRoot && sdkRoot.rootLocation) || '';
        expect(rootPath).toBe(mockAndroidHome);
    });

    test('Should attempt to fetch an emulator', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );

        const found = await AndroidUtils.fetchEmulator('Pixel_XL_API_28');
        const notFound = await AndroidUtils.fetchEmulator('blah');
        expect(found && found.name === 'Pixel_XL_API_28').toBe(true);
        expect(notFound === undefined).toBe(true);
    });

    test('Checks whether emulator exists', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );

        const found = await AndroidUtils.hasEmulator('Pixel_XL_API_28');
        const notFound = await AndroidUtils.hasEmulator('blah');
        expect(found).toBe(true);
        expect(notFound).toBe(false);
    });

    test('Should start an emulator on a new port when another emulator is already running', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        readFileSpy.mockReturnValue('');

        // mocks are set up to show that Pixel_4_XL_API_29 is running on 5572
        // so Pixel_XL_API_28 should not start on 5574
        const port = await AndroidUtils.startEmulator('Pixel_XL_API_28');
        expect(port).toBe(5574);
    });

    test('Should restart an emulator that is already running but not in writable system mode', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        readFileSpy.mockReturnValue('');

        const port = await AndroidUtils.startEmulator(
            'Pixel_4_XL_API_29',
            true
        );
        expect(port).toBe(5572);
    });

    test('Should remount as root with writable system access on API 29', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );

        jest.spyOn(fs, 'readFileSync').mockImplementation(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (filePath: any, encoding: any) => {
                if (filePath.endsWith('Pixel_4_XL_API_29.ini')) {
                    return 'target=android-29';
                } else {
                    return '';
                }
            }
        );

        const port = await AndroidUtils.mountAsRootWritableSystem(
            'Pixel_4_XL_API_29'
        );
        expect(port).toBe(5572);
    });

    test('Resolves when device is not a Google Play device', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        readFileSpy.mockReturnValue('');

        try {
            await AndroidUtils.ensureDeviceIsNotGooglePlay('Pixel_4_XL_API_29');
        } catch (error) {
            fail(
                `Should have resolved b/c device is not Google Play: ${error}`
            );
        }
    });

    test('Rejects when device is a Google Play device', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );
        readFileSpy.mockReturnValue('');

        expect.assertions(1);
        try {
            await AndroidUtils.ensureDeviceIsNotGooglePlay('Pixel_3_API_29');
        } catch (error) {
            expect(error instanceof SfError).toBe(true);
        }
    });

    /*
    test('Gets the latest version of cmdline tools', async () => {
        jest.restoreAllMocks();

        jest.spyOn(AndroidUtils, 'getAndroidSdkRoot').mockImplementation(() => {
            return {
                rootLocation: mockAndroidHome,
                rootSource: AndroidSDKRootSource.androidHome
            };
        });

        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);

        const directories = ['1.0', '2.1', '3.0', '4.0-beta01', 'latest'];
        spyOn(fs, 'readdirSync').and.returnValue(directories);

        const binPath = AndroidUtils.getAndroidCmdLineToolsBin();
        const expectedPath = path.normalize(
            `${mockAndroidHome}/cmdline-tools/latest/bin`
        );
        expect(binPath).toBe(expectedPath);
    });
    */
});
