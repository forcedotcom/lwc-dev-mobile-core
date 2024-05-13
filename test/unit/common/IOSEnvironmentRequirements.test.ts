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
import { CommonUtils } from '../../../src/common/CommonUtils.js';
import {
    SupportedEnvironmentRequirement,
    SupportedSimulatorRuntimeRequirement,
    XcodeInstalledRequirement
} from '../../../src/common/IOSEnvironmentRequirements.js';
import { IOSUtils } from '../../../src/common/IOSUtils.js';

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
        expect(execCmdAsyncMock.calledWith('/usr/bin/uname'));
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
        expect(execCmdAsyncMock.calledWith('xcodebuild -version'));
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
        const getSimRuntimesMock = stubMethod($$.SANDBOX, IOSUtils, 'getSimulatorRuntimes').resolves(['iOS-13-1']);
        const requirement = new SupportedSimulatorRuntimeRequirement(logger);
        await requirement.checkFunction();
        expect(getSimRuntimesMock.calledOnce).to.be.true;
    });

    it('Should throw an error for unsupported Xcode runtime environments', async () => {
        stubMethod($$.SANDBOX, IOSUtils, 'getSimulatorRuntimes').rejects(new Error('Bad bad mock!'));
        const requirement = new SupportedSimulatorRuntimeRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property('message')
                .that.includes(messages.getMessage('ios:reqs:simulator:unfulfilledMessage', ['']))
        );
    });
});
