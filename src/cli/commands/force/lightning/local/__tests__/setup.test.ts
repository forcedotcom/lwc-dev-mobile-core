/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import * as Config from '@oclif/config';
import { Logger } from '@salesforce/core';
import { CommandLineUtils } from '../../../../../../common/Common';
import { LoggerSetup } from '../../../../../../common/LoggerSetup';
import {
    BaseSetup,
    SetupTestResult
} from '../../../../../../common/Requirements';
import { Setup } from '../setup';
enum PlatformType {
    android = 'android',
    ios = 'ios'
}

const platformFlagIsValidMock = jest.fn(() => {
    return true;
});

const executeSetupMock = jest.fn(
    (): Promise<SetupTestResult> => {
        return Promise.resolve({ hasMetAllRequirements: true, tests: [] });
    }
);

describe('Setup Tests', () => {
    beforeEach(() => {
        jest.spyOn(CommandLineUtils, 'platformFlagIsValid').mockImplementation(
            platformFlagIsValidMock
        );
        jest.spyOn(BaseSetup.prototype, 'executeSetup').mockImplementation(
            executeSetupMock
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Checks that Setup is initialized correctly for iOS', async () => {
        const setup = makeSetup(PlatformType.ios);
        await setup.run(true);
        expect(platformFlagIsValidMock).toHaveBeenCalledWith(PlatformType.ios);
        expect(executeSetupMock).toHaveBeenCalled();
    });

    test('Checks that Setup is initialized correctly for Android', async () => {
        const setup = makeSetup(PlatformType.android);
        await setup.run(true);
        expect(platformFlagIsValidMock).toHaveBeenCalledWith(
            PlatformType.android
        );
        expect(executeSetupMock).toHaveBeenCalled();
    });

    test('Logger must be initialized and invoked', async () => {
        const logger = new Logger('test-logger');
        const loggerSpy = jest.spyOn(logger, 'info');
        const setup = makeSetup(PlatformType.ios);
        jest.spyOn(Logger, 'child').mockReturnValue(Promise.resolve(logger));
        const LoggerSetupSpy = jest.spyOn(
            LoggerSetup,
            'initializePluginLoggers'
        );
        await setup.run(true);
        expect(loggerSpy).toHaveBeenCalled();
        expect(LoggerSetupSpy).toHaveBeenCalled();
    });

    test('Messages folder should be loaded', async () => {
        expect.assertions(1);
        expect(Setup.description !== null).toBeTruthy();
    });

    function makeSetup(platform: PlatformType): Setup {
        const setup = new Setup(
            ['-p', platform],
            new Config.Config(({} as any) as Config.Options)
        );
        return setup;
    }
});
