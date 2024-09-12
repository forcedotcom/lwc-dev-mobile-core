/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { CommandLineUtils } from './CommandLineUtils.js';
import { LaunchArgument } from './device/BaseDevice.js';

export class PreviewConfigFile {
    public apps!: {
        ios?: IOSAppPreviewConfig[];
        android?: AndroidAppPreviewConfig[];
    };

    public getAppConfig(
        platform: string,
        targetApp: string
    ): IOSAppPreviewConfig | AndroidAppPreviewConfig | undefined {
        const appConfigs = CommandLineUtils.platformFlagIsIOS(platform) ? this.apps.ios ?? [] : this.apps.android ?? [];

        const config = appConfigs.find((appConfig) => appConfig.id === targetApp);

        return config;
    }
}

class BaseAppPreviewConfig {
    public id!: string;
    public name!: string;
    // eslint-disable-next-line camelcase
    public get_app_bundle?: string;
    // eslint-disable-next-line camelcase
    public launch_arguments?: LaunchArgument[];
    // eslint-disable-next-line camelcase
    public preview_server_enabled?: boolean;
}

export class IOSAppPreviewConfig extends BaseAppPreviewConfig {}

export class AndroidAppPreviewConfig extends BaseAppPreviewConfig {
    public activity!: string;
}
