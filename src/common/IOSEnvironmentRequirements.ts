/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages, SfError } from '@salesforce/core';
import { CommonUtils } from './CommonUtils.js';
import { AppleDeviceManager } from './device/AppleDeviceManager.js';
import { PlatformConfig } from './PlatformConfig.js';
import { Requirement, RequirementList } from './Requirements.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'requirement-ios');

export class IOSEnvironmentRequirements implements RequirementList {
    public requirements: Requirement[] = [];
    public enabled = true;
    public constructor(logger: Logger) {
        this.requirements = [
            new SupportedEnvironmentRequirement(logger),
            new XcodeInstalledRequirement(logger),
            new SupportedSimulatorRuntimeRequirement(logger)
        ];
    }
}

export class SupportedEnvironmentRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    public constructor(logger: Logger) {
        this.title = messages.getMessage('ios:reqs:macos:title');
        this.fulfilledMessage = 'ios:reqs:macos:fulfilledMessage';
        this.unfulfilledMessage = 'ios:reqs:macos:unfulfilledMessage';
        this.logger = logger;
    }

    /**
     * Verifies that user environment is MacOS.
     *
     * @returns True if user environment is MacOS.
     */
    public async checkFunction(): Promise<string> {
        this.logger.info('Executing a check for supported environment');
        const unameCommand = '/usr/bin/uname';
        return CommonUtils.executeCommandAsync(unameCommand, this.logger)
            .then((result) => {
                const output = result.stdout.trim();
                if (output === 'Darwin') {
                    return Promise.resolve(messages.getMessage(this.fulfilledMessage));
                } else {
                    return Promise.reject(new SfError(messages.getMessage(this.unfulfilledMessage, [output])));
                }
            })
            .catch((error: Error) =>
                Promise.reject(
                    new SfError(
                        messages.getMessage(this.unfulfilledMessage, [
                            `command '${unameCommand}' failed: ${error.message}`
                        ])
                    )
                )
            );
    }
}

export class XcodeInstalledRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    public constructor(logger: Logger) {
        this.title = messages.getMessage('ios:reqs:xcode:title');
        this.fulfilledMessage = 'ios:reqs:xcode:fulfilledMessage';
        this.unfulfilledMessage = 'ios:reqs:xcode:unfulfilledMessage';
        this.logger = logger;
    }

    /**
     * Verifies that user has installed the full Xcode and not just the command line tools.
     *
     * @returns True if user has installed the full Xcode.
     */
    public async checkFunction(): Promise<string> {
        this.logger.info('Executing a check for Xcode environment');
        const xcodeBuildCommand = 'xcodebuild -version';
        return CommonUtils.executeCommandAsync(xcodeBuildCommand, this.logger)
            .then((result) => {
                if (result.stdout && result.stdout.length > 0) {
                    const xcodeDetails = result.stdout.trim().replace(/\n/gi, ' ');
                    return Promise.resolve(messages.getMessage(this.fulfilledMessage, [xcodeDetails]));
                } else {
                    return Promise.reject(
                        new SfError(messages.getMessage(this.unfulfilledMessage, [`${result.stderr ?? 'None'}`]))
                    );
                }
            })
            .catch((error: Error) =>
                Promise.reject(new SfError(messages.getMessage(this.unfulfilledMessage, [error.message])))
            );
    }
}

export class SupportedSimulatorRuntimeRequirement implements Requirement {
    public title: string;
    public fulfilledMessage: string;
    public unfulfilledMessage: string;
    public logger: Logger;

    public constructor(logger: Logger) {
        this.title = messages.getMessage('ios:reqs:simulator:title');
        this.fulfilledMessage = 'ios:reqs:simulator:fulfilledMessage';
        this.unfulfilledMessage = 'ios:reqs:simulator:unfulfilledMessage';
        this.logger = logger;
    }

    /**
     * Verifies that user has at least one runtime that is supported.
     *
     * @returns True if user has at least one runtime that is supported.
     */
    public async checkFunction(): Promise<string> {
        this.logger.info('Executing a check for iOS runtimes');
        const deviceManager = new AppleDeviceManager(this.logger);

        return deviceManager
            .enumerateRuntimes()
            .then((supportedRuntimes) => {
                if (supportedRuntimes.length > 0) {
                    return Promise.resolve(
                        messages.getMessage(
                            this.fulfilledMessage,
                            supportedRuntimes.map((it) => it.name)
                        )
                    );
                } else {
                    return Promise.reject(
                        new SfError(
                            messages.getMessage(this.unfulfilledMessage, [
                                `iOS-${PlatformConfig.iOSConfig().minSupportedRuntime}`
                            ])
                        )
                    );
                }
            })
            .catch((error) =>
                Promise.reject(
                    new SfError(
                        messages.getMessage(this.unfulfilledMessage, [
                            `iOS-${PlatformConfig.iOSConfig().minSupportedRuntime} error:${error}`
                        ])
                    )
                )
            );
    }
}
