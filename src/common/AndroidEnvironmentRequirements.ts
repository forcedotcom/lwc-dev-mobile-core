/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfdxError } from '@salesforce/core';
import util from 'util';
import { AndroidUtils } from './AndroidUtils';
import { PlatformConfig } from './PlatformConfig';
import { AndroidCommandLineToolsResolver as AndroidCommandLineToolsResolver } from './AndroidEnvReqResolver';
import {
    CommandRequirements,
    Requirement,
    RequirementList
} from './Requirements';
import { CommonUtils } from './CommonUtils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'requirement-android'
);

export class AndroidEnvironmentRequirements {
    public commandRequirements: CommandRequirements;

    constructor(logger: Logger, apiLevel?: string) {
        this.commandRequirements = {};

        this.commandRequirements.r1 = new AndroidSDKRootSetRequirements(logger);

        this.commandRequirements.r2 = new AndroidCommandLineToolsRequirements(
            logger
        );

        this.commandRequirements.r3 = new AndroidSDKPrerequisites(logger);

        this.commandRequirements.r4 =
            new AndroidSDKPlatformToolsInstalledRequirements(logger);

        this.commandRequirements.r5 = new PlatformAPIPackageRequirements(
            logger,
            apiLevel
        );

        this.commandRequirements.r6 = new EmulatorImagesRequirements(
            logger,
            apiLevel
        );
    }
}

export class AndroidSDKRootSetRequirements implements RequirementList {
    public requirements: Requirement[] = [];
    public enabled = true;
    public title = messages.getMessage(
        'android:reqs:androidsdk:requirements:title'
    );
    constructor(logger: Logger) {
        this.requirements = [new AndroidSDKRootSetRequirement(logger)];
    }
}

export class AndroidSDKPrerequisites implements RequirementList {
    public requirements: Requirement[] = [];
    public enabled = true;
    public title = messages.getMessage(
        'android:reqs:androidsdkprerequisites:requirements:title'
    );
    constructor(logger: Logger) {
        this.requirements = [new Java8AvailableRequirement(logger)];
    }
}

export class AndroidCommandLineToolsRequirements implements RequirementList {
    public requirements: Requirement[] = [];
    public enabled = true;
    public title = messages.getMessage(
        'android:reqs:cmdlinetools:requirements:title'
    );
    constructor(logger: Logger) {
        this.requirements = [
            new AndroidCommandLineToolsInstalledRequirement(logger),
            new AndroidCommandLineToolsInstallTask(logger)
        ];
    }
}

export class AndroidSDKPlatformToolsInstalledRequirements
    implements RequirementList
{
    public requirements: Requirement[] = [];
    public enabled = true;
    public title = messages.getMessage(
        'android:reqs:platformtools:requirements:title'
    );
    constructor(logger: Logger) {
        this.requirements = [
            new AndroidSDKPlatformToolsInstalledRequirement(logger)
        ];
    }
}

export class PlatformAPIPackageRequirements implements RequirementList {
    public requirements: Requirement[] = [];
    public enabled = true;
    public title = messages.getMessage(
        'android:reqs:platformapi:requirements:title'
    );
    constructor(logger: Logger, apiLevel?: string) {
        this.requirements = [
            new PlatformAPIPackageRequirement(logger, apiLevel)
        ];
    }
}

export class EmulatorImagesRequirements implements RequirementList {
    public requirements: Requirement[] = [];
    public enabled = true;
    public title = messages.getMessage(
        'android:reqs:emulatorimages:requirements:title'
    );
    constructor(logger: Logger, apiLevel?: string) {
        this.requirements = [new EmulatorImagesRequirement(logger, apiLevel)];
    }
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidSDKRootSetRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    public skipped: boolean;

    constructor(logger: Logger) {
        this.title = messages.getMessage('android:reqs:androidhome:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:androidhome:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:androidhome:unfulfilledMessage'
        );
        this.logger = logger;
        this.skipped = false;
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
            return Promise.reject(this.unfulfilledMessage);
        }
    }
}

