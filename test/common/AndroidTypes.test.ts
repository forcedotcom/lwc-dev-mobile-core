/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { expect } from 'chai';
import { AndroidPackages } from '../../src/common/AndroidTypes.js';
import { AndroidMockData } from './AndroidMockData.js';

describe('Android types tests', () => {
    it('Android Package class should correctly parse a raw string', async () => {
        const packages = AndroidPackages.parseRawPackagesString(AndroidMockData.mockRawPackagesString);
        expect(packages.platforms.length + packages.systemImages.length === AndroidMockData.mockRawStringPackageLength)
            .to.be.true;
    });

    it('Android Package class should correctly parse a raw string initialize members', async () => {
        const packages = AndroidPackages.parseRawPackagesString(AndroidMockData.mockRawPackagesString);
        const platformPkg = packages.platforms.find((pkg) => pkg.path.match('android-30'));
        const sysImagePkg = packages.systemImages.find((pkg) => pkg.path.match('android-29'));

        expect(
            platformPkg?.path !== null &&
                platformPkg?.description != null &&
                sysImagePkg?.path !== null &&
                sysImagePkg?.description != null
        ).to.be.true;
    });

    it('Android Package class should return and empty list for a bad string', async () => {
        const packages = AndroidPackages.parseRawPackagesString(AndroidMockData.badMockRawPackagesString);
        expect(packages.isEmpty()).to.be.true;
    });
});
