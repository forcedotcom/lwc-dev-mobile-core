/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import {
    AndroidAppPreviewConfig,
    IOSAppPreviewConfig
} from '../PreviewConfigFile';
import { CommonUtils } from '../CommonUtils';
import { PreviewUtils } from '../PreviewUtils';
import * as configSchema from './PreviewMockConfigurationSchema.json';

describe('Preview utils tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Checks for targeting browser or app', async () => {
        expect(PreviewUtils.isTargetingBrowser('browser')).toBe(true);
        expect(PreviewUtils.isTargetingBrowser('com.mock.app')).toBe(false);
    });

    test('Checks for using Lwc Server for Previewing', async () => {
        expect(
            PreviewUtils.useLwcServerForPreviewing('browser', undefined)
        ).toBe(true);

        const iOSAppConfig = new IOSAppPreviewConfig();
        iOSAppConfig.preview_server_enabled = true;
        expect(
            PreviewUtils.useLwcServerForPreviewing('com.mock.app', iOSAppConfig)
        ).toBe(iOSAppConfig.preview_server_enabled);

        const androidAppConfig = new IOSAppPreviewConfig();
        androidAppConfig.preview_server_enabled = false;
        expect(
            PreviewUtils.useLwcServerForPreviewing(
                'com.mock.app',
                androidAppConfig
            )
        ).toBe(androidAppConfig.preview_server_enabled);
    });

    test('Config validation fails when app id is not defined', async () => {
        const json = '{"apps": {"ios": [{"name": "LWC Test App"}]}}';
        const configFileJson = JSON.parse(json);
        jest.spyOn(CommonUtils, 'loadJsonFromFile').mockReturnValue(
            configFileJson
        );

        const validationResult =
            await PreviewUtils.validateConfigFileWithSchema(
                'myConfig.json',
                configSchema
            );

        expect(validationResult.passed).toBe(false);
        expect(validationResult.errorMessage).toBe(
            "data/apps/ios/0 must have required property 'id'"
        );
    });

    test('Config validation fails when app name is not defined', async () => {
        const json = '{"apps": {"ios": [{"id": "com.salesforce.Test"}]}}';
        const configFileJson = JSON.parse(json);
        jest.spyOn(CommonUtils, 'loadJsonFromFile').mockReturnValue(
            configFileJson
        );

        const validationResult =
            await PreviewUtils.validateConfigFileWithSchema(
                'myConfig.json',
                configSchema
            );

        expect(validationResult.passed).toBe(false);
        expect(validationResult.errorMessage).toBe(
            "data/apps/ios/0 must have required property 'name'"
        );
    });

    test('Config validation fails when launch arguments is not defined as key/value pair', async () => {
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
        jest.spyOn(CommonUtils, 'loadJsonFromFile').mockReturnValue(
            configFileJson
        );

        const validationResult =
            await PreviewUtils.validateConfigFileWithSchema(
                'myConfig.json',
                configSchema
            );

        expect(validationResult.passed).toBe(false);
        expect(validationResult.errorMessage).toBe(
            "data/apps/ios/0/launch_arguments/1 must have required property 'value'"
        );
    });

    test('Config validation fails when activity is not defined for an android app', async () => {
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
        jest.spyOn(CommonUtils, 'loadJsonFromFile').mockReturnValue(
            configFileJson
        );

        const validationResult =
            await PreviewUtils.validateConfigFileWithSchema(
                'myConfig.json',
                configSchema
            );

        expect(validationResult.passed).toBe(false);
        expect(validationResult.errorMessage).toBe(
            "data/apps/android/0 must have required property 'activity'"
        );
    });

    test('Can retrieve launch arguments from config file', async () => {
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
        jest.spyOn(CommonUtils, 'loadJsonFromFile').mockReturnValue(
            configFileJson
        );

        const configFile = PreviewUtils.loadConfigFile('myConfig.json');
        const appConfig = configFile.getAppConfig(
            'ios',
            'com.salesforce.Test'
        ) as IOSAppPreviewConfig;

        const args = appConfig.launch_arguments || [];
        expect(args.length).toBe(2);
        expect(args[0]).toStrictEqual({ name: 'arg1', value: 'val1' });
        expect(args[1]).toStrictEqual({ name: 'arg2', value: 'val2' });
    });

    test('Can retrieve launch activity from config file', async () => {
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
        jest.spyOn(CommonUtils, 'loadJsonFromFile').mockReturnValue(
            configFileJson
        );

        const configFile = PreviewUtils.loadConfigFile('myConfig.json');
        const appConfig = configFile.getAppConfig(
            'android',
            'com.salesforce.Test'
        ) as AndroidAppPreviewConfig;

        expect(appConfig.activity).toBe('.MyActivity');
    });

    test('Checks for obtaining app bundle path', async () => {
        const iOSAppConfig = new IOSAppPreviewConfig();
        iOSAppConfig.get_app_bundle = undefined;
        expect(PreviewUtils.getAppBundlePath('', iOSAppConfig)).toBe(undefined);

        iOSAppConfig.get_app_bundle = 'testGetAppBundleScript';
        const bundlePath = PreviewUtils.getAppBundlePath(
            __dirname,
            iOSAppConfig
        );
        expect(bundlePath).toBe('sample/path/to/app/bundle');
    });
});
