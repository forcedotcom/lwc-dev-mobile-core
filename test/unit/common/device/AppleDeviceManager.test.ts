/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { CommonUtils } from '../../../../src/common/CommonUtils.js';
import { AppleDeviceManager } from '../../../../src/common/device/AppleDeviceManager.js';
import { AppleOSType } from '../../../../src/common/device/AppleDevice.js';
import { Version } from '../../../../src/common/Common.js';
import { DeviceState } from '../../../../src/common/device/BaseDevice.js';
import { AppleMockData } from './AppleMockData.js';

describe('AppleDeviceManager tests', () => {
    const $$ = new TestContext();
    const appleDeviceManager = new AppleDeviceManager();

    const myCommandRouterBlock = (command: string): Promise<{ stdout: string; stderr: string }> => {
        let output = '';
        if (command.endsWith('simctl list devices available --json')) {
            output = JSON.stringify(AppleMockData.mockRuntimeDevices);
        } else if (command.endsWith('simctl list runtimes available --json')) {
            output = JSON.stringify(AppleMockData.mockRuntimes);
        }

        return new Promise((resolve) => {
            resolve({
                stderr: 'mockError',
                stdout: output
            });
        });
    };

    afterEach(() => {
        $$.restore();
    });

    it('Should enumerate all runtimes without filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const results = await appleDeviceManager.enumerateRuntimes(null);
        expect(results.length === 6).to.be.true;
    });

    it('Should enumerate runtimes using default filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const results = await appleDeviceManager.enumerateRuntimes();
        expect(results.length === 3).to.be.true;
    });

    it('Should enumerate runtimes using custom filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const results = await appleDeviceManager.enumerateRuntimes([
            { osType: AppleOSType.iOS, minOSVersion: new Version(17, 0, 0) },
            { osType: AppleOSType.watchOS, minOSVersion: new Version(10, 5, 0) }
        ]);
        expect(results.length === 3).to.be.true;
    });

    it('Should enumerate all devices without filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const results = await appleDeviceManager.enumerateDevices(null);
        expect(results.length === 7).to.be.true;
    });

    it('Should enumerate devices using default filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const results = await appleDeviceManager.enumerateDevices();
        expect(results.length === 4).to.be.true;

        results.forEach((device) => {
            let state = DeviceState.Shutdown;
            if (device.id === '5D6ED992-29C3-43CC-8F94-3F8003B8494F') {
                state = DeviceState.Booted;
            } else if (device.id === '9826FDA1-7800-423C-9EC3-822FBF543C3B') {
                state = DeviceState.Booting;
            }
            expect(device.state).to.be.equal(state);
        });
    });

    it('Should enumerate devices using custom filtering', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        const results = await appleDeviceManager.enumerateDevices([
            { osType: AppleOSType.iOS, minOSVersion: new Version(17, 0, 0) },
            { osType: AppleOSType.watchOS, minOSVersion: new Version(10, 5, 0) }
        ]);
        expect(results.length === 4).to.be.true;
    });

    it('Should get a device using display name', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const found = await appleDeviceManager.getDevice('iPhone 15 Pro');
        const notFound = await appleDeviceManager.getDevice('blah');
        expect(found?.name).to.be.equal('iPhone 15 Pro');
        expect(notFound).to.be.undefined;
    });

    it('Should get a device using udid', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const found = await appleDeviceManager.getDevice('5D6ED992-29C3-43CC-8F94-3F8003B8494F');
        const notFound = await appleDeviceManager.getDevice('5D6ED992-0000-0000-0000-3F8003B8494F');
        expect(found?.name).to.be.equal('iPad Pro 13-inch (M4)');
        expect(notFound).to.be.undefined;
    });

    it('Should handle Bad JSON', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: '{[}',
            stderr: 'mockError'
        });

        try {
            await appleDeviceManager.enumerateRuntimes();
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });
});
