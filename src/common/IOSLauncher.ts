/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { IOSUtils } from './IOSUtils';
import { IOSAppPreviewConfig, LaunchArgument } from './PreviewConfigFile';
import { CommonUtils } from './CommonUtils';
import { PreviewUtils } from './PreviewUtils';

export class IOSLauncher {
    private simulatorName: string;

    constructor(simulatorName: string) {
        this.simulatorName = simulatorName;
    }

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
            `Launching`,
            `Searching for ${this.simulatorName}`
        );
        if (!currentSimulatorUDID || currentSimulatorUDID.length === 0) {
            CommonUtils.startCliAction(
                `Launching`,
                `Creating device ${this.simulatorName}`
            );
            deviceUDID = await IOSUtils.createNewDevice(
                this.simulatorName,
                availableDevices[0],
                supportedRuntimes[0]
            );
            CommonUtils.startCliAction(
                `Launching`,
                `Created device ${this.simulatorName}`
            );
        } else {
            CommonUtils.startCliAction(
                `Launching`,
                `Found device ${this.simulatorName}`
            );
            deviceUDID = currentSimulatorUDID;
        }

        return IOSUtils.launchSimulatorApp()
            .then(() => {
                CommonUtils.startCliAction(
                    `Launching`,
                    `Starting device ${deviceUDID}`
                );
                return IOSUtils.bootDevice(deviceUDID);
            })
            .then(() => {
                CommonUtils.startCliAction(
                    `Launching`,
                    `Waiting for device ${deviceUDID} to boot`
                );
                return IOSUtils.waitUntilDeviceIsReady(deviceUDID);
            })
            .then(() => {
                const useServer = PreviewUtils.useLwcServerForPreviewing(
                    targetApp,
                    appConfig
                );
                const address = useServer ? 'http://localhost' : undefined; // TODO: dynamically determine server address
                const port = useServer ? serverPort : undefined;

                if (PreviewUtils.isTargetingBrowser(targetApp)) {
                    const compPath = PreviewUtils.prefixRouteIfNeeded(compName);
                    const url = `${address}:${port}/lwc/preview/${compPath}`;
                    return IOSUtils.launchURLInBootedSimulator(deviceUDID, url);
                } else {
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
                CommonUtils.stopCliAction('Error encountered during launch');
                throw error;
            });
    }
}
