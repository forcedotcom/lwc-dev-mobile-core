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
});
