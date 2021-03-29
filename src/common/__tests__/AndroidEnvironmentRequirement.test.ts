/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
const ORIG_ANDROID_HOME = process.env.ANDROID_HOME;
// tslint:disable: no-unused-expression
const MOCK_ANDROID_HOME = '/mock-android-home';
process.env.ANDROID_HOME = MOCK_ANDROID_HOME;

import { Logger, Messages } from '@salesforce/core';
import {
    AndroidEnvironmentRequirement,
    AndroidSDKPlatformToolsInstalledRequirement,
    AndroidSDKRootSetRequirement,
    AndroidSDKToolsInstalledRequirement,
    EmulatorImagesRequirement,
    Java8AvailableRequirement,
    PlatformAPIPackageRequirement
} from '../AndroidEnvironmentRequirement';
import { AndroidPackage } from '../AndroidTypes';
import { AndroidSDKRootSource, AndroidUtils } from '../AndroidUtils';
import { Version } from '../Common';
import { CommonUtils } from '../CommonUtils';
import { AndroidMockData } from './AndroidMockData';

const myCommandBlockMock = jest.fn((): string => {
    return AndroidMockData.mockRawPackagesString;
});

const badBlockMock = jest.fn((): string => {
    return AndroidMockData.badMockRawPackagesString;
});

Messages.importMessagesDirectory(__dirname);
const logger = new Logger('test');

describe('Android enviroment requirement tests', () => {
    let androidEnvironment: AndroidEnvironmentRequirement;

    beforeEach(() => {
        androidEnvironment = new AndroidEnvironmentRequirement(logger);
    });

    afterEach(() => {
        myCommandBlockMock.mockClear();
        badBlockMock.mockClear();
    });

    test('Should resolve when Android SDK root is set', async () => {
        jest.spyOn(AndroidUtils, 'getAndroidSdkRoot').mockImplementation(() => {
            return {
                rootLocation: '/mock-android-home',
                rootSource: AndroidSDKRootSource.androidHome
            };
        });
        const requirement = new AndroidSDKRootSetRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).resolves;
    });

    test('Should reject when Android SDK root is not set', async () => {
        jest.spyOn(AndroidUtils, 'getAndroidSdkRoot').mockImplementation(
            () => undefined
        );
        const requirement = new AndroidSDKRootSetRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).rejects;
    });

    test('Should resolve when Android sdk tools are present', async () => {
        jest.spyOn(CommonUtils, 'executeCommandSync').mockImplementation(
            () => MOCK_ANDROID_HOME
        );
        const requirement = new AndroidSDKToolsInstalledRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).resolves;
    });

    test('Should reject when Android sdk tools are missing', async () => {
        jest.spyOn(CommonUtils, 'executeCommandSync').mockImplementation(() => {
            throw new Error('None');
        });
        const requirement = new AndroidSDKToolsInstalledRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).rejects;
    });

    test('Should resolve when Android sdk platform tools are present', async () => {
        jest.spyOn(CommonUtils, 'executeCommandSync').mockImplementation(
            () => MOCK_ANDROID_HOME
        );
        const requirement = new AndroidSDKPlatformToolsInstalledRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).resolves;
    });

    test('Should reject when Android sdk platform tools are missing', async () => {
        jest.spyOn(CommonUtils, 'executeCommandSync').mockImplementation(() => {
            throw new Error('None');
        });
        const requirement = new AndroidSDKPlatformToolsInstalledRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).rejects;
    });

    test('Should resolve when Java 8 is available', async () => {
        jest.spyOn(
            AndroidUtils,
            'androidSDKPrerequisitesCheck'
        ).mockImplementation(() => Promise.resolve(''));
        const requirement = new Java8AvailableRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).resolves;
    });

    test('Should reject when Java 8 is not available', async () => {
        jest.spyOn(
            AndroidUtils,
            'androidSDKPrerequisitesCheck'
        ).mockImplementation(() => Promise.reject(''));
        const requirement = new Java8AvailableRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).rejects;
    });

    test('Should resolve when required platform API packages are present', async () => {
        jest.spyOn(
            AndroidUtils,
            'fetchSupportedAndroidAPIPackage'
        ).mockImplementation(() =>
            Promise.resolve(
                new AndroidPackage('', new Version(0, 0, 0), '', '')
            )
        );
        const requirement = new PlatformAPIPackageRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).resolves;
    });

    test('Should reject when required platform API packages are not present', async () => {
        jest.spyOn(
            AndroidUtils,
            'fetchSupportedAndroidAPIPackage'
        ).mockImplementation(() => Promise.reject(''));
        const requirement = new PlatformAPIPackageRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).rejects;
    });

    test('Should resolve when required emulator images are available', async () => {
        jest.spyOn(
            AndroidUtils,
            'fetchSupportedEmulatorImagePackage'
        ).mockImplementation(() =>
            Promise.resolve(
                new AndroidPackage('', new Version(0, 0, 0), '', '')
            )
        );
        const requirement = new EmulatorImagesRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).resolves;
    });

    test('Should reject when Java 8 is not available', async () => {
        jest.spyOn(
            AndroidUtils,
            'fetchSupportedEmulatorImagePackage'
        ).mockImplementation(() => Promise.reject(''));
        const requirement = new EmulatorImagesRequirement(
            androidEnvironment.requirementMessages,
            logger
        );
        const aPromise = requirement.checkFunction().catch(() => undefined);
        expect(aPromise).rejects;
    });
});
