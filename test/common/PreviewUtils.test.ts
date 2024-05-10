/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import path from 'node:path';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { AndroidAppPreviewConfig, IOSAppPreviewConfig } from '../../src/common/PreviewConfigFile.js';
import { CommonUtils } from '../../src/common/CommonUtils.js';
import { PreviewUtils } from '../../src/common/PreviewUtils.js';
import { mockSchema } from './PreviewMockConfigurationSchema.js';

describe('Preview utils tests', () => {
    const $$ = new TestContext();

    afterEach(() => {
        $$.restore();
    });

    it('Checks for targeting browser or app', async () => {
        expect(PreviewUtils.isTargetingBrowser('browser')).to.be.true;
        expect(PreviewUtils.isTargetingBrowser('com.mock.app')).to.be.false;
    });

    it('Checks for using Lwc Server for Previewing', async () => {
        expect(PreviewUtils.useLwcServerForPreviewing('browser', undefined)).to.be.true;

        const iOSAppConfig = new IOSAppPreviewConfig();
        iOSAppConfig.preview_server_enabled = true;
        expect(PreviewUtils.useLwcServerForPreviewing('com.mock.app', iOSAppConfig)).to.be.equal(
            iOSAppConfig.preview_server_enabled
        );

        const androidAppConfig = new IOSAppPreviewConfig();
        androidAppConfig.preview_server_enabled = false;
        expect(PreviewUtils.useLwcServerForPreviewing('com.mock.app', androidAppConfig)).to.be.equal(
            androidAppConfig.preview_server_enabled
        );
    });

    it('Checks for adding prefix to component route', async () => {
        expect(PreviewUtils.prefixRouteIfNeeded('helloWorld')).to.be.equal('c/helloWorld');
        expect(PreviewUtils.prefixRouteIfNeeded('c/helloWorld')).to.be.equal('c/helloWorld');
    });

    it('Config validation fails when app id is not defined', async () => {
        const json = '{"apps": {"ios": [{"name": "LWC Test App"}]}}';
        const configFileJson = JSON.parse(json);
        const configSchema = JSON.parse(mockSchema);
        stubMethod($$.SANDBOX, CommonUtils, 'loadJsonFromFile').returns(configFileJson);

        const validationResult = await PreviewUtils.validateConfigFileWithSchema('myConfig.json', configSchema);

        expect(validationResult.passed).to.be.false;
        expect(validationResult.errorMessage).to.be.equal("data/apps/ios/0 must have required property 'id'");
    });

    it('Config validation fails when app name is not defined', async () => {
        const json = '{"apps": {"ios": [{"id": "com.salesforce.Test"}]}}';
        const configFileJson = JSON.parse(json);
        const configSchema = JSON.parse(mockSchema);
        stubMethod($$.SANDBOX, CommonUtils, 'loadJsonFromFile').returns(configFileJson);

        const validationResult = await PreviewUtils.validateConfigFileWithSchema('myConfig.json', configSchema);

        expect(validationResult.passed).to.be.false;
        expect(validationResult.errorMessage).to.be.equal("data/apps/ios/0 must have required property 'name'");
    });

    it('Config validation fails when launch arguments is not defined as key/value pair', async () => {
        const json = `
        {
            "apps": {
                "ios": [
                    {
                        "id": "com.salesforce.Test",
                        "name": "LWC Test App",
                        "launch_arguments": [
                            { "name": "arg1", "value": "val1" },
                            { "name": "arg2" }
                        ]
                    }
                ]
            }
        }`;
        const configFileJson = JSON.parse(json);
        const configSchema = JSON.parse(mockSchema);
        stubMethod($$.SANDBOX, CommonUtils, 'loadJsonFromFile').returns(configFileJson);

        const validationResult = await PreviewUtils.validateConfigFileWithSchema('myConfig.json', configSchema);

        expect(validationResult.passed).to.be.false;
        expect(validationResult.errorMessage).to.be.equal(
            "data/apps/ios/0/launch_arguments/1 must have required property 'value'"
        );
    });

    it('Config validation fails when activity is not defined for an android app', async () => {
        const json = `
        {
            "apps": {
                "android": [
                    {
                        "id": "com.salesforce.Test",
                        "name": "LWC Test App"
                    }
                ]
            }
        }`;
        const configFileJson = JSON.parse(json);
        const configSchema = JSON.parse(mockSchema);
        stubMethod($$.SANDBOX, CommonUtils, 'loadJsonFromFile').returns(configFileJson);

        const validationResult = await PreviewUtils.validateConfigFileWithSchema('myConfig.json', configSchema);

        expect(validationResult.passed).to.be.false;
        expect(validationResult.errorMessage).to.be.equal("data/apps/android/0 must have required property 'activity'");
    });

    it('Can retrieve launch arguments from config file', async () => {
        const json = `
        {
            "apps": {
                "ios": [
                    {
                        "id": "com.salesforce.Test",
                        "name": "LWC Test App",
                        "launch_arguments": [
                            { "name": "arg1", "value": "val1" },
                            { "name": "arg2", "value": "val2" }
                        ]
                    }
                ]
            }
        }`;
        const configFileJson = JSON.parse(json);
        stubMethod($$.SANDBOX, CommonUtils, 'loadJsonFromFile').returns(configFileJson);

        const configFile = PreviewUtils.loadConfigFile('myConfig.json');
        const appConfig = configFile.getAppConfig('ios', 'com.salesforce.Test') as IOSAppPreviewConfig;

        const args = appConfig.launch_arguments ?? [];
        expect(args.length).to.be.equal(2);
        expect(args[0]).to.deep.equal({ name: 'arg1', value: 'val1' });
        expect(args[1]).to.deep.equal({ name: 'arg2', value: 'val2' });
    });

    it('Can retrieve launch activity from config file', async () => {
        const json = `
        {
            "apps": {
                "android": [
                    {
                        "id": "com.salesforce.Test",
                        "name": "LWC Test App",
                        "activity": ".MyActivity"
                    }
                ]
            }
        }`;
        const configFileJson = JSON.parse(json);
        stubMethod($$.SANDBOX, CommonUtils, 'loadJsonFromFile').returns(configFileJson);

        const configFile = PreviewUtils.loadConfigFile('myConfig.json');
        const appConfig = configFile.getAppConfig('android', 'com.salesforce.Test') as AndroidAppPreviewConfig;

        expect(appConfig.activity).to.be.equal('.MyActivity');
    });

    it('Checks for obtaining app bundle path', async () => {
        const iOSAppConfig = new IOSAppPreviewConfig();
        iOSAppConfig.get_app_bundle = undefined;
        expect(PreviewUtils.getAppBundlePath('', iOSAppConfig)).to.be.undefined;

        iOSAppConfig.get_app_bundle = 'testGetAppBundleScript';
        const bundlePath = PreviewUtils.getAppBundlePath(path.dirname(new URL(import.meta.url).pathname), iOSAppConfig);
        expect(bundlePath).to.be.equal('sample/path/to/app/bundle');
    });
});
