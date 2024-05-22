/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import { AndroidUtils } from './AndroidUtils.js';
import { AndroidAppPreviewConfig, LaunchArgument } from './PreviewConfigFile.js';
import { CommonUtils } from './CommonUtils.js';
import { PreviewUtils } from './PreviewUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

export class AndroidLauncher {
    private emulatorName: string;

    public constructor(emulatorName: string) {
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
     * @param targetingLwrServer Indicates whether we're previewing using LWC Dev Server (default behavior) or LWR Server.
     */
    public async launchPreview(
        compName: string,
        projectDir: string,
        appBundlePath: string | undefined,
        targetApp: string,
        appConfig: AndroidAppPreviewConfig | undefined,
        serverPort: string,
        targetingLwrServer: boolean = false
    ): Promise<void> {
        const preferredPack = await AndroidUtils.fetchSupportedEmulatorImagePackage();
        const emuImage = preferredPack.platformEmulatorImage || 'default';
        const androidApi = preferredPack.platformAPI;
        const abi = preferredPack.abi;
        const device = (await AndroidUtils.getSupportedDevices())[0];
        const emuName = this.emulatorName;
        CommonUtils.startCliAction(
            messages.getMessage('startPreviewAction'),
            messages.getMessage('searchForDeviceStatus', [emuName])
        );
        return AndroidUtils.hasEmulator(emuName)
            .then((result) => {
                if (!result) {
                    CommonUtils.updateCliAction(messages.getMessage('createDeviceStatus', [emuName]));
                    return AndroidUtils.createNewVirtualDevice(emuName, emuImage, androidApi, device, abi);
                }
                CommonUtils.updateCliAction(messages.getMessage('foundDeviceStatus', [emuName]));
                return Promise.resolve();
            })
            .then(() => {
                CommonUtils.updateCliAction(messages.getMessage('startDeviceStatus', [emuName]));
                return AndroidUtils.startEmulator(emuName);
            })
            .then((emulatorPort) => {
                const useServer = PreviewUtils.useLwcServerForPreviewing(targetApp, appConfig);
                const address = useServer ? 'http://10.0.2.2' : undefined; // TODO: dynamically determine server address
                const port = useServer ? serverPort : undefined;

                if (PreviewUtils.isTargetingBrowser(targetApp)) {
                    let url = '';
                    if (targetingLwrServer) {
                        url = `${address}:${port}`;
                    } else {
                        const compPath = PreviewUtils.prefixRouteIfNeeded(compName);
                        url = `${address}:${port}/lwc/preview/${compPath}`;
                    }

                    CommonUtils.updateCliAction(messages.getMessage('launchBrowserStatus', [url]));
                    return AndroidUtils.launchURLIntent(url, emulatorPort);
                } else {
                    CommonUtils.updateCliAction(messages.getMessage('launchAppStatus', [targetApp]));

                    const launchActivity = appConfig?.activity ?? '';

                    const targetAppArguments: LaunchArgument[] = appConfig?.launch_arguments ?? [];
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
                CommonUtils.stopCliAction(messages.getMessage('genericErrorStatus'));
                throw error;
            });
    }
}
