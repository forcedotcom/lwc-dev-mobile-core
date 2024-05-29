/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { AndroidSDKRootSource, AndroidUtils } from '../../../src/common/AndroidUtils.js';
import { Version } from '../../../src/common/Common.js';
import { CommonUtils } from '../../../src/common/CommonUtils.js';
import { PreviewUtils } from '../../../src/common/PreviewUtils.js';
import { AndroidMockData } from './AndroidMockData.js';

describe('Android utils', () => {
    const $$ = new TestContext();

    const mockAndroidHome = '/mock-android-home';

    const mockAndroidSdkRoot = '/mock-android-sdk-root';

    const userHome = process.env.HOME ?? process.env.HOMEPATH ?? process.env.USERPROFILE;

    const mockCmdLineToolsBin = path.normalize(path.join(mockAndroidHome, 'cmdline-tools', 'latest', 'bin'));
    const sdkCommand = path.normalize(path.join(mockCmdLineToolsBin, 'sdkmanager'));
    const adbCommand = path.normalize(path.join(mockAndroidHome, 'platform-tools/adb'));

    const isAppleSilicon = os.cpus()[0].model.includes('Apple M');
    const testAvdApi = isAppleSilicon ? '31' : '29';
    const testAvdName = isAppleSilicon ? 'Pixel_5_API_31' : 'Pixel_4_XL_API_29';
    const testAvdPath = isAppleSilicon
        ? '/User/test/.android/avd/Pixel_5_API_31.avd'
        : '/User/test/.android/avd/Pixel_4_XL_API_29.avd';

    const myCommandRouterBlock = (command: string): Promise<{ stdout: string; stderr: string }> => {
        let output = '';
        if (command.endsWith('avdmanager list avd')) {
            output = AndroidMockData.avdList;
        } else if (command.endsWith('emulator -list-avds')) {
            output = AndroidMockData.emuNames;
        } else if (command.endsWith('adb devices')) {
            output = 'emulator-5572';
        } else if (command.endsWith('emu avd name')) {
            output = testAvdName;
        } else if (command.endsWith('emu avd path')) {
            output = testAvdPath;
        } else {
            output = AndroidMockData.mockRawPackagesString;
        }

        return Promise.resolve({
            stderr: '',
            stdout: output
        });
    };

    beforeEach(() => {
        stubMethod($$.SANDBOX, CommonUtils, 'delay').returns(Promise.resolve());

        stubMethod($$.SANDBOX, AndroidUtils, 'getAndroidSdkRoot').returns({
            rootLocation: mockAndroidHome,
            rootSource: AndroidSDKRootSource.androidHome
        });

        stubMethod($$.SANDBOX, AndroidUtils, 'getAndroidCmdLineToolsBin').returns(mockCmdLineToolsBin);

        AndroidUtils.clearCaches();
    });

    afterEach(() => {
        $$.restore();
    });

    it('Should attempt to verify Android SDK prerequisites are met', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: 'mock version 1.0',
            stderr: ''
        });

        await AndroidUtils.androidSDKPrerequisitesCheck();
        expect(stub.calledWith(`${sdkCommand} --version`));
    });

    it('Should attempt to look for and find android sdk tools (sdkmanager)', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: 'mock version 1.0',
            stderr: ''
        });
        await AndroidUtils.fetchAndroidCmdLineToolsLocation();
        expect(stub.calledWith(`${sdkCommand} --version`));
    });

    it('Should attempt to look for and not find android sdk tools (sdkmanager)', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Command not found!'));
        try {
            await AndroidUtils.fetchAndroidCmdLineToolsLocation();
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should attempt to look for and find android sdk platform tools', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: 'mock version 1.0',
            stderr: ''
        });
        await AndroidUtils.fetchAndroidSDKPlatformToolsLocation();
        expect(stub.calledWith(`${adbCommand} --version`));
    });

    it('Should attempt to look for and not find android sdk platform tools', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Command not found!'));
        try {
            await AndroidUtils.fetchAndroidSDKPlatformToolsLocation();
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should attempt to invoke the sdkmanager for installed packages', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        await AndroidUtils.fetchInstalledPackages();
        expect(stub.calledWith(`${sdkCommand} --list`));
    });

    it('Should attempt to invoke the sdkmanager and get installed packages', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const packages = await AndroidUtils.fetchInstalledPackages();
        expect(packages.platforms.length + packages.systemImages.length).to.be.equal(
            AndroidMockData.mockRawStringPackageLength
        );
    });

    it('Should attempt to invoke the sdkmanager and retrieve an empty list for a bad sdkmanager list', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: AndroidMockData.badMockRawPackagesString
        });
        const packages = await AndroidUtils.fetchInstalledPackages();
        expect(packages.isEmpty()).to.be.true;
    });

    it('Should have no cache before first list packages call', async () => {
        expect(AndroidUtils.isCached()).to.be.false;
    });

    it('Should establish cache on first call', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        await AndroidUtils.fetchInstalledPackages();
        expect(AndroidUtils.isCached()).to.be.true;
    });

    it('Should utilize cache for subsequent calls', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        await AndroidUtils.fetchInstalledPackages();
        await AndroidUtils.fetchInstalledPackages();
        await AndroidUtils.fetchInstalledPackages();
        expect(stub.calledOnce);
    });

    it('Should rebuild cache after clear in subsequent calls', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        await AndroidUtils.fetchInstalledPackages();
        await AndroidUtils.fetchInstalledPackages();
        AndroidUtils.clearCaches();
        await AndroidUtils.fetchInstalledPackages();
        expect(stub.calledTwice);
    });

    it('Should find a preferred Android package', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const apiPackage = await AndroidUtils.fetchSupportedAndroidAPIPackage();
        expect(apiPackage?.description).to.not.be.null;
    });

    it('Should find a preferred Android package at a specific API level', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const apiPackage = await AndroidUtils.fetchSupportedAndroidAPIPackage(testAvdApi);
        expect(apiPackage?.description).to.not.be.null;
        expect(Version.same(apiPackage.version, Version.from(testAvdApi)!)).to.be.true;
    });

    it('Should not find a preferred Android package', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: AndroidMockData.badMockRawPackagesString
        });

        try {
            await AndroidUtils.fetchSupportedAndroidAPIPackage();
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should find a preferred Android emulator package', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const apiPackage = await AndroidUtils.fetchSupportedEmulatorImagePackage();
        expect(apiPackage?.description).to.not.be.null;
    });

    it('Should not find a preferred Android build tools package', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: AndroidMockData.badMockRawPackagesString
        });

        try {
            await AndroidUtils.fetchSupportedEmulatorImagePackage();
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    // Original Pixel/Pixel XL is a special case for skin path.
    it('Should update Pixel config with skin', async () => {
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

        const readStub = stubMethod($$.SANDBOX, fs, 'readFileSync').returns(testConfig);
        const writeStub = stubMethod($$.SANDBOX, fs, 'writeFileSync').callsFake(() => {});
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readStub.calledOnce);
        expect(
            writeStub.calledWith(
                path.normalize(`${userHome}/.android/avd/${avdName}.avd/config.ini`),
                expectedConfig,
                'utf8'
            )
        );
    });

    it('Should update Pixel 3 config with skin', async () => {
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

        const readStub = stubMethod($$.SANDBOX, fs, 'readFileSync').returns(testConfig);
        const writeStub = stubMethod($$.SANDBOX, fs, 'writeFileSync').callsFake(() => {});
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readStub.calledOnce);
        expect(
            writeStub.calledWith(
                path.normalize(`${userHome}/.android/avd/${avdName}.avd/config.ini`),
                expectedConfig,
                'utf8'
            )
        );
    });

    it('Should update unknown device config without skin', async () => {
        const avdName = 'configTest';
        const testConfig = 'hw.device.manufacture=Google\n';
        const expectedConfig =
            'hw.device.manufacture=Google\n' + 'hw.keyboard=yes\n' + 'hw.gpu.mode=auto\n' + 'hw.gpu.enabled=yes\n';

        const readStub = stubMethod($$.SANDBOX, fs, 'readFileSync').returns(testConfig);
        const writeStub = stubMethod($$.SANDBOX, fs, 'writeFileSync').callsFake(() => {});
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readStub.calledOnce);
        expect(
            writeStub.calledWith(
                path.normalize(`${userHome}/.android/avd/${avdName}.avd/config.ini`),
                expectedConfig,
                'utf8'
            )
        );
    });

    it('Should not write config if size is 0', async () => {
        const avdName = 'configTest';
        const testConfig = '';

        const readStub = stubMethod($$.SANDBOX, fs, 'readFileSync').returns(testConfig);
        const writeStub = stubMethod($$.SANDBOX, fs, 'writeFileSync').callsFake(() => {});
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readStub.calledOnce);
        expect(writeStub.called).to.be.false;
    });

    it('Should not write config on read error', async () => {
        const avdName = 'configTest';

        const readStub = stubMethod($$.SANDBOX, fs, 'readFileSync').throws(new Error('test error'));
        const writeStub = stubMethod($$.SANDBOX, fs, 'writeFileSync').callsFake(() => {});
        await AndroidUtils.updateEmulatorConfig(avdName);

        expect(readStub.calledOnce);
        expect(writeStub.called).to.be.false;
    });

    it('Should attempt to launch url and resolve', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({ stdout: '', stderr: '' });
        const url = 'mock.url';
        const port = 1234;
        const expectedCommand = `${adbCommand} -s emulator-${port} shell am start -a android.intent.action.VIEW -d ${url}`;
        await AndroidUtils.launchURLIntent(url, port);
        expect(stub.calledWith(expectedCommand));
    });

    it('Should attempt to launch url and reject if error is encountered', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandSync').throws(new Error(' Mock Error'));
        try {
            await AndroidUtils.launchURLIntent('mock.url', 1234);
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should attempt to launch native app and resolve', async () => {
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
            ' --es "arg1" "val1" --es "arg2" "val2"';

        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: `${targetApp}/.MainActivity`
        });

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

        expect(stub.calledOnce);
        expect(
            stub.calledWith(
                `${adbCommand} -s emulator-${port}` +
                    ` shell am start -S -n "${targetApp}/${targetActivity}"` +
                    ' -a android.intent.action.MAIN' +
                    ' -c android.intent.category.LAUNCHER' +
                    ` ${launchArgs}`
            )
        );
    });

    it('Should attempt to launch native app and reject if error is encountered.', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandSync').throws(new Error('Mock Error'));

        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const targetApp = 'com.mock.app';
        const targetActivity = '.MainActivity';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const port = 1234;

        try {
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
        } catch (error) {
            return;
        }
    });

    it('Should attempt to install native app then launch it.', async () => {
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
            ' --es "arg1" "val1" --es "arg2" "val2"';

        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: `${targetApp}/.MainActivity`
        });

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

        expect(stub.calledTwice);
        expect(stub.firstCall.args[0]).to.equal(
            `${adbCommand} -s emulator-${port} install -r -t ${pathQuote}${appBundlePath.trim()}${pathQuote}`
        );
        expect(stub.secondCall.args[0]).to.equal(
            `${adbCommand} -s emulator-${port}` +
                ` shell am start -S -n "${targetApp}/${targetActivity}"` +
                ' -a android.intent.action.MAIN' +
                ' -c android.intent.category.LAUNCHER' +
                ` ${launchArgs}`
        );
    });

    it('Should resolve ANDROID_HOME as SDK root', async () => {
        process.env.ANDROID_HOME = mockAndroidHome;
        delete process.env.ANDROID_SDK_ROOT; // set it to undefined
        $$.restore();
        stubMethod($$.SANDBOX, fs, 'existsSync').returns(true);
        const sdkRoot = AndroidUtils.getAndroidSdkRoot();
        expect(sdkRoot?.rootLocation).to.be.equal(mockAndroidHome);
    });

    it('Should resolve ANDROID_SDK_ROOT as SDK root', async () => {
        delete process.env.ANDROID_HOME; // set it to undefined
        process.env.ANDROID_SDK_ROOT = mockAndroidSdkRoot;
        $$.restore();
        stubMethod($$.SANDBOX, fs, 'existsSync').returns(true);
        const sdkRoot = AndroidUtils.getAndroidSdkRoot();
        expect(sdkRoot?.rootLocation).to.be.equal(mockAndroidSdkRoot);
    });

    it('Should resolve ANDROID_HOME as SDK root if both ANDROID_HOME and ANDROID_SDK_ROOT are set', async () => {
        process.env.ANDROID_HOME = mockAndroidHome;
        process.env.ANDROID_SDK_ROOT = mockAndroidSdkRoot;
        $$.restore();
        stubMethod($$.SANDBOX, fs, 'existsSync').returns(true);
        const sdkRoot = AndroidUtils.getAndroidSdkRoot();
        expect(sdkRoot?.rootLocation).to.be.equal(mockAndroidHome);
    });

    it('Should attempt to fetch an emulator', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const found = await AndroidUtils.fetchEmulator('Pixel_XL_API_28');
        const notFound = await AndroidUtils.fetchEmulator('blah');
        expect(found?.name).to.be.equal('Pixel_XL_API_28');
        expect(notFound).to.be.undefined;
    });

    it('Checks whether emulator exists', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const found = await AndroidUtils.hasEmulator('Pixel_XL_API_28');
        const notFound = await AndroidUtils.hasEmulator('blah');
        expect(found).to.be.true;
        expect(notFound).to.be.false;
    });

    it('Should start an emulator on a new port when another emulator is already running', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').returns('');

        // mocks are set up to show that testAvdName is running on 5572
        // so Pixel_XL_API_28 should now start on 5574
        const port = await AndroidUtils.startEmulator('Pixel_XL_API_28');
        expect(port).to.be.equal(5574);
    });

    it('Should restart an emulator that is already running but not in writable system mode', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').returns('');

        const port = await AndroidUtils.startEmulator(testAvdName, true);
        expect(port).to.be.equal(5572);
    });

    it('Should remount as root with writable system access on API 29', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').callsFake(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (filePath: any, encoding: any) => {
                if (filePath.endsWith(`${testAvdName}.ini`)) {
                    return 'target=android-29';
                } else {
                    return '';
                }
            }
        );

        const port = await AndroidUtils.mountAsRootWritableSystem(testAvdName);
        expect(port).to.be.equal(5572);
    });

    it('Resolves when device is not a Google Play device', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').returns('');

        try {
            await AndroidUtils.ensureDeviceIsNotGooglePlay(testAvdName);
        } catch (error: any) {
            throw new Error(`Should have resolved b/c device is not Google Play: ${error}`);
        }
    });

    it('Rejects when device is a Google Play device', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').returns('');

        try {
            await AndroidUtils.ensureDeviceIsNotGooglePlay('Pixel_3_API_29');
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Gets the latest version of cmdline tools', async () => {
        $$.restore();
        stubMethod($$.SANDBOX, AndroidUtils, 'getAndroidSdkRoot').returns({
            rootLocation: mockAndroidHome,
            rootSource: AndroidSDKRootSource.androidHome
        });
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'existsSync').returns(true);
        stubMethod($$.SANDBOX, fs, 'readdirSync').returns(['1.0', '2.1', '3.0', '4.0-beta01', 'latest']);

        const binPath = AndroidUtils.getAndroidCmdLineToolsBin();
        const expectedPath = path.normalize(`${mockAndroidHome}/cmdline-tools/latest/bin`);
        expect(binPath).to.be.equal(expectedPath);
    });
});
