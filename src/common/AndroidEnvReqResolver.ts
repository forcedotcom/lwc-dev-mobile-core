/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'requirement-android'
);

export type RequirementResolveFunc = () => Promise<string | undefined>;
export interface RequirementResolver {
    resolvedMessage: string;
    unableToResolveMessage: string;
    logger: Logger;
    resolveFunction: RequirementResolveFunc;
}

/**
 * Resolves the missing Android SDK
 */
export class AndroidSDKRootResolver implements RequirementResolver {
    public resolvedMessage: string;
    public unableToResolveMessage: string;
    public logger: Logger;
    public resolveFunction: RequirementResolveFunc;

    constructor(logger: Logger, resolveFunction?: RequirementResolveFunc) {
        this.resolvedMessage = messages.getMessage(
            'android:reqs:androidsdk:resolvedMessage'
        );

        this.unableToResolveMessage = messages.getMessage(
            'android:reqs:androidsdk:unableToResolveMessage'
        );
        this.logger = logger;

        if (typeof resolveFunction !== 'undefined') {
            this.resolveFunction = resolveFunction;
        } else {
            this.resolveFunction = function () {
                return this.installAndroidSDK();
            };
        }
    }

    private installAndroidSDK(): Promise<string | undefined> {
        process.env.ANDROID_HOME = '/Users/pvandyk/Library/Android/sdk';

        if (process.env.ANDROID_HOME) {
            return Promise.resolve(this.resolvedMessage);
        } else {
            return Promise.reject(new SfdxError(this.unableToResolveMessage));
        }
    }
}
