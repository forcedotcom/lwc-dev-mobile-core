/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { LoggerLevelValue } from '@salesforce/core';
import { AndroidPackages, AndroidVirtualDevice } from './AndroidTypes';
import { AndroidUtils } from './AndroidUtils';
import { CommonUtils } from './CommonUtils';
import { IOSUtils } from './IOSUtils';
import { MacNetworkUtils } from './MacNetworkUtils';

export class LoggerSetup {
    /**
     * Initializes all of the loggers that various utility libraries use (such as AndroidUtils, IOSUtils, CommonUtils)
     */
    public static async initializePluginLoggers(
        level?: LoggerLevelValue
    ): Promise<void> {
        await AndroidUtils.initializeLogger(level);
        await IOSUtils.initializeLogger(level);
        await CommonUtils.initializeLogger(level);
        await MacNetworkUtils.initializeLogger(level);
        await AndroidPackages.initializeLogger(level);
        await AndroidVirtualDevice.initializeLogger(level);
        return Promise.resolve();
    }
}
