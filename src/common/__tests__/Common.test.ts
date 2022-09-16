/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import * as common from '../Common';

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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (key, value) => key.indexOf('Murray') > -1
        );
        expect(filteredByMascots !== undefined && filteredByMascots != null);
    });

    test('Filtering of empty maps returns empty maps, when no match is found', async () => {
        const mascotMapping = new Map<string, string>();
        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        let platformFlagConfig = common.CommandLineUtils.createFlagConfig(
            common.FlagsConfigType.Platform,
            true
        );
        expect(platformFlagConfig.platform).toBeDefined();
        expect(platformFlagConfig.platform!.longDescription).toBe(
            messages.getMessage('platformFlagDescription')
        );
        expect(platformFlagConfig.platform!.description).toBe(
            messages.getMessage('platformFlagDescription')
        );
        let requiredKeyValuePair = Object.entries(
            platformFlagConfig.platform!
        ).find((keyValuePair) => keyValuePair[0] === 'required');

        expect(requiredKeyValuePair).toBeDefined();
        expect(requiredKeyValuePair![1]).toBe(true);

        platformFlagConfig = common.CommandLineUtils.createFlagConfig(
            common.FlagsConfigType.Platform,
            false
        );

        requiredKeyValuePair = Object.entries(
            platformFlagConfig.platform!
        ).find((keyValuePair) => keyValuePair[0] === 'required');

        expect(requiredKeyValuePair).toBeDefined();
        expect(requiredKeyValuePair![1]).toBe(false);
    });

    test('API level flag config property returns expected flag', async () => {
        let apiLevelFlagConfig = common.CommandLineUtils.createFlagConfig(
            common.FlagsConfigType.ApiLevel,
            true
        );
        expect(apiLevelFlagConfig.apilevel).toBeDefined();
        expect(apiLevelFlagConfig.apilevel!.longDescription).toBe(
            messages.getMessage('apiLevelFlagDescription')
        );
        expect(apiLevelFlagConfig.apilevel!.description).toBe(
            messages.getMessage('apiLevelFlagDescription')
        );

        let requiredKeyValuePair = Object.entries(
            apiLevelFlagConfig.apilevel!
        ).find((keyValuePair) => keyValuePair[0] === 'required');

        expect(requiredKeyValuePair).toBeDefined();
        expect(requiredKeyValuePair![1]).toBe(true);

        apiLevelFlagConfig = common.CommandLineUtils.createFlagConfig(
            common.FlagsConfigType.ApiLevel,
            false
        );

        requiredKeyValuePair = Object.entries(
            apiLevelFlagConfig.apilevel!
        ).find((keyValuePair) => keyValuePair[0] === 'required');

        expect(requiredKeyValuePair).toBeDefined();
        expect(requiredKeyValuePair![1]).toBe(false);
    });

    test('Valid Version formats return expected object values', async () => {
        // Major only.
        const v1 = common.Version.from('1');
        expect(v1?.major).toBe(1);
        expect(v1?.minor).toBe(0);
        expect(v1?.patch).toBe(0);

        // Major and minor only.
        for (const versionString of ['2.3', '2-3']) {
            const v2 = common.Version.from(versionString);
            expect(v2?.major).toBe(2);
            expect(v2?.minor).toBe(3);
            expect(v2?.patch).toBe(0);
        }

        // Major, minor, and patch.
        for (const versionString of ['4.5.6', '4-5-6']) {
            const v3 = common.Version.from(versionString);
            expect(v3?.major).toBe(4);
            expect(v3?.minor).toBe(5);
            expect(v3?.patch).toBe(6);
        }

        // Space-padded values.
        for (const versionString of ['  7.8.9  ', '  7-8-9  ']) {
            const v4 = common.Version.from(versionString);
            expect(v4?.major).toBe(7);
            expect(v4?.minor).toBe(8);
            expect(v4?.patch).toBe(9);
        }

        // Multi-digit values.
        for (const versionString of ['10.111.1212', '10-111-1212']) {
            const v5 = common.Version.from(versionString);
            expect(v5?.major).toBe(10);
            expect(v5?.minor).toBe(111);
            expect(v5?.patch).toBe(1212);
        }

        // 'Zero' releases.
        for (const versionString of ['0.1.2', '0-1-2']) {
            const v6 = common.Version.from(versionString);
            expect(v6?.major).toBe(0);
            expect(v6?.minor).toBe(1);
            expect(v6?.patch).toBe(2);
        }
    });

    test('Invalid Version formats return null', async () => {
        const invalidVersions = [
            'some-random-string',
            '001.002.003',
            '004-005-006',
            '2-3.4',
            '2.3-4',
            '5.6.7.8',
            '9-10-11-12'
        ];
        for (const invalidVersion of invalidVersions) {
            expect(common.Version.from(invalidVersion)).toBeNull();
        }
    });
});
