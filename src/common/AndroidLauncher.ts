/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import androidConfig from '../config/androidconfig.json';
import { AndroidSDKUtils } from './AndroidUtils';
import { AndroidAppPreviewConfig, LaunchArgument } from './PreviewConfigFile';
import { CommonUtils } from './CommonUtils';
import { PreviewUtils } from './PreviewUtils';

export class AndroidLauncher {
    private emulatorName: string;

    constructor(emulatorName: string) {
        this.emulatorName = emulatorName;
    }

    public async launchPreview(
        compName: string,
        projectDir: string,
        appBundlePath: string | undefined,
        targetApp: string,
        appConfig: AndroidAppPreviewConfig | undefined,
        serverPort: string
    ): Promise<void> {
        const preferredPack = await AndroidSDKUtils.findRequiredEmulatorImages();
        const emuImage = preferredPack.platformEmulatorImage || 'default';
        const androidApi = preferredPack.platformAPI;
        const abi = preferredPack.abi;
        const device = androidConfig.supportedDevices[0];
        let emulatorPort = await AndroidSDKUtils.getNextAndroidAdbPort();
        const emuName = this.emulatorName;
        CommonUtils.startCliAction(`Launching`, `Searching for ${emuName}`);
        return AndroidSDKUtils.hasEmulator(emuName)
            .then((result) => {
                if (!result) {
                    CommonUtils.startCliAction(
                        `Launching`,
                        `Creating device ${emuName}`
                    );
                    return AndroidSDKUtils.createNewVirtualDevice(
                        emuName,
                        emuImage,
                        androidApi,
                        device,
                        abi
                    );
                }
                CommonUtils.startCliAction(
                    `Launching`,
                    `Found device ${emuName}`
                );
                return Promise.resolve();
            })
            .then(() => {
                CommonUtils.startCliAction(
                    `Launching`,
                    `Starting device ${emuName}`
                );
                return AndroidSDKUtils.startEmulator(emuName, emulatorPort);
            })
            .then((actualPort) => {
                emulatorPort = actualPort;
                CommonUtils.startCliAction(
                    `Launching`,
                    `Waiting for device ${emuName} to boot`
                );
                return AndroidSDKUtils.pollDeviceStatus(emulatorPort);
            })
            .then(() => {
                const useServer = PreviewUtils.useLwcServerForPreviewing(
                    targetApp,
                    appConfig
                );
                const address = useServer ? 'http://10.0.2.2' : undefined; // TODO: dynamically determine server address
                const port = useServer ? serverPort : undefined;

                if (PreviewUtils.isTargetingBrowser(targetApp)) {
                    const compPath = PreviewUtils.prefixRouteIfNeeded(compName);
                    const url = `${address}:${port}/lwc/preview/${compPath}`;
                    return AndroidSDKUtils.launchURLIntent(url, emulatorPort);
                } else {
                    CommonUtils.stopCliAction(`Launching App ${targetApp}`);

                    const launchActivity =
                        (appConfig && appConfig.activity) || '';

                    const targetAppArguments: LaunchArgument[] =
                        (appConfig && appConfig.launch_arguments) || [];
                    return AndroidSDKUtils.launchNativeApp(
                        compName,
                        projectDir,
                        appBundlePath,
                        targetApp,
                        targetAppArguments,
                        launchActivity,
                        emulatorPort,
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
