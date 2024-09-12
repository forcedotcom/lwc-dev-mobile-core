/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfError } from '@salesforce/core';
import { AndroidUtils } from './AndroidUtils.js';
import { PlatformConfig } from './PlatformConfig.js';
import { Requirement, RequirementList } from './Requirements.js';
import { CommonUtils } from './CommonUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'requirement-android');

export class AndroidEnvironmentRequirements implements RequirementList {
    public requirements: Requirement[] = [];
    public enabled = true;
    public constructor(logger: Logger, apiLevel?: string) {
        this.requirements = [
            new AndroidSDKRootSetRequirement(logger),
            new Java8AvailableRequirement(logger),
            new AndroidSDKToolsInstalledRequirement(logger),
            new AndroidSDKPlatformToolsInstalledRequirement(logger),
            new PlatformAPIPackageRequirement(logger, apiLevel),
            new EmulatorImagesRequirement(logger, apiLevel)
        ];
    }
}

export class AndroidSDKRootSetRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    public constructor(logger: Logger) {
        this.title = messages.getMessage('android:reqs:androidhome:title');
        this.fulfilledMessage = 'android:reqs:androidhome:fulfilledMessage';
        this.unfulfilledMessage = 'android:reqs:androidhome:unfulfilledMessage';
        this.logger = logger;
    }

    /**
     * Verifies that the root directory path for Android SDK is set.
     */
    public async checkFunction(): Promise<string> {
        const root = AndroidUtils.getAndroidSdkRoot();
        if (root) {
            return Promise.resolve(
                messages.getMessage(this.fulfilledMessage, [
                    CommonUtils.convertToUnixPath(root.rootSource),
                    CommonUtils.convertToUnixPath(root.rootLocation)
                ])
            );
        } else {
            return Promise.reject(new SfError(messages.getMessage(this.unfulfilledMessage)));
        }
    }
}

export class Java8AvailableRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    public constructor(logger: Logger) {
        this.title = messages.getMessage('android:reqs:androidsdkprerequisitescheck:title');
        this.fulfilledMessage = 'android:reqs:androidsdkprerequisitescheck:fulfilledMessage';
        this.unfulfilledMessage = 'android:reqs:androidsdkprerequisitescheck:unfulfilledMessage';
        this.logger = logger;
    }

    /**
     * Verifies that prerequisites for Android SDK are met and that Java 8 is installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.androidSDKPrerequisitesCheck(this.logger)
            .then(() => Promise.resolve(messages.getMessage(this.fulfilledMessage)))
            .catch((error: Error) =>
                Promise.reject(new SfError(messages.getMessage(this.unfulfilledMessage, [error.message])))
            );
    }
}

export class AndroidSDKToolsInstalledRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    public constructor(logger: Logger) {
        this.title = messages.getMessage('android:reqs:cmdlinetools:title');
        this.fulfilledMessage = 'android:reqs:cmdlinetools:fulfilledMessage';
        this.unfulfilledMessage = 'android:reqs:cmdlinetools:unfulfilledMessage';
        this.logger = logger;
    }

    /**
     * Verifies that user has Android command line tools installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchAndroidCmdLineToolsLocation(this.logger)
            .then((result) =>
                Promise.resolve(messages.getMessage(this.fulfilledMessage, [CommonUtils.convertToUnixPath(result)]))
            )
            .catch(() => Promise.reject(new SfError(messages.getMessage(this.unfulfilledMessage))));
    }
}

export class AndroidSDKPlatformToolsInstalledRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    private notFoundMessage: string;

    public constructor(logger: Logger) {
        this.title = messages.getMessage('android:reqs:platformtools:title');
        this.fulfilledMessage = 'android:reqs:platformtools:fulfilledMessage';
        this.unfulfilledMessage = 'android:reqs:platformtools:unfulfilledMessage';
        this.notFoundMessage = 'android:reqs:platformtools:notFound';
        this.logger = logger;
    }

    /**
     * Verifies that user has Android platform tools installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchAndroidSDKPlatformToolsLocation(this.logger)
            .then((result) =>
                Promise.resolve(messages.getMessage(this.fulfilledMessage, [CommonUtils.convertToUnixPath(result)]))
            )
            .catch((error) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (error.status === 127) {
                    return Promise.reject(
                        new SfError(messages.getMessage(this.notFoundMessage, [AndroidUtils.getAndroidPlatformTools()]))
                    );
                } else {
                    return Promise.reject(
                        new SfError(
                            messages.getMessage(this.unfulfilledMessage, [
                                PlatformConfig.androidConfig().minSupportedRuntime
                            ])
                        )
                    );
                }
            });
    }
}

export class PlatformAPIPackageRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    private apiLevel?: string;

    public constructor(logger: Logger, apiLevel?: string) {
        this.title = messages.getMessage('android:reqs:platformapi:title');
        this.fulfilledMessage = 'android:reqs:platformapi:fulfilledMessage';
        this.unfulfilledMessage = 'android:reqs:platformapi:unfulfilledMessage';
        this.logger = logger;
        this.apiLevel = apiLevel;
    }

    /**
     * Verifies that user has a supported Android API package that also has matching supported emulator images installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchSupportedAndroidAPIPackage(this.apiLevel, this.logger)
            .then((result) => Promise.resolve(messages.getMessage(this.fulfilledMessage, [result.platformAPI])))
            .catch(() =>
                Promise.reject(
                    new SfError(
                        messages.getMessage(this.unfulfilledMessage, [
                            PlatformConfig.androidConfig().minSupportedRuntime
                        ])
                    )
                )
            );
    }
}

export class EmulatorImagesRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    private apiLevel?: string;

    public constructor(logger: Logger, apiLevel?: string) {
        this.title = messages.getMessage('android:reqs:emulatorimages:title');
        this.fulfilledMessage = 'android:reqs:emulatorimages:fulfilledMessage';
        this.unfulfilledMessage = 'android:reqs:emulatorimages:unfulfilledMessage';
        this.logger = logger;
        this.apiLevel = apiLevel;
    }

    /**
     * Verifies that user has at least one Android package with any of the supported emulator image targets (e.g. Google APIs, default, Google Play).
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchSupportedEmulatorImagePackage(this.apiLevel, this.logger)
            .then((result) => Promise.resolve(messages.getMessage(this.fulfilledMessage, [result.path])))
            .catch(() =>
                Promise.reject(
                    new SfError(
                        messages.getMessage(this.unfulfilledMessage, [
                            PlatformConfig.androidConfig().supportedImages.join(',')
                        ])
                    )
                )
            );
    }
}
