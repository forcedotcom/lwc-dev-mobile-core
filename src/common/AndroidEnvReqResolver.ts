/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import { AndroidUtils } from './AndroidUtils';
import util from 'util';
import { CommonUtils } from './CommonUtils';

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
export class AndroidCommandLineToolsResolver implements RequirementResolver {
    public resolvedMessage: string;
    public unableToResolveMessage: string;
    public logger: Logger;
    public resolveFunction: RequirementResolveFunc;

    constructor(logger: Logger, resolveFunction?: RequirementResolveFunc) {
        this.resolvedMessage = messages.getMessage(
            'android:reqs:cmdlinetools:install:resolvedMessage'
        );

        this.unableToResolveMessage = messages.getMessage(
            'android:reqs:cmdlinetools:install:unableToResolveMessage'
        );
        this.logger = logger;

        if (typeof resolveFunction !== 'undefined') {
            this.resolveFunction = resolveFunction;
        } else {
            this.resolveFunction = function () {
                return this.installAndroidCommandLineTools();
            };
        }
    }

    private async installAndroidCommandLineTools(): Promise<
        string | undefined
    > {
        // download command line tools

        // unzip and move to the latest folder
        const unzipCommand = ''.concat(
            'unzip /Users/pvandyk/Downloads/commandlinetools-mac-8092744_latest.zip -d $ANDROID_HOME/cmdline-tools/latest',
            ' && ',
            'mv $ANDROID_HOME/cmdline-tools/latest/cmdline-tools/* $ANDROID_HOME/cmdline-tools/latest',
            ' && ',
            'rm -rf $ANDROID_HOME/cmdline-tools/latest/cmdline-tools'
        );
        CommonUtils.executeCommandSync(unzipCommand);

        // this is needed because unzipping doesn't register the sdkmanager
        // it will install to latest-2, so remove and install
        const installCommand = ''.concat(
            '$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "cmdline-tools;latest"',
            ' && ',
            'rm -rf $ANDROID_HOME/cmdline-tools/latest',
            ' && ',
            'mv $ANDROID_HOME/cmdline-tools/latest-2 $ANDROID_HOME/cmdline-tools/latest'
        );
        CommonUtils.executeCommandSync(installCommand);

        // cleanup (remove download)

        return (
            AndroidUtils.fetchAndroidCmdLineToolsLocation()
                .then((result) =>
                    Promise.resolve(
                        AndroidUtils.convertToUnixPath(
                            util.format(this.resolvedMessage, result)
                        )
                    )
                )
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .catch((error) => Promise.reject(this.unableToResolveMessage))
        );
    }
}
