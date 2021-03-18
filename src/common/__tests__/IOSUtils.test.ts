/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
// tslint:disable: no-unused-expression
import { CommonUtils } from '../CommonUtils';
import { IOSUtils } from '../IOSUtils';
import { PreviewUtils } from '../PreviewUtils';
import { IOSMockData } from './IOSMockData';

const DEVICE_TYPE_PREFIX = 'com.apple.CoreSimulator.SimDeviceType';
const RUNTIME_TYPE_PREFIX = 'com.apple.CoreSimulator.SimRuntime';

const myCommandRouterBlock = jest.fn(
    (command: string): Promise<{ stdout: string; stderr: string }> => {
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
    }
);

const badBlockMock = jest.fn(
    (): Promise<{ stdout: string; stderr: string }> => {
        return new Promise((resolve) => {
            resolve({ stdout: '{[}', stderr: 'mockError' });
        });
    }
);

const launchCommandMock = jest.fn(
    (): Promise<{ stdout: string; stderr: string }> => {
        return new Promise((resolve) => {
            resolve({
                stderr: 'mockError',
                stdout: 'Done'
            });
        });
    }
);

const launchCommandThrowsMock = jest.fn(
    (): Promise<{ stdout: string; stderr: string }> => {
        throw new Error(' Mock Error');
    }
);

const launchCommandThrowsAlreadyBootedMock = jest.fn(
    (): Promise<{ stdout: string; stderr: string }> => {
        return Promise.reject(
            new Error('The device is cannot boot state: booted')
        );
    }
);

