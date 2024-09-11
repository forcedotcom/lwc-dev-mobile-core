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

    boot(waitForBoot: boolean): Promise<void>;
    reboot(waitForBoot: boolean): Promise<void>;
    shutdown(): Promise<void>;
    openUrl(url: string): Promise<void>;
    launchApp(targetApp: string, appBundlePath?: string, targetAppArguments?: LaunchArgument[]): Promise<void>;
    isCertInstalled(certData: SSLCertificateData): Promise<boolean>;
    installCert(certData: SSLCertificateData): Promise<void>;
};
