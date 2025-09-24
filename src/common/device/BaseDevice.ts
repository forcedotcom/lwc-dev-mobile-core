/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { Logger } from '@salesforce/core';
import { Version } from '../Common.js';
import { SSLCertificateData } from '../CryptoUtils.js';

export type LaunchArgument = {
    name: string;
    value: string;
};

export enum DeviceType {
    // 'mobile' includes phone and tablet b/c it is not easily possible to determine
    // whether an Android device is a phone or tablet so we lump them all together
    mobile = 'mobile',
    watch = 'watch',
    tv = 'tv',
    vr = 'vr',
    automotive = 'automotive',
    unknown = 'unknown'
}

/**
 * A base class definition for a Device of any kind (mobile, watch, tv, etc).
 * Implementation will be provided by platform-specific classes.
 */
export type BaseDevice = {
    logger?: Logger;
    readonly id: string;
    readonly name: string;
    readonly deviceType: DeviceType;
    readonly osType: string;
    readonly osVersion: Version | string;
    readonly state: DeviceState;

    toString(): string;

    boot(waitForBoot?: boolean): Promise<void>;
    reboot(waitForBoot?: boolean): Promise<void>;
    shutdown(): Promise<void>;
    openUrl(url: string): Promise<void>;
    isAppInstalled(target: string): Promise<boolean>;
    installApp(appBundlePath: string): Promise<void>;
    launchApp(target: string, launchArguments?: LaunchArgument[], appBundlePath?: string): Promise<void>;
    isCertInstalled(certData: SSLCertificateData): Promise<boolean>;
    installCert(certData: SSLCertificateData): Promise<void>;
};

/**
 * The state of the device.
 */
export enum DeviceState {
    // The simulator device is in the process of starting up
    Booting = 'Booting',
    // The simulator device is fully booted and ready to use
    Booted = 'Booted',
    // The simulator device is not running
    Shutdown = 'Shutdown'
}