describe('IOS utils tests', () => {
    beforeEach(() => {
        // tslint:disable-next-line: no-empty
        jest.spyOn(CommonUtils, 'startCliAction').mockImplementation(() => {});
        myCommandRouterBlock.mockClear();
        launchCommandMock.mockClear();
        badBlockMock.mockClear();
        launchCommandThrowsMock.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Should attempt to invoke the xcrun for fetching sim runtimes', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );
        await IOSUtils.getSimulatorRuntimes();
        expect(myCommandRouterBlock).toHaveBeenCalled();
    });

    test('Should attempt to invoke the xcrun for booting a device', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );
        const udid = 'MOCKUDID';
        await IOSUtils.bootDevice(udid);
        expect(launchCommandMock).toHaveBeenCalledWith(
            `/usr/bin/xcrun simctl boot ${udid}`
        );
    });

    test('Should attempt to invoke the xcrun but fail booting a device', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandThrowsMock
        );
        const udid = 'MOCKUDID';
        return IOSUtils.bootDevice(udid).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should attempt to create a new device', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );
        const simName = 'MOCKSIM';
        const deviceType = 'MOCK-DEVICE';
        const runtimeType = 'MOCK-SIM';
        await IOSUtils.createNewDevice(simName, deviceType, runtimeType);
        expect(launchCommandMock).toHaveBeenCalledWith(
            `/usr/bin/xcrun simctl create '${simName}' ${DEVICE_TYPE_PREFIX}.${deviceType} ${RUNTIME_TYPE_PREFIX}.${runtimeType}`
        );
    });

    test('Should attempt to invoke xcrun to boot device but resolve if device is already Booted', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandThrowsAlreadyBootedMock
        );
        const udid = 'MOCKUDID';
        const aPromise = IOSUtils.bootDevice(udid);
        expect(aPromise).resolves;
    });

    test('Should wait for the device to boot', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );
        const udid = 'MOCKUDID';
        const aPromise = IOSUtils.waitUntilDeviceIsReady(udid);
        expect(aPromise).resolves;
    });

    test('Should wait for the device to boot and fail if error is encountered', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandThrowsMock
        );
        const udid = 'MOCKUDID';
        return IOSUtils.waitUntilDeviceIsReady(udid).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should launch the simulator app', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );
        await IOSUtils.launchSimulatorApp();
        expect(launchCommandMock).toHaveBeenCalledWith(`open -a Simulator`);
    });

    test('Should reject if launch of simulator app fails', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandThrowsMock
        );
        return IOSUtils.launchSimulatorApp().catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should attempt to launch url in a booted simulator and resolve.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );
        const url = 'mock.url';
        const udid = 'MOCK-UDID';
        await IOSUtils.launchURLInBootedSimulator(url, udid);
        expect(launchCommandMock).toHaveBeenCalledWith(
            `/usr/bin/xcrun simctl openurl "${url}" ${udid}`
        );
    });

    test('Should attempt to launch url in a booted simulator and reject if error is encountered.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandThrowsMock
        );
        const url = 'mock.url';
        const udid = 'MOCK-UDID';
        return IOSUtils.launchURLInBootedSimulator(url, udid).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('Should attempt to launch native app in a booted simulator and resolve.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );

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
            ` arg1=val1 arg2=val2`;

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

        expect(launchCommandMock).toBeCalledTimes(2);

        expect(launchCommandMock).nthCalledWith(
            1,
            `/usr/bin/xcrun simctl terminate "${udid}" ${targetApp}`
        );

        expect(launchCommandMock).nthCalledWith(
            2,
            `/usr/bin/xcrun simctl launch "${udid}" ${targetApp} ${launchArgs}`
        );
    });

    test('Should attempt to launch native app in a booted simulator and reject if error is encountered.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandThrowsMock
        );
        const udid = 'MOCK-UDID';
        const compName = 'mock.compName';
        const projectDir = '/mock/path';
        const targetApp = 'com.mock.app';
        const targetAppArgs = [
            { name: 'arg1', value: 'val1' },
            { name: 'arg2', value: 'val2' }
        ];
        return IOSUtils.launchAppInBootedSimulator(
            udid,
            compName,
            projectDir,
            undefined,
            targetApp,
            targetAppArgs,
            undefined,
            undefined
        ).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('SShould attempt to install native app then launch it.', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            launchCommandMock
        );

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
            ` arg1=val1 arg2=val2`;

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

        expect(launchCommandMock).toBeCalledTimes(3);

        expect(launchCommandMock).nthCalledWith(
            1,
            `/usr/bin/xcrun simctl install ${udid} '${appBundlePath.trim()}'`
        );

        expect(launchCommandMock).nthCalledWith(
            2,
            `/usr/bin/xcrun simctl terminate "${udid}" ${targetApp}`
        );

        expect(launchCommandMock).nthCalledWith(
            3,
            `/usr/bin/xcrun simctl launch "${udid}" ${targetApp} ${launchArgs}`
        );
    });

    test('Should attempt to invoke the xcrun for fetching sim runtimes and return an array of values', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );
        return IOSUtils.getSimulatorRuntimes().then((returnedValues) => {
            expect(
                returnedValues !== null &&
                    returnedValues.length ===
                        IOSMockData.mockRuntimes.runtimes.length
            ).toBeTruthy();
        });
    });

    test('Should attempt to invoke the xcrun for fetching supported runtimes and return whitelisted values', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );
        return IOSUtils.getSupportedRuntimes().then((returnedValues) => {
            expect(
                returnedValues !== null && returnedValues.length > 0
            ).toBeTruthy();
        });
    });

    test('Should attempt to invoke the xcrun for fetching supported devices and return whitelisted values', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );
        return IOSUtils.getSupportedDevices().then((returnedValues) => {
            expect(
                returnedValues !== null && returnedValues.length > 0
            ).toBeTruthy();
        });
    });

    test('Should attempt to invoke the xcrun for fetching supported sims', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );
        return IOSUtils.getSupportedSimulators().then((returnedValues) => {
            expect(
                returnedValues !== null && returnedValues.length > 0
            ).toBeTruthy();
        });
    });

    test('Should attempt to fetch a sim', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myCommandRouterBlock
        );

        const found = await IOSUtils.getSimulator('iPhone 11 Pro');
        const notFound = await IOSUtils.getSimulator('blah');
        expect(found && found.name === 'iPhone 11 Pro').toBe(true);
        expect(notFound === null).toBe(true);
    });

    test('Should handle Bad JSON', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            badBlockMock
        );
        return IOSUtils.getSimulatorRuntimes().catch((error) => {
            expect(error).toBeTruthy();
        });
    });
});
