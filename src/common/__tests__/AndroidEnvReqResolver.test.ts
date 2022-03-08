/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, SfdxError } from '@salesforce/core';
import { AndroidCommandLineToolsResolver } from '../AndroidEnvReqResolver';

const logger = new Logger('test');

describe('Resolver Processing', () => {
    test('Resolves Android SDK successfully', async () => {
        const expectedMessage = 'Success!';
        const resolveFunction = function () {
            return Promise.resolve(expectedMessage);
        };

        const actualMessage = await new AndroidCommandLineToolsResolver(
            logger,
            resolveFunction
        ).resolveFunction();
        expect(actualMessage === expectedMessage).toBeTruthy();
    });

    test('Resolves Android SDK with error', async () => {
        const expectedMessage = 'Error resolving';
        const resolveFunction = function () {
            return Promise.reject(new SfdxError(expectedMessage));
        };

        try {
            await new AndroidCommandLineToolsResolver(
                logger,
                resolveFunction
            ).resolveFunction();
        } catch (error) {
            expect(error instanceof SfdxError).toBeTruthy();
            const sfdxError = error as SfdxError;
            expect(sfdxError.message).toBe(expectedMessage);
        }
    });
});
