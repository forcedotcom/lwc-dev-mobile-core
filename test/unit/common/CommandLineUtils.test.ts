/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import { expect } from 'chai';
import { FlagsConfigType } from '../../../src/common/Common.js';
import { CommandLineUtils } from '../../../src/common/CommandLineUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('Commons utils tests', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

    it('Test if Android platform check matches input string', async () => {
        expect(CommandLineUtils.platformFlagIsAndroid('android') === true);
    });

    it('Test if Android platform check matches input string', async () => {
        expect(CommandLineUtils.platformFlagIsAndroid('AndroiD') === true);
    });

    it('Test that Android platform check does not match input string', async () => {
        expect(CommandLineUtils.platformFlagIsAndroid('lkds') === false);
    });

    it('Test that Android platform check does not match empty input string', async () => {
        expect(CommandLineUtils.platformFlagIsAndroid('') === false);
    });

    it('Test if iOS platform matches input string', async () => {
        expect(CommandLineUtils.platformFlagIsIOS('iOS') === true);
    });

    it('Test if iOS platform matches input string', async () => {
        expect(CommandLineUtils.platformFlagIsIOS('IOS') === true);
    });

    it('Test that iOS platform check does not match input string', async () => {
        expect(CommandLineUtils.platformFlagIsIOS('lkds') === false);
    });

    it('Test that iOS platform check does not match empty input string', async () => {
        expect(CommandLineUtils.platformFlagIsIOS('') === false);
    });

    it('Platform flag config property returns expected flag', async () => {
        let platformFlagConfig = CommandLineUtils.createFlag(FlagsConfigType.PlatformFlag, true);
        expect(platformFlagConfig.platform?.description).to.be.equal(messages.getMessage('platformFlagDescription'));
        let requiredKeyValuePair = Object.entries(platformFlagConfig.platform).find(
            (keyValuePair) => keyValuePair[0] === 'required'
        );

        expect(requiredKeyValuePair?.[1]).to.be.true;

        platformFlagConfig = CommandLineUtils.createFlag(FlagsConfigType.PlatformFlag, false);

        requiredKeyValuePair = Object.entries(platformFlagConfig.platform).find(
            (keyValuePair) => keyValuePair[0] === 'required'
        );

        expect(requiredKeyValuePair?.[1]).to.be.false;
    });

    it('API level flag config property returns expected flag', async () => {
        let apiLevelFlagConfig = CommandLineUtils.createFlag(FlagsConfigType.ApiLevelFlag, true);
        expect(apiLevelFlagConfig.apilevel?.description).to.be.equal(messages.getMessage('apiLevelFlagDescription'));

        let requiredKeyValuePair = Object.entries(apiLevelFlagConfig.apilevel).find(
            (keyValuePair) => keyValuePair[0] === 'required'
        );

        expect(requiredKeyValuePair?.[1]).to.be.true;

        apiLevelFlagConfig = CommandLineUtils.createFlag(FlagsConfigType.ApiLevelFlag, false);

        requiredKeyValuePair = Object.entries(apiLevelFlagConfig.apilevel).find(
            (keyValuePair) => keyValuePair[0] === 'required'
        );

        expect(requiredKeyValuePair![1]).to.be.false;
    });

    it('Output format flag config property returns expected flag', async () => {
        let outputFormatFlagConfig = CommandLineUtils.createFlag(FlagsConfigType.OutputFormatFlag, true);
        expect(outputFormatFlagConfig.outputFormat?.description).to.be.equal(
            messages.getMessage('outputFormatFlagDescription')
        );

        let requiredKeyValuePair = Object.entries(outputFormatFlagConfig.outputFormat).find(
            (keyValuePair) => keyValuePair[0] === 'required'
        );

        expect(requiredKeyValuePair?.[1]).to.be.true;

        outputFormatFlagConfig = CommandLineUtils.createFlag(FlagsConfigType.OutputFormatFlag, false);

        requiredKeyValuePair = Object.entries(outputFormatFlagConfig.outputFormat).find(
            (keyValuePair) => keyValuePair[0] === 'required'
        );

        expect(requiredKeyValuePair![1]).to.be.false;
    });
});
