/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { CommonUtils } from '../CommonUtils';
import os from 'os';
import fs from 'fs';

describe('CommonUtils', () => {
    test('interpolate function', async () => {
        const template =
            // tslint:disable-next-line:no-invalid-template-strings
            'A quick brown ${animal1} jumped over the lazy ${animal2}';

        const formatted = CommonUtils.interpolate(template, {
            animal1: 'fox',
            animal2: 'dog'
        });
        expect(formatted).toBe('A quick brown fox jumped over the lazy dog');

        try {
            CommonUtils.interpolate(template, {});
        } catch (e) {
            expect(e.message).toBe(
                "Can't find a value for the key 'animal1' in the property bag parameter."
            );
        }
    });

    test('createTempDirectory function', async () => {
        const tmpDir = os.tmpdir();

        let folder = await CommonUtils.createTempDirectory();
        expect(fs.existsSync(folder)).toBeTruthy();
        expect(folder.includes(tmpDir)).toBeTruthy();

        folder = await CommonUtils.createTempDirectory('');
        expect(fs.existsSync(folder)).toBeTruthy();
        expect(folder.includes(tmpDir)).toBeTruthy();

        const errorMessage = 'Error creating a temp folder';
        jest.spyOn(fs, 'mkdtemp').mockImplementationOnce((_, callback) =>
            callback(new Error(errorMessage), '')
        );
        try {
            CommonUtils.createTempDirectory();
        } catch (e) {
            expect(e.message).toBe(errorMessage);
        }
    });
});
