/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import Ajv from 'ajv';
import { Logger } from '@salesforce/core';
import { CommandLineUtils } from './Common.js';
import { CommonUtils } from './CommonUtils.js';
import { AndroidAppPreviewConfig, IOSAppPreviewConfig, PreviewConfigFile } from './PreviewConfigFile.js';

const NAMESPACE = 'com.salesforce.mobile-tooling';

export type ValidationResult = {
    errorMessage: string | null;
    passed: boolean;
};

export class PreviewUtils {
    public static BROWSER_TARGET_APP = 'browser';
    public static COMPONENT_NAME_ARG_PREFIX = `${NAMESPACE}.componentname`;
    public static PROJECT_DIR_ARG_PREFIX = `${NAMESPACE}.projectdir`;
    public static SERVER_PORT_PREFIX = `${NAMESPACE}.serverport`;
    public static SERVER_ADDRESS_PREFIX = `${NAMESPACE}.serveraddress`;

    /**
     * Checks to see if browser is the target for previewing an LWC.
     *
     * @param targetApp The desired target app ('browser' or app bundle id).
     * @returns True if targetApp is browser.
     */
    public static isTargetingBrowser(targetApp: string): boolean {
        return targetApp.trim().toLowerCase() === PreviewUtils.BROWSER_TARGET_APP;
    }

    /**
     * Checks to see if an LWC local dev server is needed for previewing an LWC for a provided target app.
     *
     * @param targetApp The target app.
     * @param appConfig A preview configuration file.
     * @returns True if local dev server is needed for previewing.
     */
    public static useLwcServerForPreviewing(
        targetApp: string,
        appConfig: IOSAppPreviewConfig | AndroidAppPreviewConfig | undefined
    ): boolean {
        return (
            PreviewUtils.isTargetingBrowser(targetApp) ||
            (appConfig !== undefined && appConfig.preview_server_enabled === true)
        );
    }

    /**
     * Checks to see if a component route needs to be prefixed.
     *
     * @param compName A component route or name.
     * @returns The updated route which now starts with `c/` if compName did not start with `c/` already.
     */
    public static prefixRouteIfNeeded(compName: string): string {
        if (compName.toLowerCase().startsWith('c/')) {
            return compName;
        }
        return 'c/' + compName;
    }

    /**
     * Validates a preview configuration file against a schema.
     *
     * @param configFile The path to the preview configuration file.
     * @param schema The schema object to be used for validation.
     * @returns A ValidationResult object containing a pass/fail boolean and, for failure, an error message string.
     */
    public static validateConfigFileWithSchema(configFile: string, schema: object): Promise<ValidationResult> {
        try {
            const configFileJson = CommonUtils.loadJsonFromFile(configFile);

            const validator = new Ajv.default({ allErrors: true });
            const validationResult = validator.validate(schema, configFileJson);
            const hasError = validator.errors ? validator.errors.length > 0 : false;
            const errorText = validator.errors ? validator.errorsText() : '';
            const isValid = validationResult === true && hasError === false;
            return Promise.resolve({
                errorMessage: errorText,
                passed: isValid
            });
        } catch (err) {
            return Promise.resolve({
                errorMessage: (err as Error).toString(),
                passed: false
            });
        }
    }

    /**
     * Loads a preview configuration file.
     *
     * @param file The path to a preview configuration file.
     * @returns The content of the file parsed into a PreviewConfigFile object.
     */
    public static loadConfigFile(file: string): PreviewConfigFile {
        const json = CommonUtils.loadJsonFromFile(file);
        const configFile = Object.assign(new PreviewConfigFile(), json);
        return configFile;
    }

    /**
     * Attempts to obtain the app bundle path from an app preview config.
     *
     * @param basePath Path to the directory that contains the preview configuration file.
     * @param appConfig An app preview configuration.
     * @returns A string representing the app bundle path.
     */
    public static getAppBundlePath(
        basePath: string,
        appConfig: IOSAppPreviewConfig | AndroidAppPreviewConfig
    ): string | undefined {
        if (appConfig.get_app_bundle) {
            const require = createRequire(import.meta.url);
            const module = require(path.resolve(basePath, appConfig.get_app_bundle));
            return module.run();
        } else {
            return undefined;
        }
    }

    /**
     * For the new Local Development Preview approach where a new local dev server is being used,
     * the local dev server needs to be configured to use a web socket url for local previewing.
     * This method generates an appropriate web socket url to be used by the local dev server.
     *
     * @param platform a platform flag (desktop , ios, android).
     * @param ports the http and https port numbers that the local dev server is configured to use.
     * @returns A string representing a web socket url to be used by the local dev server.
     */
    public static generateWebSocketUrlForLocalDevServer(
        platform: string,
        ports: { httpPort: number; httpsPort: number },
        logger?: Logger
    ): string {
        /*
          - For desktop browsers other than Safari, local development use cases will target ws://localhost:<port> connections to the local dev server
          - For the Safari desktop browser, target wss://localhost:<port>
            
          - For mobile (webview in native apps), local development use cases will target:
            - iOS: wss://localhost:<port>
            - Android: wss://10.0.2.2:<port>
        */

        if (CommandLineUtils.platformFlagIsIOS(platform)) {
            return `wss://localhost:${ports.httpsPort}`;
        }

        if (CommandLineUtils.platformFlagIsAndroid(platform)) {
            return `wss://10.0.2.2:${ports.httpsPort}`;
        }

        if (process.platform !== 'darwin') {
            return `ws://localhost:${ports.httpPort}`; // cannot be Safari since it is only available on Mac
        }

        // If we've made it this far then it means that platform=desktop and we're on a Mac
        // macOS use case: check to see if the default browser is Safari
        // From https://apple.stackexchange.com/questions/313454/applescript-find-the-users-set-default-browser
        const cmd =
            "defaults read ~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure | awk -F'\"' '/http;/{print window[(NR)-1]}{window[NR]=$2}'";
        const result = CommonUtils.executeCommandSync(cmd, undefined, logger).trim().toLowerCase();
        const isSafari = result.includes('safari') || result === '';
        return isSafari ? `wss://localhost:${ports.httpsPort}` : `ws://localhost:${ports.httpPort}`;
    }
}
