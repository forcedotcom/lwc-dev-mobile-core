/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { AndroidUtils } from './AndroidUtils';
import { AndroidAppPreviewConfig, LaunchArgument } from './PreviewConfigFile';
import { CommonUtils } from './CommonUtils';
import { PreviewUtils } from './PreviewUtils';

export class AndroidLauncher {
    private emulatorName: string;

    constructor(emulatorName: string) {
        this.emulatorName = emulatorName;
    }

    /**
     * Attempts to preview a Lightning Web Component. It will create the target emulator if it doesn't already exist.
     * It will launch the emulator and wait for it to boot and will then proceed to preview the LWC. If the preview
     * target is the browser then it will launch the emulator browser for previewing the LWC. If the preview target
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
        appConfig: AndroidAppPreviewConfig | undefined,
        serverPort: string
    ): Promise<void> {
        const preferredPack = await AndroidUtils.fetchSupportedEmulatorImagePackage();
        const emuImage = preferredPack.platformEmulatorImage || 'default';
        const androidApi = preferredPack.platformAPI;
        const abi = preferredPack.abi;
        const device = (await AndroidUtils.getSupportedDevices())[0];
        let emulatorPort = await AndroidUtils.getNextAndroidAdbPort();
        const emuName = this.emulatorName;
        CommonUtils.startCliAction(`Launching`, `Searching for ${emuName}`);
        return AndroidUtils.hasEmulator(emuName)
            .then((result) => {
                if (!result) {
                    CommonUtils.startCliAction(
                        `Launching`,
                        `Creating device ${emuName}`
                    );
                    return AndroidUtils.createNewVirtualDevice(
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
                return AndroidUtils.startEmulator(emuName, emulatorPort);
            })
            .then((actualPort) => {
                emulatorPort = actualPort;

                const useServer = PreviewUtils.useLwcServerForPreviewing(
                    targetApp,
                    appConfig
                );
                const address = useServer ? 'http://10.0.2.2' : undefined; // TODO: dynamically determine server address
                const port = useServer ? serverPort : undefined;

                if (PreviewUtils.isTargetingBrowser(targetApp)) {
                    const compPath = PreviewUtils.prefixRouteIfNeeded(compName);
                    const url = `${address}:${port}/lwc/preview/${compPath}`;
                    return AndroidUtils.launchURLIntent(url, emulatorPort);
                } else {
                    CommonUtils.stopCliAction(`Launching App ${targetApp}`);

                    const launchActivity =
                        (appConfig && appConfig.activity) || '';

                    const targetAppArguments: LaunchArgument[] =
                        (appConfig && appConfig.launch_arguments) || [];
                    return AndroidUtils.launchNativeApp(
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
