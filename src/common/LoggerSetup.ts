/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { AndroidPackages, AndroidVirtualDevice } from './AndroidTypes';
import { AndroidUtils } from './AndroidUtils';
import { CommonUtils } from './CommonUtils';
import { IOSUtils } from './IOSUtils';
import { MacNetworkUtils } from './MacNetworkUtils';

export class LoggerSetup {
    /**
     * Initializes all of the loggers that various utility libraries use (such as AndroidUtils, IOSUtils, CommonUtils)
     */
    public static async initializePluginLoggers(): Promise<void> {
        await AndroidUtils.initializeLogger();
        await IOSUtils.initializeLogger();
        await CommonUtils.initializeLogger();
        await MacNetworkUtils.initializeLogger();
        await AndroidPackages.initializeLogger();
        await AndroidVirtualDevice.initializeLogger();
        return Promise.resolve();
    }
}
