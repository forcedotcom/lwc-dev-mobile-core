/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import util from 'util';
import { IOSUtils } from './IOSUtils';
import { IOSAppPreviewConfig, LaunchArgument } from './PreviewConfigFile';
import { CommonUtils } from './CommonUtils';
import { PreviewUtils } from './PreviewUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    '@salesforce/lwc-dev-mobile-core',
    'common'
);

export class IOSLauncher {
    private simulatorName: string;

    constructor(simulatorName: string) {
        this.simulatorName = simulatorName;
    }

    /**
     * Attempts to preview a Lightning Web Component. It will create the target simulator if it doesn't already exist.
     * It will launch the simulator and wait for it to boot and will then proceed to preview the LWC. If the preview
     * target is the browser then it will launch the simulator browser for previewing the LWC. If the preview target
     * is a native app then it will install & launch the native app for previewing the LWC.
     *
     * @param compName Name of the LWC component.
     * @param projectDir Path to the LWC project root directory.
     * @param appBundlePath Optional path to the app bundle of the native app. This will be used to install the app if not already installed.
     * @param targetApp The bundle ID of the app to be launched.
     * @param appConfig An AndroidAppPreviewConfig object containing app configuration info.
     * @param serverPort The port for local dev server.
     */
    public async launchPreview(
        compName: string,
        projectDir: string,
        appBundlePath: string | undefined,
        targetApp: string,
        appConfig: IOSAppPreviewConfig | undefined,
        serverPort: string
    ): Promise<void> {
        const availableDevices: string[] = await IOSUtils.getSupportedDevices();
        const supportedRuntimes: string[] = await IOSUtils.getSupportedRuntimes();
        const currentSimulator = await IOSUtils.getSimulator(
            this.simulatorName
        );
        const currentSimulatorUDID: string | null =
            currentSimulator && currentSimulator.udid;
        let deviceUDID = '';
        CommonUtils.startCliAction(
            messages.getMessage('startPreviewAction'),
            util.format(
                messages.getMessage('searchForDeviceStatus'),
                this.simulatorName
            )
        );
        if (!currentSimulatorUDID || currentSimulatorUDID.length === 0) {
            CommonUtils.updateCliAction(
                util.format(
                    messages.getMessage('createDeviceStatus'),
                    this.simulatorName
                )
            );
            deviceUDID = await IOSUtils.createNewDevice(
                this.simulatorName,
                availableDevices[0],
                supportedRuntimes[0]
            );
        } else {
            CommonUtils.updateCliAction(
                util.format(
                    messages.getMessage('foundDeviceStatus'),
                    this.simulatorName
                )
            );
            deviceUDID = currentSimulatorUDID;
        }

        CommonUtils.updateCliAction(
            util.format(
                messages.getMessage('startDeviceStatus'),
                `${this.simulatorName} (${deviceUDID})`
            )
        );
        return IOSUtils.bootDevice(deviceUDID)
            .then(() => IOSUtils.launchSimulatorApp())
            .then(() => {
                const useServer = PreviewUtils.useLwcServerForPreviewing(
                    targetApp,
                    appConfig
                );
                const address = useServer ? 'http://localhost' : undefined; // TODO: dynamically determine server address
                const port = useServer ? serverPort : undefined;

                if (PreviewUtils.isTargetingBrowser(targetApp)) {
                    const url = `${address}:${port}`;
                    CommonUtils.stopCliAction(
                        util.format(
                            messages.getMessage('launchBrowserStatus'),
                            url
                        )
                    );
                    return IOSUtils.launchURLInBootedSimulator(deviceUDID, url);
                } else {
                    CommonUtils.stopCliAction(
                        util.format(
                            messages.getMessage('launchAppStatus'),
                            targetApp
                        )
                    );
                    const targetAppArguments: LaunchArgument[] =
                        (appConfig && appConfig.launch_arguments) || [];
                    return IOSUtils.launchAppInBootedSimulator(
                        deviceUDID,
                        compName,
                        projectDir,
                        appBundlePath,
                        targetApp,
                        targetAppArguments,
                        address,
                        port
                    );
                }
            })
            .then(() => {
                CommonUtils.stopCliAction();
                return Promise.resolve();
            })
            .catch((error) => {
                CommonUtils.stopCliAction(
                    messages.getMessage('genericErrorStatus')
                );
                throw error;
            });
    }
}
