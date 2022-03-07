/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import util from 'util';
import { AndroidSDKRootSource, AndroidUtils } from './AndroidUtils';
import { PlatformConfig } from './PlatformConfig';
import { Requirement, RequirementList } from './Requirements';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'requirement-android'
);

export class AndroidEnvReqResolver {
    /**
     * Resolves the missing Android SDK
     */
    public static resolveAndroidSDK(): Promise<string> {
        const resolvedMessage = messages.getMessage(
            'android:reqs:androidsdk:resolvedMessage'
        );

        const unableToResolveMessage = messages.getMessage(
            'android:reqs:androidsdk:unableToResolveMessage'
        );

        process.env.ANDROID_HOME = '/Users/pvandyk/Library/Android/sdk';

        if (process.env.ANDROID_HOME) {
            return Promise.resolve(resolvedMessage);
        } else {
            return Promise.reject(new SfdxError(unableToResolveMessage));
        }
    }
}
