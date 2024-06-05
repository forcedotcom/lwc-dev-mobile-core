/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
const ORIG_ANDROID_HOME = process.env.ANDROID_HOME;
const MOCK_ANDROID_HOME = '/mock-android-home';
process.env.ANDROID_HOME = MOCK_ANDROID_HOME;

import fs from 'node:fs';
import path from 'node:path';
import { Logger, Messages } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import {
    AndroidSDKPlatformToolsInstalledRequirement,
    AndroidSDKRootSetRequirement,
    AndroidSDKToolsInstalledRequirement,
    EmulatorImagesRequirement,
    Java8AvailableRequirement,
    PlatformAPIPackageRequirement
} from '../../../src/common/AndroidEnvironmentRequirements.js';
import { AndroidPackage } from '../../../src/common/AndroidTypes.js';
import { AndroidSDKRootSource, AndroidUtils } from '../../../src/common/AndroidUtils.js';
import { Version } from '../../../src/common/Common.js';
import { CommonUtils } from '../../../src/common/CommonUtils.js';
import { PlatformConfig } from '../../../src/common/PlatformConfig.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('Android environment requirement tests', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'requirement-android');

    const $$ = new TestContext();
    const logger = new Logger('test');
    const mockCmdLineToolsBin = CommonUtils.convertToUnixPath(
        path.join(MOCK_ANDROID_HOME, 'cmdline-tools', 'latest', 'bin')
    );

    beforeEach(() => {
        process.env.ANDROID_HOME = MOCK_ANDROID_HOME;
        stubMethod($$.SANDBOX, fs, 'existsSync').returns(true);
    });

    afterEach(() => {
        process.env.ANDROID_HOME = ORIG_ANDROID_HOME;
        $$.restore();
    });

    it('Should resolve when Android SDK root is set', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'getAndroidSdkRoot').returns({
            rootLocation: '/mock-android-home',
            rootSource: AndroidSDKRootSource.androidHome
        });
        const requirement = new AndroidSDKRootSetRequirement(logger);
        const result = await requirement.checkFunction();
        expect(result).to.contain('/mock-android-home');
    });

    it('Should reject when Android SDK root is not set', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'getAndroidSdkRoot').returns(undefined);
        const requirement = new AndroidSDKRootSetRequirement(logger);
        return requirement
            .checkFunction()
            .catch((error) =>
                expect(error)
                    .to.be.an('error')
                    .with.property('message', messages.getMessage('android:reqs:androidhome:unfulfilledMessage'))
            );
    });

    it('Should resolve when Android sdk tools are present', async () => {
        stubMethod($$.SANDBOX, fs, 'readdirSync').returns(['latest']);
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({});
        const requirement = new AndroidSDKToolsInstalledRequirement(logger);
        const result = await requirement.checkFunction();
        expect(result).to.contain(mockCmdLineToolsBin);
    });

    it('Should reject when Android sdk tools are missing', async () => {
        const requirement = new AndroidSDKToolsInstalledRequirement(logger);
        return requirement
            .checkFunction()
            .catch((error) =>
                expect(error)
                    .to.be.an('error')
                    .with.property('message', messages.getMessage('android:reqs:cmdlinetools:unfulfilledMessage'))
            );
    });

    it('Should resolve when Android sdk platform tools are present', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandSync').returns(MOCK_ANDROID_HOME);
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({});
        const requirement = new AndroidSDKPlatformToolsInstalledRequirement(logger);
        const result = await requirement.checkFunction();
        expect(result).to.contain(`${MOCK_ANDROID_HOME}/platform-tools`);
    });

    it('Should reject when Android sdk platform tools are missing', async () => {
        const requirement = new AndroidSDKPlatformToolsInstalledRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property(
                    'message',
                    messages.getMessage('android:reqs:platformtools:unfulfilledMessage', [
                        PlatformConfig.androidConfig().minSupportedRuntime
                    ])
                )
        );
    });

    it('Should resolve when Java 8 is available', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'androidSDKPrerequisitesCheck').resolves('');
        const requirement = new Java8AvailableRequirement(logger);
        const result = await requirement.checkFunction();
        expect(result).to.equal(messages.getMessage('android:reqs:androidsdkprerequisitescheck:fulfilledMessage'));
    });

    it('Should reject when Java 8 is not available', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'androidSDKPrerequisitesCheck').rejects(new Error('some error'));
        const requirement = new Java8AvailableRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property(
                    'message',
                    messages.getMessage('android:reqs:androidsdkprerequisitescheck:unfulfilledMessage', ['some error'])
                )
        );
    });

    it('Should resolve when required platform API packages are present', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'fetchSupportedAndroidAPIPackage').resolves(
            new AndroidPackage('some/platform/path', new Version(0, 0, 0), '', '')
        );
        const requirement = new PlatformAPIPackageRequirement(logger);
        const result = await requirement.checkFunction();
        expect(result).to.equal(
            messages.getMessage('android:reqs:platformapi:fulfilledMessage', ['some/platform/path'])
        );
    });

    it('Should reject when required platform API packages are not present', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'fetchSupportedAndroidAPIPackage').rejects();
        const requirement = new PlatformAPIPackageRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property(
                    'message',
                    messages.getMessage('android:reqs:platformapi:unfulfilledMessage', [
                        PlatformConfig.androidConfig().minSupportedRuntime
                    ])
                )
        );
    });

    it('Should resolve when required emulator images are available', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'fetchSupportedEmulatorImagePackage').resolves(
            new AndroidPackage('some/platform/path', new Version(0, 0, 0), '', '')
        );
        const requirement = new EmulatorImagesRequirement(logger);
        const result = await requirement.checkFunction();
        expect(result).to.equal(
            messages.getMessage('android:reqs:emulatorimages:fulfilledMessage', ['some/platform/path'])
        );
    });

    it('Should reject when when required emulator images are not available', async () => {
        stubMethod($$.SANDBOX, AndroidUtils, 'fetchSupportedEmulatorImagePackage').rejects();
        const requirement = new EmulatorImagesRequirement(logger);
        return requirement.checkFunction().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property(
                    'message',
                    messages.getMessage('android:reqs:emulatorimages:unfulfilledMessage', [
                        PlatformConfig.androidConfig().supportedImages.join(',')
                    ])
                )
        );
    });
});
