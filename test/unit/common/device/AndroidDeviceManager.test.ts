/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import fs from 'node:fs';
import path from 'node:path';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { CommonUtils } from '../../../../src/common/CommonUtils.js';
import { AndroidDeviceManager } from '../../../../src/common/device/AndroidDeviceManager.js';
import { AndroidOSType } from '../../../../src/common/device/AndroidDevice.js';
import { Version } from '../../../../src/common/Common.js';
import { AndroidMockData } from '../AndroidMockData.js';
import { AndroidUtils } from '../../../../src/common/AndroidUtils.js';
import { DeviceState } from '../../../../src/common/device/BaseDevice.js';

describe('AndroidDeviceManager tests', () => {
    const $$ = new TestContext();
    const androidDeviceManager = new AndroidDeviceManager();
    const bootedDeviceId = 'Pixel_5_API_31';

    const myCommandRouterBlock = (command: string): Promise<{ stdout: string; stderr: string }> => {
        if (command.endsWith('avdmanager list avd')) {
            return Promise.resolve({
                stderr: '',
                stdout: AndroidMockData.avdList
            });
        } else if (command.includes('adb devices')) {
            // Mock ADB devices output showing one emulator running on port 5572
            return Promise.resolve({
                stderr: '',
                stdout: 'List of devices attached\nemulator-5572\tdevice\n'
            });
        } else {
            return Promise.resolve({
                stderr: '',
                stdout: ''
            });
        }
    };

    beforeEach(() => {
        stubMethod($$.SANDBOX, AndroidUtils, 'getAvdManagerCommand').returns('avdmanager');
        stubMethod($$.SANDBOX, AndroidUtils, 'getAdbShellCommand').returns('adb');

        // Stub fetchEmulatorNameFromPort to return the expected device name for port 5572
        stubMethod($$.SANDBOX, AndroidUtils, 'fetchEmulatorNameFromPort').callsFake((port) => {
            if (port === 5572) {
                return Promise.resolve(bootedDeviceId);
            } else {
                return Promise.resolve('some_other_device');
            }
        });

        // Stub ensureValidEmulatorAuthToken to avoid file system operations
        stubMethod($$.SANDBOX, AndroidUtils, 'ensureValidEmulatorAuthToken').resolves();

        stubMethod($$.SANDBOX, fs, 'existsSync').callsFake((filePath) => !filePath.endsWith('config.ini'));

        stubMethod($$.SANDBOX, fs, 'readFileSync').callsFake((filePath) => {
            const avdId = path.basename(filePath).replace('.ini', '');

            if (avdId === 'Android_TV_1080p_API_30') {
                return 'target=android-30';
            } else if (avdId === 'Medium_Desktop_API_34') {
                return 'target=android-34';
            } else if (avdId === 'Wear_OS_Large_Round_API_30') {
                return 'target=android-30';
            } else if (avdId === 'Pixel_5_API_31') {
                return 'target=android-31';
            } else if (avdId === 'Nexus_6_API_30') {
                return 'target=android-30';
            } else if (avdId === 'Pixel_3_API_29') {
                return 'target=android-29';
            } else if (avdId === 'Pixel_4_XL_API_29') {
                return 'target=android-29';
            } else if (avdId === 'Pixel_XL_API_28') {
                return 'target=android-28';
            } else {
                return '';
            }
        });
    });

    afterEach(() => {
        $$.restore();
    });

    it('Should enumerate all devices without filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const devices = await androidDeviceManager.enumerateDevices(null);
        expect(devices.length).to.be.equal(8);
        devices.forEach((device) => {
            expect(device.state).to.be.equal(device.id === bootedDeviceId ? DeviceState.Booted : DeviceState.Shutdown);
        });
    });

    it('Should enumerate devices using default filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const devices = await androidDeviceManager.enumerateDevices();
        expect(devices.length).to.be.equal(4);
    });

    it('Should enumerate devices using custom filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const devices = await androidDeviceManager.enumerateDevices([
            { osType: AndroidOSType.googleAPIs, minOSVersion: new Version(30, 0, 0) },
            { osType: AndroidOSType.googleTV, minOSVersion: new Version(28, 0, 0) }
        ]);
        expect(devices.length).to.be.equal(3);
    });

    it('Should get a device using display name', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const found = await androidDeviceManager.getDevice('Pixel 5 API 31');
        const notFound = await androidDeviceManager.getDevice('blah');
        expect(found?.name).to.be.equal('Pixel 5 API 31');
        expect(notFound).to.be.undefined;
    });

    it('Should get a device using id', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const found = await androidDeviceManager.getDevice('Pixel_5_API_31');
        const notFound = await androidDeviceManager.getDevice('blah');
        expect(found?.name).to.be.equal('Pixel 5 API 31');
        expect(notFound).to.be.undefined;
    });

    it('Should handle Bad JSON', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: '{[}',
            stderr: 'mockError'
        });

        const devices = await androidDeviceManager.enumerateDevices();
        expect(devices.length).to.be.equal(0);
    });
});
