/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import path from 'path';
import { CommonUtils } from '../CommonUtils';
import { AndroidLauncher } from '../AndroidLauncher';
import { AndroidSDKRootSource, AndroidUtils } from '../AndroidUtils';
import { AndroidMockData } from './AndroidMockData';

const myCommandBlockMock = jest.fn(
    (): Promise<{ stdout: string; stderr: string }> =>
        Promise.resolve({
            stderr: '',
            stdout: AndroidMockData.mockRawPackagesString
        })
);

const mockAndroidHome = '/mock-android-home';
const mockCmdLineToolsBin = path.normalize(
    path.join(mockAndroidHome, 'cmdline-tools', 'latest', 'bin')
);

describe('Android Launcher tests', () => {
    beforeEach(() => {
        // tslint:disable-next-line: no-empty
        jest.spyOn(CommonUtils, 'startCliAction').mockImplementation(() => {});
        jest.spyOn(AndroidUtils, 'getAndroidSdkRoot').mockImplementation(() => {
            return {
                rootLocation: mockAndroidHome,
                rootSource: AndroidSDKRootSource.androidHome
            };
        });
        jest.spyOn(AndroidUtils, 'getAndroidCmdLineToolsBin').mockReturnValue(
            mockCmdLineToolsBin
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Should attempt to invoke preview in mobile browser', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );

        jest.spyOn(AndroidUtils, 'hasEmulator').mockReturnValue(
            Promise.resolve(true)
        );

        jest.spyOn(AndroidUtils, 'startEmulator').mockReturnValue(
            Promise.resolve(5572)
        );

        const launchUrlMock = jest.fn(() => Promise.resolve());
        jest.spyOn(AndroidUtils, 'launchURLIntent').mockImplementation(
            launchUrlMock
        );

        const launcher = new AndroidLauncher('Pixel XL');
        await launcher.launchPreview(
            'helloWorld',
            '~',
            undefined,
            'browser',
            undefined,
            '3333'
        );

        expect(launchUrlMock).toHaveBeenCalledWith(
            'http://10.0.2.2:3333/lwc/preview/c/helloWorld',
            5572
        );
    });

    test('Should attempt to invoke preview in native app', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandBlockMock
        );

        jest.spyOn(AndroidUtils, 'hasEmulator').mockReturnValue(
            Promise.resolve(true)
        );

        jest.spyOn(AndroidUtils, 'startEmulator').mockReturnValue(
            Promise.resolve(5572)
        );

        const launchAppMock = jest.fn(() => Promise.resolve());
        jest.spyOn(AndroidUtils, 'launchNativeApp').mockImplementation(
            launchAppMock
        );

        const launcher = new AndroidLauncher('Pixel XL');
        await launcher.launchPreview(
            'helloWorld',
            '~',
            undefined,
            'com.salesforce.test',
            undefined,
            '3333'
        );

        expect(launchAppMock).toHaveBeenCalledWith(
            'helloWorld',
            '~',
            undefined,
            'com.salesforce.test',
            [],
            '',
            5572,
            undefined,
            undefined
        );
    });
});
