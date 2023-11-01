/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Config } from '@oclif/core/lib/config';
import { Options } from '@oclif/core/lib/interfaces';
import { Messages, SfError } from '@salesforce/core';
import util from 'util';
import { LoggerSetup } from '../../../../../../common/LoggerSetup';
import { RequirementProcessor } from '../../../../../../common/Requirements';
import { Setup } from '../setup';

Messages.importMessagesDirectory(__dirname);

describe('Setup Tests', () => {
    const messages = Messages.loadMessages(
        '@salesforce/lwc-dev-mobile-core',
        'common'
    );

    enum PlatformType {
        android = 'android',
        ios = 'ios'
    }

    let executeSetupMock: jest.Mock<any, [], any>;

    beforeEach(() => {
        executeSetupMock = jest.fn((): Promise<void> => {
            return Promise.resolve();
        });

        jest.spyOn(RequirementProcessor, 'execute').mockImplementation(
            executeSetupMock
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Checks that Setup is initialized correctly for iOS', async () => {
        const setup = makeSetup(PlatformType.ios);
        await setup.init();
        await setup.run();
        expect(executeSetupMock).toHaveBeenCalled();
    });

    test('Checks that Setup is initialized correctly for Android', async () => {
        const setup = makeSetup(PlatformType.android);
        await setup.init();
        await setup.run();
        expect(executeSetupMock).toHaveBeenCalled();
    });

    test('Checks that Setup fails for invalid Platform flag', async () => {
        const setup = makeSetup('someplatform');
        expect.assertions(2);
        try {
            await setup.init();
            await setup.run();
        } catch (error) {
            expect(error instanceof SfError).toBe(true);
            expect((error as SfError).message).toContain(
                util.format(
                    messages.getMessage('error:invalidFlagValue'),
                    'someplatform'
                )
            );
        }
    });

    test('Checks that Setup will still validate API Level flag for iOS platform if passed a value', async () => {
        const setup = makeSetup(PlatformType.ios, '1.2.3');
        await setup.init();
        await setup.run();
        expect(executeSetupMock).toHaveBeenCalled();
    });

    test('Logger must be initialized and invoked', async () => {
        const LoggerSetupSpy = jest.spyOn(
            LoggerSetup,
            'initializePluginLoggers'
        );

        const setup = makeSetup(PlatformType.ios);
        await setup.init();

        const loggerSpy = jest.spyOn(setup.logger, 'info');

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
            args.push('-l');
            args.push(apiLevel);
        }
        const setup = new Setup(args, new Config({} as Options));
        return setup;
    }
});
