/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { CommonUtils } from '../../src/common/CommonUtils.js';
import { IOSUtils } from '../../src/common/IOSUtils.js';
import { PreviewUtils } from '../../src/common/PreviewUtils.js';
import { IOSMockData } from './IOSMockData.js';

describe('IOS utils tests', () => {
    const $$ = new TestContext();
    const DEVICE_TYPE_PREFIX = 'com.apple.CoreSimulator.SimDeviceType';
    const RUNTIME_TYPE_PREFIX = 'com.apple.CoreSimulator.SimRuntime';

    const myCommandRouterBlock = (command: string): Promise<{ stdout: string; stderr: string }> => {
        let output = '';
        if (command.endsWith('simctl list --json devicetypes')) {
            output = JSON.stringify(IOSMockData.mockRuntimeDeviceTypes);
        } else if (command.endsWith('simctl list --json devices available')) {
            output = JSON.stringify(IOSMockData.mockRuntimeDevices);
        } else {
            output = JSON.stringify(IOSMockData.mockRuntimes);
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

    it('Should attempt to invoke the xcrun for fetching sim runtimes', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        await IOSUtils.getSimulatorRuntimes();
        expect(stub.calledOnce).to.be.true;
    });

    it('Should attempt to invoke the xcrun for booting a device', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        const udid = 'MOCKUDID';
        await IOSUtils.bootDevice(udid);
        expect(stub.calledWith(`/usr/bin/xcrun simctl boot ${udid}`));
    });

    it('Should attempt to invoke the xcrun but fail booting a device', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Mock Error'));
        return IOSUtils.bootDevice('MOCKUDID').catch((error) => expect(error).to.be.an('error'));
    });

    it('Should attempt to create a new device', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        const simName = 'MOCKSIM';
        const deviceType = 'MOCK-DEVICE';
        const runtimeType = 'MOCK-SIM';
        await IOSUtils.createNewDevice(simName, deviceType, runtimeType);
        expect(
            stub.calledWith(
                `/usr/bin/xcrun simctl create '${simName}' ${DEVICE_TYPE_PREFIX}.${deviceType} ${RUNTIME_TYPE_PREFIX}.${runtimeType}`
            )
        );
    });

    it('Should attempt to invoke xcrun to boot device but resolve if device is already booted', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Failed to boot - state: booted'));
        try {
            await IOSUtils.bootDevice('MOCKUDID');
        } catch (error: any) {
            throw new Error(`Should have passed: ${error}`);
        }
    });

    it('Should wait for the device to boot', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        try {
            await IOSUtils.waitUntilDeviceIsReady('MOCKUDID');
        } catch (error: any) {
            throw new Error(`Should have passed: ${error}`);
        }
    });

    it('Should wait for the device to boot and fail if error is encountered', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Mock Error'));
        try {
            await IOSUtils.waitUntilDeviceIsReady('MOCKUDID');
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should launch the simulator app', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        await IOSUtils.launchSimulatorApp();
        expect(stub.calledWith('open -a Simulator'));
    });

    it('Should reject if launch of simulator app fails', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Mock Error'));
        try {
            await IOSUtils.launchSimulatorApp();
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should attempt to launch url in a booted simulator and resolve.', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        const url = 'mock.url';
        const udid = 'MOCK-UDID';
        await IOSUtils.launchURLInBootedSimulator(url, udid);
        expect(stub.calledWith(`/usr/bin/xcrun simctl openurl "${url}" ${udid}`));
    });

    it('Should attempt to launch url in a booted simulator and reject if error is encountered.', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Mock Error'));
        try {
            const url = 'mock.url';
            const udid = 'MOCK-UDID';
            await IOSUtils.launchURLInBootedSimulator(url, udid);
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should attempt to launch native app in a booted simulator and resolve.', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });

        const udid = 'MOCK-UDID';
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const targetApp = 'com.mock.app';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const launchArgs =
            `${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}=${compName}` +
            ` ${PreviewUtils.PROJECT_DIR_ARG_PREFIX}=${projectDir}` +
            ' arg1=val1 arg2=val2';

        await IOSUtils.launchAppInBootedSimulator(
            udid,
            compName,
            projectDir,
            undefined,
            targetApp,
            targetAppArgs,
            undefined,
            undefined
        );

        expect(stub.calledTwice).to.be.true;

        expect(stub.firstCall.args[0]).to.equal(`/usr/bin/xcrun simctl terminate "${udid}" ${targetApp}`);

        expect(stub.secondCall.args[0]).to.equal(`/usr/bin/xcrun simctl launch "${udid}" ${targetApp} ${launchArgs}`);
    });

    it('Should attempt to launch native app in a booted simulator and reject if error is encountered.', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Mock Error'));

        const udid = 'MOCK-UDID';
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const targetApp = 'com.mock.app';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];

        try {
            await IOSUtils.launchAppInBootedSimulator(
                udid,
                compName,
                projectDir,
                undefined,
                targetApp,
                targetAppArgs,
                undefined,
                undefined
            );
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('SShould attempt to install native app then launch it.', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });

        const udid = 'MOCK-UDID';
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const appBundlePath = '/mock/path/MyTestApp.app';
        const targetApp = 'com.mock.app';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const launchArgs =
            `${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}=${compName}` +
            ` ${PreviewUtils.PROJECT_DIR_ARG_PREFIX}=${projectDir}` +
            ' arg1=val1 arg2=val2';

        await IOSUtils.launchAppInBootedSimulator(
            udid,
            compName,
            projectDir,
            appBundlePath,
            targetApp,
            targetAppArgs,
            undefined,
            undefined
        );

        expect(stub.calledThrice).to.be.true;

        expect(stub.firstCall.args[0]).to.equal(`/usr/bin/xcrun simctl install ${udid} '${appBundlePath.trim()}'`);

        expect(stub.secondCall.args[0]).to.equal(`/usr/bin/xcrun simctl terminate "${udid}" ${targetApp}`);

        expect(stub.thirdCall.args[0]).to.equal(`/usr/bin/xcrun simctl launch "${udid}" ${targetApp} ${launchArgs}`);
    });

    it('Should attempt to invoke the xcrun for fetching sim runtimes and return an array of values', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const returnedValues = await IOSUtils.getSimulatorRuntimes();

        expect(returnedValues !== null && returnedValues.length === IOSMockData.mockRuntimes.runtimes.length).to.be
            .true;
    });

    it('Should attempt to invoke the xcrun for fetching supported runtimes and return whitelisted values', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const returnedValues = await IOSUtils.getSupportedRuntimes();

        expect(returnedValues !== null && returnedValues.length > 0).to.be.true;
    });

    it('Should attempt to invoke the xcrun for fetching supported devices and return whitelisted values', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const returnedValues = await IOSUtils.getSupportedDevices();

        expect(returnedValues !== null && returnedValues.length > 0).to.be.true;
    });

    it('Should attempt to invoke the xcrun for fetching supported sims', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const returnedValues = await IOSUtils.getSupportedSimulators();

        expect(returnedValues !== null && returnedValues.length > 0).to.be.true;
    });

    it('Should attempt to fetch a sim by name', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const found = await IOSUtils.getSimulator('iPhone 11 Pro');
        const notFound = await IOSUtils.getSimulator('blah');
        expect(found?.name).to.be.equal('iPhone 11 Pro');
        expect(notFound).to.be.null;
    });

    it('Should attempt to fetch a sim by udid', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);

        const found = await IOSUtils.getSimulator('F2B4097F-F33E-4D8A-8FFF-CE49F8D6C166');
        const notFound = await IOSUtils.getSimulator('F2B4097F-F33E-4D8A-8FFF-ABCDEFGHIJ');
        expect(found?.name).to.be.equal('iPhone-11 Pro Max');
        expect(notFound).to.be.null;
    });

    it('Should handle Bad JSON', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: '{[}',
            stderr: 'mockError'
        });

        try {
            await IOSUtils.getSimulatorRuntimes();
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });
});
