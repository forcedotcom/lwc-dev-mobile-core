/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { LoggerLevelValue } from '@salesforce/core';
import { AndroidPackages, AndroidVirtualDevice } from './AndroidTypes.js';
import { AndroidUtils } from './AndroidUtils.js';
import { CommonUtils } from './CommonUtils.js';
import { IOSUtils } from './IOSUtils.js';
import { MacNetworkUtils } from './MacNetworkUtils.js';

export class LoggerSetup {
    /**
     * Initializes all of the loggers that various utility libraries use (such as AndroidUtils, IOSUtils, CommonUtils)
     */
    public static initializePluginLoggers(level?: LoggerLevelValue): void {
        AndroidUtils.initializeLogger(level);
        IOSUtils.initializeLogger(level);
        CommonUtils.initializeLogger(level);
        MacNetworkUtils.initializeLogger(level);
        AndroidPackages.initializeLogger(level);
        AndroidVirtualDevice.initializeLogger(level);
    }
}
