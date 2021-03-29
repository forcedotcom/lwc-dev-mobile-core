/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import util from 'util';
import { AndroidUtils } from './AndroidUtils';
import { CommandLineUtils } from './Common';
import { PlatformConfig } from './PlatformConfig';
import { CommandRequirement, Requirement } from './Requirements';

export class AndroidEnvironmentRequirement extends CommandRequirement {
    constructor(logger: Logger, apiLevel?: string) {
        super(logger);
        const requirements = [
            new AndroidSDKRootSetRequirement(
                this.requirementMessages,
                this.logger
            ),
            new Java8AvailableRequirement(
                this.requirementMessages,
                this.logger
            ),
            new AndroidSDKToolsInstalledRequirement(
                this.requirementMessages,
                this.logger
            ),
            new AndroidSDKPlatformToolsInstalledRequirement(
                this.requirementMessages,
                this.logger
            ),
            new PlatformAPIPackageRequirement(
                this.requirementMessages,
                this.logger,
                apiLevel
            ),
            new EmulatorImagesRequirement(
                this.requirementMessages,
                this.logger,
                apiLevel
            )
        ];
        this.baseRequirements.requirements = requirements;
        this.baseRequirements.enabled = true;

        this.checkFailureMessage = util.format(
            this.requirementMessages.getMessage('error:requirementCheckFailed'),
            CommandLineUtils.ANDROID_FLAG
        );

        this.checkRecommendationMessage = this.requirementMessages.getMessage(
            'error:requirementCheckFailed:recommendation'
        );
    }
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidSDKRootSetRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    constructor(messages: Messages, logger: Logger) {
        this.title = messages.getMessage('android:reqs:androidhome:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:androidhome:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:androidhome:unfulfilledMessage'
        );
        this.logger = logger;
    }

    /**
     * Verifies that the root directory path for Android SDK is set.
     */
    public async checkFunction(): Promise<string> {
        const root = AndroidUtils.getAndroidSdkRoot();
        if (root) {
            return Promise.resolve(
                AndroidUtils.convertToUnixPath(
                    util.format(
                        this.fulfilledMessage,
                        root.rootSource,
                        root.rootLocation
                    )
                )
            );
        } else {
            return Promise.reject(new SfdxError(this.unfulfilledMessage));
        }
    }
}

// tslint:disable-next-line: max-classes-per-file
export class Java8AvailableRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    constructor(messages: Messages, logger: Logger) {
        this.title = messages.getMessage(
            'android:reqs:androidsdkprerequisitescheck:title'
        );
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:androidsdkprerequisitescheck:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:androidsdkprerequisitescheck:unfulfilledMessage'
        );
        this.logger = logger;
    }

    /**
     * Verifies that prerequisites for Android SDK are met and that Java 8 is installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.androidSDKPrerequisitesCheck()
            .then((result) => Promise.resolve(this.fulfilledMessage))
            .catch((error) =>
                Promise.reject(
                    new SfdxError(
                        util.format(this.unfulfilledMessage, error.message)
                    )
                )
            );
    }
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidSDKToolsInstalledRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    constructor(messages: Messages, logger: Logger) {
        this.title = messages.getMessage('android:reqs:cmdlinetools:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:cmdlinetools:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:cmdlinetools:unfulfilledMessage'
        );
        this.logger = logger;
    }

    /**
     * Verifies that user has Android command line tools installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchAndroidCmdLineToolsLocation()
            .then((result) =>
                Promise.resolve(
                    AndroidUtils.convertToUnixPath(
                        util.format(this.fulfilledMessage, result)
                    )
                )
            )
            .catch((error) =>
                Promise.reject(new SfdxError(this.unfulfilledMessage))
            );
    }
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidSDKPlatformToolsInstalledRequirement
    implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    private notFoundMessage: string;
    public logger: Logger;

    constructor(messages: Messages, logger: Logger) {
        this.title = messages.getMessage('android:reqs:platformtools:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:platformtools:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:platformtools:unfulfilledMessage'
        );
        this.notFoundMessage = messages.getMessage(
            'android:reqs:platformtools:notFound'
        );
        this.logger = logger;
    }

    /**
     * Verifies that user has Android platform tools installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchAndroidSDKPlatformToolsLocation()
            .then((result) =>
                Promise.resolve(
                    AndroidUtils.convertToUnixPath(
                        util.format(this.fulfilledMessage, result)
                    )
                )
            )
            .catch((error) => {
                if (error.status === 127) {
                    return Promise.reject(
                        new SfdxError(
                            util.format(
                                this.notFoundMessage,
                                AndroidUtils.getAndroidPlatformTools()
                            )
                        )
                    );
                } else {
                    return Promise.reject(
                        new SfdxError(
                            util.format(
                                this.unfulfilledMessage,
                                PlatformConfig.androidConfig()
                                    .minSupportedRuntime
                            )
                        )
                    );
                }
            });
    }
}

// tslint:disable-next-line: max-classes-per-file
export class PlatformAPIPackageRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    private apiLevel?: string;

    constructor(messages: Messages, logger: Logger, apiLevel?: string) {
        this.title = messages.getMessage('android:reqs:platformapi:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:platformapi:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:platformapi:unfulfilledMessage'
        );
        this.logger = logger;
        this.apiLevel = apiLevel;
    }

    /**
     * Verifies that user has a supported Android API package that also has matching supported emulator images installed.
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchSupportedAndroidAPIPackage(this.apiLevel)
            .then((result) =>
                Promise.resolve(
                    util.format(this.fulfilledMessage, result.platformAPI)
                )
            )
            .catch((error) =>
                Promise.reject(
                    new SfdxError(
                        util.format(
                            this.unfulfilledMessage,
                            PlatformConfig.androidConfig().minSupportedRuntime
                        )
                    )
                )
            );
    }
}

// tslint:disable-next-line: max-classes-per-file
export class EmulatorImagesRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    private apiLevel?: string;

    constructor(messages: Messages, logger: Logger, apiLevel?: string) {
        this.title = messages.getMessage('android:reqs:emulatorimages:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:emulatorimages:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:emulatorimages:unfulfilledMessage'
        );
        this.logger = logger;
        this.apiLevel = apiLevel;
    }

    /**
     * Verifies that user has at least one Android package with any of the supported emulator image targets (e.g. Google APIs, default, Google Play).
     */
    public async checkFunction(): Promise<string> {
        return AndroidUtils.fetchSupportedEmulatorImagePackage(this.apiLevel)
            .then((result) =>
                Promise.resolve(util.format(this.fulfilledMessage, result.path))
            )
            .catch((error) =>
                Promise.reject(
                    new SfdxError(
                        util.format(
                            this.unfulfilledMessage,
                            PlatformConfig.androidConfig().supportedImages.join(
                                ','
                            )
                        )
                    )
                )
            );
    }
}
