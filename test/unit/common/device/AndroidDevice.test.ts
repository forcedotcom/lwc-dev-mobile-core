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
import { AndroidSDKRootSource, AndroidUtils } from '../../../../src/common/AndroidUtils.js';
import { CommonUtils } from '../../../../src/common/CommonUtils.js';
import { AndroidMockData } from '../AndroidMockData.js';
import { AndroidDevice, AndroidOSType, BootMode } from '../../../../src/common/device/AndroidDevice.js';
import { DeviceType } from '../../../../src/common/device/BaseDevice.js';
import { Version } from '../../../../src/common/Common.js';

describe('AndroidDevice', () => {
    let mockDevice: AndroidDevice;

    const $$ = new TestContext();
    const mockAndroidHome = '/mock-android-home';
    const mockCmdLineToolsBin = path.normalize(path.join(mockAndroidHome, 'cmdline-tools', 'latest', 'bin'));
    const myCommandRouterBlock = (command: string): Promise<{ stdout: string; stderr: string }> => {
        let output = '';
        if (command.endsWith('avdmanager list avd')) {
            output = AndroidMockData.avdList;
        } else if (command.endsWith('emulator -list-avds')) {
            output = AndroidMockData.emuNames;
        } else if (command.endsWith('adb devices')) {
            output = 'emulator-5572';
        } else if (command.endsWith('emu avd name')) {
            output = mockDevice.id;
        } else if (command.endsWith('emu avd path')) {
            output = `/User/test/.android/avd/${mockDevice.id}.avd`;
        } else {
            output = AndroidMockData.mockRawPackagesString;
        }

        return Promise.resolve({
            stderr: '',
            stdout: output
        });
    };

    beforeEach(() => {
        const isAppleSilicon = os.cpus()[0].model.includes('Apple M');
        mockDevice = isAppleSilicon
            ? new AndroidDevice(
                  'Pixel_5_API_31',
                  'Pixel 5 API 31',
                  DeviceType.mobile,
                  AndroidOSType.googleAPIs,
                  new Version(31, 0, 0),
                  false
              )
            : new AndroidDevice(
                  'Pixel_4_XL_API_29',
                  'Pixel 4 XL API 29',
                  DeviceType.mobile,
                  AndroidOSType.googleAPIs,
                  new Version(29, 0, 0),
                  false
              );

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

    it('Should start an emulator on a new port when another emulator is already running', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').returns('');

        // mocks are set up to show that testAvdName is running on 5572
        // so Pixel_XL_API_28 should now start on 5574
        const anotherMockDevice = new AndroidDevice(
            'Pixel_XL_API_28',
            'Pixel XL API 28',
            DeviceType.mobile,
            AndroidOSType.googleAPIs,
            new Version(28, 0, 0),
            false
        );
        await anotherMockDevice.boot();
        expect(anotherMockDevice.emulatorPort()).to.be.equal(5574);
    });

    it('Should restart an emulator that is already running but not in writable system mode', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').returns('');

        await mockDevice.boot(true, BootMode.systemWritableMandatory);
        expect(mockDevice.emulatorPort()).to.be.equal(5572);
    });

    it('Should remount as root with writable system access on API 29', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, fs, 'readFileSync').callsFake((filePath: string) => {
            if (filePath.endsWith(`${mockDevice.id}.ini`)) {
                return 'target=android-29';
            } else {
                return '';
            }
        });

        await mockDevice.mountAsRootWritableSystem();
        expect(mockDevice.emulatorPort()).to.be.equal(5572);
    });
});
