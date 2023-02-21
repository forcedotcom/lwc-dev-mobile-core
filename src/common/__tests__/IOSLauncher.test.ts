/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { CommonUtils } from '../CommonUtils';
import { IOSLauncher } from '../IOSLauncher';
import { IOSUtils } from '../IOSUtils';
import { IOSMockData } from './IOSMockData';

describe('IOS Launcher tests', () => {
    let myCommandRouterBlock: jest.Mock<any, [command: string], any>;

    beforeEach(() => {
        myCommandRouterBlock = jest.fn(
            (command: string): Promise<{ stdout: string; stderr: string }> => {
                let output = '';
                if (command.endsWith('simctl list --json devicetypes')) {
                    output = JSON.stringify(IOSMockData.mockRuntimeDeviceTypes);
                } else if (
                    command.endsWith('simctl list --json devices available')
                ) {
                    output = JSON.stringify(IOSMockData.mockRuntimeDevices);
                } else {
                    output = JSON.stringify(IOSMockData.mockRuntimes);
                }
                return new Promise((resolve) => {
                    resolve({
                        stderr: '',
                        stdout: output
                    });
                });
            }
        );

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        jest.spyOn(CommonUtils, 'startCliAction').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Should attempt to invoke preview in mobile browser', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );

        jest.spyOn(IOSUtils, 'launchSimulatorApp').mockReturnValue(
            Promise.resolve()
        );

        jest.spyOn(IOSUtils, 'bootDevice').mockReturnValue(Promise.resolve());

        const launchUrlMock = jest.fn(() => Promise.resolve());
        jest.spyOn(IOSUtils, 'launchURLInBootedSimulator').mockImplementation(
            launchUrlMock
        );

        const launcher = new IOSLauncher('iPhone 11 Pro');
        await launcher.launchPreview(
            'helloWorld',
            '~',
            undefined,
            'browser',
            undefined,
            '3333'
        );

        expect(launchUrlMock).toHaveBeenCalledWith(
            'F2B4097F-F33E-4D8A-8FFF-CE49F8D6C178',
            'http://localhost:3333/lwc/preview/c/helloWorld'
        );
    });

    test('Should attempt to invoke preview in native app', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );

        jest.spyOn(IOSUtils, 'launchSimulatorApp').mockReturnValue(
            Promise.resolve()
        );

        jest.spyOn(IOSUtils, 'bootDevice').mockReturnValue(Promise.resolve());

        const launchAppMock = jest.fn(() => Promise.resolve());
        jest.spyOn(IOSUtils, 'launchAppInBootedSimulator').mockImplementation(
            launchAppMock
        );

        const launcher = new IOSLauncher('iPhone 11 Pro');
        await launcher.launchPreview(
            'helloWorld',
            '~',
            undefined,
            'com.salesforce.test',
            undefined,
            '3333'
        );

        expect(launchAppMock).toHaveBeenCalledWith(
            'F2B4097F-F33E-4D8A-8FFF-CE49F8D6C178',
            'helloWorld',
            '~',
            undefined,
            'com.salesforce.test',
            [],
            undefined,
            undefined
        );
    });
});
