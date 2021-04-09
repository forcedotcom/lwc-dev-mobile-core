/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages, SfdxError } from '@salesforce/core';
import * as common from '../Common';
import util from 'util';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'common'
);
describe('Commons utils tests', () => {
    test('Filtering of maps returns maps', async () => {
        const mascotMapping = new Map();
        mascotMapping.set('Edddie', 'Iron Maiden');
        mascotMapping.set('Rattlehead', 'Megadeth');
        mascotMapping.set('Henry', 'Sabbath');

        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            (key, value) => key.indexOf('Rattle') > -1
        );
        expect(filteredByMascots.size === 1);
    });

    test('Filtering of maps returns empty maps', async () => {
        const mascotMapping = new Map();
        mascotMapping.set('Edddie', 'Iron Maiden');
        mascotMapping.set('Rattlehead', 'Megadeth');
        mascotMapping.set('Henry', 'Sabbath');

        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            (key, value) => key.indexOf('Murray') > -1
        );
        expect(filteredByMascots.size === 0);
    });

    test('Filtering of maps retrun empty maps and not null, when no match is found', async () => {
        const mascotMapping = new Map();
        mascotMapping.set('Edddie', 'Iron Maiden');
        mascotMapping.set('Rattlehead', 'Megadeth');
        mascotMapping.set('Henry', 'Sabbath');

        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            (key, value) => key.indexOf('Murray') > -1
        );
        expect(filteredByMascots !== undefined && filteredByMascots != null);
    });

    test('Filtering of empty maps returns empty maps, when no match is found', async () => {
        const mascotMapping = new Map<string, string>();
        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            (key, value) => key.indexOf('Murray') > -1
        );
        expect(filteredByMascots !== undefined && filteredByMascots != null);
    });

    test('Filtering of sets returns sets', async () => {
        const mascotSets = new Set<string>();
        mascotSets.add('Edddie');
        mascotSets.add('Rattlehead');
        mascotSets.add('Henry');

        const filteredByMascots = common.SetUtils.filter(
            mascotSets,
            (value) => value.indexOf('Rattle') > -1
        );
        expect(filteredByMascots.size === 1);
    });

    test('Filtering of sets returns empty sets when no match is found', async () => {
        const mascotSets = new Set<string>();
        mascotSets.add('Edddie');
        mascotSets.add('Rattlehead');
        mascotSets.add('Henry');

        const filteredByMascots = common.SetUtils.filter(
            mascotSets,
            (value) => value.indexOf('Murray') > -1
        );
        expect(filteredByMascots.size === 0);
    });

    test('Filtering of sets returns empty set and not null, when no match is found', async () => {
        const mascotSets = new Set<string>();
        mascotSets.add('Edddie');
        mascotSets.add('Rattlehead');
        mascotSets.add('Henry');

        const filteredByMascots = common.SetUtils.filter(
            mascotSets,
            (value) => value.indexOf('Murray') > -1
        );
        expect(filteredByMascots !== undefined && filteredByMascots !== null);
    });

    test('Test if Android platform check matches input string', async () => {
        expect(
            common.CommandLineUtils.platformFlagIsAndroid('android') === true
        );
    });

    test('Test if Android platform check matches input string', async () => {
        expect(
            common.CommandLineUtils.platformFlagIsAndroid('AndroiD') === true
        );
    });

    test('Test that Android platform check does not match input string', async () => {
        expect(common.CommandLineUtils.platformFlagIsAndroid('lkds') === false);
    });

    test('Test that Android platform check does not match empty input string', async () => {
        expect(common.CommandLineUtils.platformFlagIsAndroid('') === false);
    });

    test('Test if iOS platform matches input string', async () => {
        expect(common.CommandLineUtils.platformFlagIsIOS('iOS') === true);
    });

    test('Test if iOS platform matches input string', async () => {
        expect(common.CommandLineUtils.platformFlagIsIOS('IOS') === true);
    });

    test('Test that iOS platform check does not match input string', async () => {
        expect(common.CommandLineUtils.platformFlagIsIOS('lkds') === false);
    });

    test('Test that iOS platform check does not match empty input string', async () => {
        expect(common.CommandLineUtils.platformFlagIsIOS('') === false);
    });

    test('Platform flag config property returns expected flag', async () => {
        const platformFlagConfig = common.CommandLineUtils.platformFlagConfig;
        expect(platformFlagConfig.platform).toBeDefined();
        expect(platformFlagConfig.platform!.longDescription).toBe(
            messages.getMessage('platformFlagDescription')
        );
        expect(platformFlagConfig.platform!.description).toBe(
            messages.getMessage('platformFlagDescription')
        );
    });

    test('API level flag config property returns expected flag', async () => {
        const apiLevelFlagConfig = common.CommandLineUtils.apiLevelFlagConfig;
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
            platform: common.CommandLineUtils.IOS_FLAG
        };
        const resolved = await common.CommandLineUtils.validateApiLevelFlag(
            mockFlag,
            []
        );
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
            await common.CommandLineUtils.validateApiLevelFlag(
                mockFlag,
                recommendations
            );
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
        const resolved = await common.CommandLineUtils.validateApiLevelFlag(
            mockFlag,
            []
        );
        expect(resolved).toBeUndefined();
    });

    test('Platform validation for iOS succeeds', async () => {
        const mockFlag = {
            platform: common.CommandLineUtils.IOS_FLAG
        };
        const resolved = await common.CommandLineUtils.validatePlatformFlag(
            mockFlag,
            []
        );
        expect(resolved).toBeUndefined();
    });

    test('Platform validation for Android succeeds', async () => {
        const mockFlag = {
            platform: common.CommandLineUtils.ANDROID_FLAG
        };
        const resolved = await common.CommandLineUtils.validatePlatformFlag(
            mockFlag,
            []
        );
        expect(resolved).toBeUndefined();
    });

    test('Platform validation fails for unknown platform', async () => {
        const recommendations = ['a recommendation message'];
        const mockFlag = {
            platform: 'Blackberry'
        };
        try {
            await common.CommandLineUtils.validatePlatformFlag(
                mockFlag,
                recommendations
            );
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
