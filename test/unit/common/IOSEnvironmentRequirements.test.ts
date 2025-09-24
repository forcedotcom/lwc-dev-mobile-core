/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { AppleDeviceManager } from '../../../src/common/device/AppleDeviceManager.js';
import { AppleRuntime, AppleOSType } from '../../../src/common/device/AppleDevice.js';
import { CommonUtils } from '../../../src/common/CommonUtils.js';
import { Version } from '../../../src/common/Common.js';
import {
    IOSEnvironmentRequirements,
    SupportedEnvironmentRequirement,
    SupportedSimulatorRuntimeRequirement,
    XcodeInstalledRequirement
} from '../../../src/common/IOSEnvironmentRequirements.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('IOS Environment Requirement tests', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'requirement-ios');
    const $$ = new TestContext();
    const logger = new Logger('test-IOSEnvironmentRequirement');

    afterEach(() => {
        $$.restore();
    });

    it('Should attempt to validate supported OS environment', async () => {
        const execCmdAsyncMock = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: 'Darwin',
            stderr: 'mockError'
        });
        const requirement = new SupportedEnvironmentRequirement(logger);
        await requirement.checkFunction();
        expect(execCmdAsyncMock.calledWith('/usr/bin/uname')).to.be.true;
    });

    it('Should throw an error for an unsupported OS environment', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Bad bad mock!'));
        const requirement = new SupportedEnvironmentRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property('message')
                .that.includes(messages.getMessage('ios:reqs:macos:unfulfilledMessage', ['']))
        );
    });

    it('Checks to see that the logger is set', async () => {
        const loggerMock = stubMethod($$.SANDBOX, Logger.prototype, 'info');
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: 'Darwin',
            stderr: 'mockError'
        });
        const requirement = new SupportedEnvironmentRequirement(logger);
        await requirement.checkFunction();
        expect(loggerMock.calledOnce).to.be.true;
    });

    it('Should attempt to validate supported Xcode environment', async () => {
        const execCmdAsyncMock = stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: 'mockError',
            stdout: '/Applications/Xcode.app/Contents/Developer'
        });
        const requirement = new XcodeInstalledRequirement(logger);
        await requirement.checkFunction();
        expect(execCmdAsyncMock.calledWith('xcodebuild -version')).to.be.true;
    });

    it('Should throw an error for unsupported Xcode Env', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error('Bad bad mock!'));
        const requirement = new XcodeInstalledRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property('message')
                .that.includes(messages.getMessage('ios:reqs:xcode:unfulfilledMessage', ['']))
        );
    });

    it('Should attempt to validate supported Xcode runtime environments', async () => {
        const getSimRuntimesMock = stubMethod($$.SANDBOX, AppleDeviceManager.prototype, 'enumerateRuntimes').resolves([
            {
                bundlePath:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_21F79/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.5.simruntime',
                identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-17-5',
                isAvailable: true,
                isInternal: false,
                name: 'iOS 17.5',
                platform: 'iOS',
                runtimeRoot:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_21F79/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.5.simruntime/Contents/Resources/RuntimeRoot',
                version: '17.5'
            } as AppleRuntime
        ]);
        const requirement = new SupportedSimulatorRuntimeRequirement(logger);
        await requirement.checkFunction();
        expect(getSimRuntimesMock.calledOnce).to.be.true;
    });

    it('Should throw an error for unsupported Xcode runtime environments', async () => {
        stubMethod($$.SANDBOX, AppleDeviceManager.prototype, 'enumerateRuntimes').rejects(new Error('Bad mock!'));
        const requirement = new SupportedSimulatorRuntimeRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property('message')
                .that.includes(messages.getMessage('ios:reqs:simulator:unfulfilledMessage', ['']))
        );
    });

    describe('IOSEnvironmentRequirements with apiLevel', () => {
        it('Should create IOSEnvironmentRequirements with apiLevel', () => {
            const apiLevel = '16.0';
            const iosRequirements = new IOSEnvironmentRequirements(logger, apiLevel);

            expect(iosRequirements.requirements).to.have.lengthOf(3);
            expect(iosRequirements.requirements[0]).to.be.instanceOf(SupportedEnvironmentRequirement);
            expect(iosRequirements.requirements[1]).to.be.instanceOf(XcodeInstalledRequirement);
            expect(iosRequirements.requirements[2]).to.be.instanceOf(SupportedSimulatorRuntimeRequirement);
            expect(iosRequirements.enabled).to.be.true;
        });

        it('Should create IOSEnvironmentRequirements without apiLevel', () => {
            const iosRequirements = new IOSEnvironmentRequirements(logger);

            expect(iosRequirements.requirements).to.have.lengthOf(3);
            expect(iosRequirements.requirements[0]).to.be.instanceOf(SupportedEnvironmentRequirement);
            expect(iosRequirements.requirements[1]).to.be.instanceOf(XcodeInstalledRequirement);
            expect(iosRequirements.requirements[2]).to.be.instanceOf(SupportedSimulatorRuntimeRequirement);
            expect(iosRequirements.enabled).to.be.true;
        });
    });

    describe('SupportedSimulatorRuntimeRequirement with apiLevel', () => {
        it('Should call enumerateRuntimes with custom apiLevel filter when apiLevel is provided', async () => {
            const apiLevel = '17.0';
            const mockRuntimes: AppleRuntime[] = [
                {
                    buildversion: '21A360',
                    bundlePath:
                        '/Library/Developer/CoreSimulator/Volumes/iOS_21A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.0.simruntime',
                    identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
                    isAvailable: true,
                    isInternal: false,
                    name: 'iOS 17.0',
                    platform: 'iOS',
                    runtimeRoot:
                        '/Library/Developer/CoreSimulator/Volumes/iOS_21A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.0.simruntime/Contents/Resources/RuntimeRoot',
                    runtimeName: 'iOS-17-0',
                    supportedArchitectures: ['x86_64', 'arm64'],
                    supportedDeviceTypes: [],
                    version: '17.0'
                }
            ];

            const enumerateRuntimesMock = stubMethod(
                $$.SANDBOX,
                AppleDeviceManager.prototype,
                'enumerateRuntimes'
            ).resolves(mockRuntimes);
            const requirement = new SupportedSimulatorRuntimeRequirement(logger, apiLevel);

            await requirement.checkFunction();

            expect(enumerateRuntimesMock.calledOnce).to.be.true;
            const callArgs = enumerateRuntimesMock.getCall(0).args[0];
            expect(callArgs).to.deep.equal([{ osType: AppleOSType.iOS, minOSVersion: Version.from(apiLevel) }]);
        });

        it('Should call enumerateRuntimes with undefined when no apiLevel is provided', async () => {
            const mockRuntimes: AppleRuntime[] = [
                {
                    buildversion: '20A360',
                    bundlePath:
                        '/Library/Developer/CoreSimulator/Volumes/iOS_20A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.0.simruntime',
                    identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-16-0',
                    isAvailable: true,
                    isInternal: false,
                    name: 'iOS 16.0',
                    platform: 'iOS',
                    runtimeRoot:
                        '/Library/Developer/CoreSimulator/Volumes/iOS_20A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.0.simruntime/Contents/Resources/RuntimeRoot',
                    runtimeName: 'iOS-16-0',
                    supportedArchitectures: ['x86_64', 'arm64'],
                    supportedDeviceTypes: [],
                    version: '16.0'
                }
            ];

            const enumerateRuntimesMock = stubMethod(
                $$.SANDBOX,
                AppleDeviceManager.prototype,
                'enumerateRuntimes'
            ).resolves(mockRuntimes);
            const requirement = new SupportedSimulatorRuntimeRequirement(logger);

            await requirement.checkFunction();

            expect(enumerateRuntimesMock.calledOnce).to.be.true;
            const callArgs = enumerateRuntimesMock.getCall(0).args[0];
            expect(callArgs).to.be.undefined;
        });

        it('Should handle successful runtime validation with custom apiLevel', async () => {
            const apiLevel = '16.4';
            const mockRuntimes: AppleRuntime[] = [
                {
                    buildversion: '20E247',
                    bundlePath:
                        '/Library/Developer/CoreSimulator/Volumes/iOS_20E247/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.4.simruntime',
                    identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-16-4',
                    isAvailable: true,
                    isInternal: false,
                    name: 'iOS 16.4',
                    platform: 'iOS',
                    runtimeRoot:
                        '/Library/Developer/CoreSimulator/Volumes/iOS_20E247/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.4.simruntime/Contents/Resources/RuntimeRoot',
                    runtimeName: 'iOS-16-4',
                    supportedArchitectures: ['x86_64', 'arm64'],
                    supportedDeviceTypes: [],
                    version: '16.4'
                }
            ];

            stubMethod($$.SANDBOX, AppleDeviceManager.prototype, 'enumerateRuntimes').resolves(mockRuntimes);
            const requirement = new SupportedSimulatorRuntimeRequirement(logger, apiLevel);

            const result = await requirement.checkFunction();

            expect(result).to.include('iOS 16.4');
        });

        it('Should handle error when no runtimes match the custom apiLevel', async () => {
            const apiLevel = '18.0';
            stubMethod($$.SANDBOX, AppleDeviceManager.prototype, 'enumerateRuntimes').resolves([]);
            const requirement = new SupportedSimulatorRuntimeRequirement(logger, apiLevel);

            return requirement.checkFunction().catch((error) => {
                expect(error).to.be.an('error');
                expect(error.message).to.include('No supported simulator runtimes found');
            });
        });

        it('Should handle enumerateRuntimes error with custom apiLevel', async () => {
            const apiLevel = '16.0';
            const mockError = new Error('Runtime enumeration failed');
            stubMethod($$.SANDBOX, AppleDeviceManager.prototype, 'enumerateRuntimes').rejects(mockError);
            const requirement = new SupportedSimulatorRuntimeRequirement(logger, apiLevel);

            return requirement.checkFunction().catch((error) => {
                expect(error).to.be.an('error');
                expect(error.message).to.include('No supported simulator runtimes found');
                expect(error.message).to.include('Runtime enumeration failed');
            });
        });
    });
});
