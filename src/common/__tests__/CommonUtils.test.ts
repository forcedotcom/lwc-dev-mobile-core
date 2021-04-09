/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages, SfdxError } from '@salesforce/core';
import { CommonUtils } from '../CommonUtils';
import { CommandLineUtils } from '../Common';
import os from 'os';
import fs from 'fs';
import path from 'path';
import util from 'util';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'common'
);

describe('CommonUtils', () => {
    test('replaceTokens function', async () => {
        const template =
            // tslint:disable-next-line:no-invalid-template-strings
            'A quick brown ${animal1} jumped over the lazy ${animal2}';

        const formatted = CommonUtils.replaceTokens(template, {
            animal1: 'fox',
            animal2: 'dog'
        });
        expect(formatted).toBe('A quick brown fox jumped over the lazy dog');

        const notFormatted = CommonUtils.replaceTokens(template, {});
        expect(notFormatted).toBe(
            // tslint:disable-next-line:no-invalid-template-strings
            'A quick brown ${animal1} jumped over the lazy ${animal2}'
        );
    });

    test('createTempDirectory function', async () => {
        const tmpDir = os.tmpdir();
        const folderPrefix = 'lwc-mobile-';
        const tempFolderPath = path.join(tmpDir, folderPrefix);

        const folder = await CommonUtils.createTempDirectory();
        expect(fs.existsSync(folder)).toBeTruthy();
        expect(folder.includes(tempFolderPath)).toBeTruthy();

        jest.spyOn(fs, 'mkdtemp').mockImplementationOnce((_, callback) =>
            callback(new Error(), '')
        );

        try {
            await CommonUtils.createTempDirectory();
        } catch (error) {
            const message = `Could not create a temp folder at ${tempFolderPath}: `;
            expect(error.message.includes(message)).toBeTruthy();
        }
    });

    test('Resolves the server port when it is running with multiple processes', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockReturnValue(
            Promise.resolve({
                stdout: `
                86659 ttys002    0:00.01 bash /usr/local/bin/sfdx force:lightning:lwc:start -p 3456
                86670 ttys002    0:00.00 bash /Users/test/.local/share/sfdx/client/bin/sfdx force:lightning:lwc:start -p 3456
                86675 ttys002    0:00.01 bash /Users/test/.local/share/sfdx/client/bin/../7.91.0-6a6ed69ebe/bin/sfdx force:lightning:lwc:start -p 3456
                86681 ttys002    0:05.81 /Users/test/.local/share/sfdx/client/7.91.0-6a6ed69ebe/bin/node /Users/test/.local/share/sfdx/client/7.91.0-6a6ed69ebe/bin/sfdx.js force:lightning:lwc:start -p 3456
                `,
                stderr: ''
            })
        );

        const port = await CommonUtils.getLwcServerPort();
        expect(port).toBe('3456');
    });

    test('Resolves the server port when it is running with a single process', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockReturnValue(
            Promise.resolve({
                stdout: `86659 ttys002    0:00.01 bash /usr/local/bin/sfdx force:lightning:lwc:start -p 3456`,
                stderr: ''
            })
        );

        const port = await CommonUtils.getLwcServerPort();
        expect(port).toBe('3456');
    });

    test('Cannot resolve the server port when it not running', async () => {
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockReturnValue(
            Promise.reject('')
        );

        const port = await CommonUtils.getLwcServerPort();
        expect(port === undefined).toBe(true);
    });

    test('Opens a URL in desktop browser', async () => {
        let launchCommand = '';
        const url = 'http://my.domain.com';
        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            (cmd) => {
                launchCommand = cmd;
                return Promise.resolve({ stdout: '', stderr: '' });
            }
        );

        await CommonUtils.launchUrlInDesktopBrowser(url);
        expect(launchCommand.endsWith(url)).toBe(true);
    });

    test('Promise resolves before timeout', async () => {
        const innerPromise = CommonUtils.delay(50); // a quick task that finishes in 50 milliseconds
        const promiseWithTimeout = CommonUtils.promiseWithTimeout(
            1000,
            innerPromise,
            'timed out'
        );

        try {
            await promiseWithTimeout;
        } catch (error) {
            fail(
                `Should have resolved b/c innerPromise should finish before timeout: ${error}`
            );
        }
    });

    test('Promise rejects after timeout', async () => {
        const innerPromise = CommonUtils.delay(1000);
        const promiseWithTimeout = CommonUtils.promiseWithTimeout(
            50,
            innerPromise,
            'timed out'
        );

        expect.assertions(1);
        try {
            await promiseWithTimeout;
        } catch (error) {
            expect(error.message === 'timed out').toBe(true);
        }
    });

    test('downloadFile function', async () => {
        const dest = path.join(os.tmpdir(), 'ca.crt');

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile('badurl', dest);
        } catch (error) {
            expect(error instanceof Error).toBe(true);
            expect(fs.existsSync(dest)).toBe(false);
        }

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile('http://badurl', dest);
        } catch (error) {
            expect(error instanceof Error).toBe(true);
            expect(fs.existsSync(dest)).toBe(false);
        }

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile('https://badurl', dest);
        } catch (error) {
            expect(error instanceof Error).toBe(true);
            expect(fs.existsSync(dest)).toBe(false);
        }

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile(
                'https://www.google.com/badurl',
                dest
            );
        } catch (error) {
            expect(error instanceof Error).toBe(true);
            expect(fs.existsSync(dest)).toBe(false);
        }

        // For now don't run this part on Windows b/c our CircleCI
        // environment does not give file write permission.
        if (process.platform !== 'win32') {
            // should pass and create a destination file
            await CommonUtils.downloadFile('https://www.google.com', dest);
            expect(fs.existsSync(dest)).toBe(true);
        }
    });

    test('Platform flag config property returns expected flag', async () => {
        const platformFlagConfig = CommonUtils.platformFlagConfig;
        expect(platformFlagConfig.platform).toBeDefined();
        expect(platformFlagConfig.platform!.longDescription).toBe(
            messages.getMessage('platformFlagDescription')
        );
        expect(platformFlagConfig.platform!.description).toBe(
            messages.getMessage('platformFlagDescription')
        );
    });

    test('API level flag config property returns expected flag', async () => {
        const apiLevelFlagConfig = CommonUtils.apiLevelFlagConfig;
        expect(apiLevelFlagConfig.apilevel).toBeDefined();
        expect(apiLevelFlagConfig.apilevel!.longDescription).toBe(
            messages.getMessage('apiLevelFlagDescription')
        );
        expect(apiLevelFlagConfig.apilevel!.description).toBe(
            messages.getMessage('apiLevelFlagDescription')
        );
    });

    test('iOS does not require API level', async () => {
        const mockFlag = {
            platform: CommandLineUtils.IOS_FLAG
        };
        const resolved = await CommonUtils.validateApiLevelFlag(mockFlag, []);
        expect(resolved).toBeUndefined();
    });

    test('API level validation fails on bad input', async () => {
        const badInput = 'this is a string';
        const recommendations = ['a recommendation message'];
        const mockFlag = {
            apilevel: badInput
        };
        expect.assertions(5);
        try {
            await CommonUtils.validateApiLevelFlag(mockFlag, recommendations);
        } catch (error) {
            expect(error instanceof SfdxError).toBe(true);
            const sfdxError = error as SfdxError;
            const message = util.format(
                messages.getMessage('error:invalidApiLevelFlagsDescription'),
                `Error: Invalid version string: ${badInput}`
            );
            expect(sfdxError.message).toMatch(message);
            expect(sfdxError.actions).toBeDefined();
            expect(sfdxError.actions!.length).toBe(1);
            expect(sfdxError.actions![0]).toBe(recommendations[0]);
        }
    });

    test('API level validation succeeds', async () => {
        const mockFlag = {
            apilevel: '0.1.2'
        };
        const resolved = await CommonUtils.validateApiLevelFlag(mockFlag, []);
        expect(resolved).toBeUndefined();
    });

    test('Platform validation for iOS succeeds', async () => {
        const mockFlag = {
            platform: CommandLineUtils.IOS_FLAG
        };
        const resolved = await CommonUtils.validatePlatformFlag(mockFlag, []);
        expect(resolved).toBeUndefined();
    });

    test('Platform validation for Android succeeds', async () => {
        const mockFlag = {
            platform: CommandLineUtils.ANDROID_FLAG
        };
        const resolved = await CommonUtils.validatePlatformFlag(mockFlag, []);
        expect(resolved).toBeUndefined();
    });

    test('Platform validation fails for unknown platform', async () => {
        const recommendations = ['a recommendation message'];
        const mockFlag = {
            platform: 'Blackberry'
        };
        try {
            await CommonUtils.validatePlatformFlag(mockFlag, recommendations);
        } catch (error) {
            expect(error instanceof SfdxError).toBe(true);
            const sfdxError = error as SfdxError;
            const message = messages.getMessage(
                'error:invalidInputFlagsDescription'
            );
            expect(sfdxError.message).toMatch(message);
            expect(sfdxError.actions).toBeDefined();
            expect(sfdxError.actions!.length).toBe(1);
            expect(sfdxError.actions![0]).toBe(recommendations[0]);
        }
    });
});
