/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger } from '@salesforce/core';
import { CommonUtils } from '../CommonUtils';
import {
    SupportedEnvironmentRequirement,
    SupportedSimulatorRuntimeRequirement,
    XcodeInstalledRequirement
} from '../IOSEnvironmentRequirements';
import { IOSUtils } from '../IOSUtils';

describe('IOS Environment Requirement tests', () => {
    const logger = new Logger('test-IOSEnvironmentRequirement');

    let myUnameMock: jest.Mock<any, [], any>;
    let badBadMock: jest.Mock<any, [], any>;
    let myXcodeSelectMock: jest.Mock<any, [], any>;
    let runtimesMockBlock: jest.Mock<any, [], any>;

    beforeEach(() => {
        myUnameMock = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> => {
                return Promise.resolve({
                    stdout: 'Darwin',
                    stderr: 'mockError'
                });
            }
        );

        badBadMock = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> => {
                return new Promise((_, reject) => {
                    reject(new Error('Bad bad mock!'));
                });
            }
        );

        myXcodeSelectMock = jest.fn(
            (): Promise<{ stdout: string; stderr: string }> => {
                return Promise.resolve({
                    stderr: 'mockError',
                    stdout: '/Applications/Xcode.app/Contents/Developer'
                });
            }
        );

        runtimesMockBlock = jest.fn((): Promise<string[]> => {
            return Promise.resolve(['iOS-13-1']);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Should attempt to validate supported OS environment', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myUnameMock
        );
        const requirement = new SupportedEnvironmentRequirement(logger);
        await requirement.checkFunction();
        expect(myUnameMock).toHaveBeenCalledWith('/usr/bin/uname');
    });

    it('Should throw an error for an unsupported OS environment', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            badBadMock
        );
        const requirement = new SupportedEnvironmentRequirement(logger);
        return requirement.checkFunction().catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    it('Checks to see that the logger is set', async () => {
        const logInfo = jest.spyOn(logger, 'info');
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myUnameMock
        );
        const requirement = new SupportedEnvironmentRequirement(logger);
        await requirement.checkFunction();
        expect(logInfo).toHaveBeenCalled();
    });

    it('Should attempt to validate supported Xcode environment', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            myXcodeSelectMock
        );
        const requirement = new XcodeInstalledRequirement(logger);
        await requirement.checkFunction();
        expect(myXcodeSelectMock).toHaveBeenCalledWith('xcodebuild -version');
    });

    it('Should throw an error for unsupported Xcode Env', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            badBadMock
        );
        const requirement = new XcodeInstalledRequirement(logger);
        return requirement.checkFunction().catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    it('Should attempt to validate supported Xcode runtime environments', async () => {
        jest.spyOn(IOSUtils, 'getSimulatorRuntimes').mockImplementation(
            runtimesMockBlock
        );
        const requirement = new SupportedSimulatorRuntimeRequirement(logger);
        await requirement.checkFunction();
        expect(runtimesMockBlock).toHaveBeenCalled();
    });

    it('Should throw an error for unsupported Xcode runtime environments', async () => {
        const badMock = jest.fn((): Promise<string[]> => {
            return Promise.reject(new Error('Bad mock!'));
        });
        jest.spyOn(IOSUtils, 'getSimulatorRuntimes').mockImplementation(
            badMock
        );
        const requirement = new SupportedSimulatorRuntimeRequirement(logger);
        return requirement.checkFunction().catch((error) => {
            expect(error).toBeTruthy();
        });
    });
});
