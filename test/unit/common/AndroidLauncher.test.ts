/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { CommonUtils } from '../../../src/common/CommonUtils.js';
import { AndroidLauncher } from '../../../src/common/AndroidLauncher.js';
import { PreviewUtils } from '../../../src/common/PreviewUtils.js';
import { AndroidDeviceManager } from '../../../src/common/device/AndroidDeviceManager.js';
import { DeviceType } from '../../../src/common/device/BaseDevice.js';
import { AndroidDevice, AndroidOSType } from '../../../src/common/device/AndroidDevice.js';
import { Version } from '../../../src/common/Common.js';

import { AndroidMockData } from './AndroidMockData.js';

describe('Android Launcher tests', () => {
    const $$ = new TestContext();
    const mockDevice = new AndroidDevice(
        'Pixel_5_API_31',
        'Pixel 5 API 31',
        DeviceType.mobile,
        AndroidOSType.googleAPIs,
        new Version(31, 0, 0),
        false
    );
    const launcher = new AndroidLauncher(mockDevice.name);

    beforeEach(() => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: AndroidMockData.mockRawPackagesString
        });
        stubMethod($$.SANDBOX, AndroidDeviceManager.prototype, 'getDevice').resolves(mockDevice);
        stubMethod($$.SANDBOX, AndroidDevice.prototype, 'boot').resolves();
    });

    afterEach(() => {
        $$.restore();
    });

    it('Should attempt to invoke preview in mobile browser', async () => {
        const launchUrlMock = stubMethod($$.SANDBOX, AndroidDevice.prototype, 'openUrl').resolves();
        await launcher.launchPreview('helloWorld', '~', undefined, 'browser', undefined, '3333');
        expect(launchUrlMock.calledWith('http://10.0.2.2:3333/lwc/preview/c/helloWorld')).to.be.true;
    });

    it('Should attempt to invoke preview in native app', async () => {
        const launchAppMock = stubMethod($$.SANDBOX, AndroidDevice.prototype, 'launchApp').resolves();
        await launcher.launchPreview('helloWorld', '~', undefined, 'com.salesforce.test', undefined, '3333');
        expect(
            launchAppMock.calledWith('com.salesforce.test', undefined, [
                {
                    name: PreviewUtils.COMPONENT_NAME_ARG_PREFIX,
                    value: 'helloWorld'
                },
                {
                    name: PreviewUtils.PROJECT_DIR_ARG_PREFIX,
                    value: '~'
                }
            ])
        ).to.be.true;
    });
});