// tslint:disable-next-line: max-classes-per-file
export class Java8AvailableRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    public skipped: boolean;

    constructor(logger: Logger) {
        this.title = messages.getMessage('android:reqs:androidjavacheck:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:androidsdkprerequisitescheck:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:androidsdkprerequisitescheck:unfulfilledMessage'
        );
        this.logger = logger;
        this.skipped = false;
        if (!AndroidUtils.getAndroidSdkRoot()) {
            this.skipped = true;
        }
    }

    /**
     * Verifies that prerequisites for Android SDK are met and that Java 8 is installed.
     */
    public async checkFunction(): Promise<string> {
        return (
            AndroidUtils.androidSDKPrerequisitesCheck()
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .then((result) => Promise.resolve(this.fulfilledMessage))
                .catch((error) =>
                    Promise.reject(
                        new SfdxError(
                            util.format(this.unfulfilledMessage, error.message)
                        )
                    )
                )
        );
    }
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidCommandLineToolsInstalledRequirement
    implements Requirement
{
    public title: string;
    public skipped: boolean;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    constructor(logger: Logger) {
        this.title = messages.getMessage('android:reqs:cmdlinetools:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:cmdlinetools:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:cmdlinetools:unfulfilledMessage'
        );
        this.logger = logger;

        this.skipped = false;
        if (!AndroidUtils.getAndroidSdkRoot()) {
            this.skipped = true;
        }
    }

    /**
     * Verifies that user has Android command line tools installed.
     */
    public async checkFunction(): Promise<string> {
        return (
            AndroidUtils.fetchAndroidCmdLineToolsLocation()
                .then((result) =>
                    Promise.resolve(
                        AndroidUtils.convertToUnixPath(
                            util.format(this.fulfilledMessage, result)
                        )
                    )
                )
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .catch((error) =>
                    // We will resolve rather than reject since we indicate that the SDK was not found.
                    // And will count on the next subtask to install the command line tools.
                    // If we reject, then the entire batch will show as failed, even if the install is successful,
                    // so we leave the ulimate rejection to whether the command lines tools are successfully installed or not.
                    Promise.resolve(this.unfulfilledMessage)
                )
        );
    }
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidCommandLineToolsInstallTask implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;
    public skipped: boolean;

    constructor(logger: Logger) {
        this.title = messages.getMessage(
            'android:reqs:cmdlinetools:install:title'
        );
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:cmdlinetools:install:resolvedMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:cmdlinetools:install:unableToResolveMessage'
        );
        this.logger = logger;

        this.skipped = false;
        if (!AndroidUtils.getAndroidSdkRoot()) {
            this.skipped = true;
        } else {
            try {
                CommonUtils.executeCommandSync(
                    `${AndroidUtils.getSdkManagerCommand()} --version`
                );
                this.skipped = true;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
                this.skipped = false;
            }
        }
    }

    /**
     * Installs the Android Command Line Tools
     * Only gets here, if not skipped.
     */
    public async checkFunction(): Promise<string | undefined> {
        return new AndroidCommandLineToolsResolver(
            this.logger
        ).resolveFunction();
    }
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidSDKPlatformToolsInstalledRequirement
    implements Requirement
{
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    private notFoundMessage: string;
    public logger: Logger;
    public skipped: boolean;

    constructor(logger: Logger) {
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

        this.skipped = false;
        if (!AndroidUtils.getAndroidSdkRoot()) {
            this.skipped = true;
        }
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
    public skipped: boolean;
    private apiLevel?: string;

    constructor(logger: Logger, apiLevel?: string) {
        this.title = messages.getMessage('android:reqs:platformapi:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:platformapi:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:platformapi:unfulfilledMessage'
        );
        this.logger = logger;
        this.apiLevel = apiLevel;

        this.skipped = false;
        if (!AndroidUtils.getAndroidSdkRoot()) {
            this.skipped = true;
        }
    }

    /**
     * Verifies that user has a supported Android API package that also has matching supported emulator images installed.
     */
    public async checkFunction(): Promise<string> {
        return (
            AndroidUtils.fetchSupportedAndroidAPIPackage(this.apiLevel)
                .then((result) =>
                    Promise.resolve(
                        util.format(this.fulfilledMessage, result.platformAPI)
                    )
                )
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .catch((error) =>
                    Promise.reject(
                        new SfdxError(
                            util.format(
                                this.unfulfilledMessage,
                                PlatformConfig.androidConfig()
                                    .minSupportedRuntime
                            )
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
    public skipped: boolean;
    private apiLevel?: string;

    constructor(logger: Logger, apiLevel?: string) {
        this.title = messages.getMessage('android:reqs:emulatorimages:title');
        this.fulfilledMessage = messages.getMessage(
            'android:reqs:emulatorimages:fulfilledMessage'
        );
        this.unfulfilledMessage = messages.getMessage(
            'android:reqs:emulatorimages:unfulfilledMessage'
        );
        this.logger = logger;
        this.apiLevel = apiLevel;

        this.skipped = false;
        if (!AndroidUtils.getAndroidSdkRoot()) {
            this.skipped = true;
        }
    }

    /**
     * Verifies that user has at least one Android package with any of the supported emulator image targets (e.g. Google APIs, default, Google Play).
     */
    public async checkFunction(): Promise<string> {
        return (
            AndroidUtils.fetchSupportedEmulatorImagePackage(this.apiLevel)
                .then((result) =>
                    Promise.resolve(
                        util.format(this.fulfilledMessage, result.path)
                    )
                )
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                )
        );
    }
}
