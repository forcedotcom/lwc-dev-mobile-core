/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import * as Config from '@oclif/config';
import { Logger, Messages, SfdxError } from '@salesforce/core';
import util from 'util';
import { LoggerSetup } from '../../../../../../common/LoggerSetup';
import { RequirementProcessor } from '../../../../../../common/Requirements';
import { Setup } from '../setup';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'common'
);

enum PlatformType {
    android = 'android',
    ios = 'ios'
}

const executeSetupMock = jest.fn(
    (): Promise<void> => {
        return Promise.resolve();
    }
);

describe('Setup Tests', () => {
    beforeEach(() => {
        jest.spyOn(
            RequirementProcessor.getInstance(),
            'execute'
        ).mockImplementation(executeSetupMock);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Checks that Setup is initialized correctly for iOS', async () => {
        const setup = makeSetup(PlatformType.ios);
        await setup.run();
        expect(executeSetupMock).toHaveBeenCalled();
    });

    test('Checks that Setup is initialized correctly for Android', async () => {
        const setup = makeSetup(PlatformType.android);
        await setup.run();
        expect(executeSetupMock).toHaveBeenCalled();
    });

    test('Checks that Setup fails for invalid Platform flag', async () => {
        const setup = makeSetup('someplatform');
        expect.assertions(2);
        try {
            await setup.run();
        } catch (error) {
            expect(error instanceof SfdxError).toBe(true);
            expect((error as SfdxError).message).toBe(
                messages.getMessage('error:invalidInputFlagsDescription')
            );
        }
    });

    test('Checks that Setup fails for invalid API Level flag', async () => {
        const setup = makeSetup(PlatformType.android, 'not-a-number');

        expect.assertions(2);
        try {
            await setup.run();
        } catch (error) {
            const expectedMsg = util
                .format(
                    messages.getMessage(
                        'error:invalidApiLevelFlagsDescription'
                    ),
                    ''
                )
                .trim();

            expect(error instanceof SfdxError).toBe(true);
            expect((error as SfdxError).message.includes(expectedMsg)).toBe(
                true
            );
        }
    });

    test('Checks that Setup ignores API Level flag for iOS platform', async () => {
        const setup = makeSetup(PlatformType.ios, 'not-a-number');
        await setup.run();
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
        await setup.run();
        expect(loggerSpy).toHaveBeenCalled();
        expect(LoggerSetupSpy).toHaveBeenCalled();
    });

    test('Messages folder should be loaded', async () => {
        expect.assertions(1);
        expect(Setup.description !== null).toBeTruthy();
    });

    function makeSetup(platform: string, apiLevel?: string): Setup {
        const args = ['-p', platform];
        if (apiLevel) {
            args.push('-a');
            args.push(apiLevel);
        }
        const setup = new Setup(
            args,
            new Config.Config(({} as any) as Config.Options)
        );
        return setup;
    }
});
