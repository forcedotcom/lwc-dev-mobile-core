/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import Ajv from 'ajv';
import path from 'path';
import { CommonUtils } from './CommonUtils';
import {
    AndroidAppPreviewConfig,
    IOSAppPreviewConfig,
    PreviewConfigFile
} from './PreviewConfigFile';

const NAMESPACE = 'com.salesforce.mobile-tooling';

export interface ValidationResult {
    errorMessage: string | null;
    passed: boolean;
}

export class PreviewUtils {
    public static BROWSER_TARGET_APP = 'browser';
    public static COMPONENT_NAME_ARG_PREFIX = `${NAMESPACE}.componentname`;
    public static PROJECT_DIR_ARG_PREFIX = `${NAMESPACE}.projectdir`;
    public static SERVER_PORT_PREFIX = `${NAMESPACE}.serverport`;
    public static SERVER_ADDRESS_PREFIX = `${NAMESPACE}.serveraddress`;

    /**
     * Checks to see if browser is the target for previewing an LWC.
     * @param targetApp The desired target app ('browser' or app bundle id).
     * @returns True if targetApp is browser.
     */
    public static isTargetingBrowser(targetApp: string): boolean {
        return (
            targetApp.trim().toLowerCase() === PreviewUtils.BROWSER_TARGET_APP
        );
    }

    /**
     * Checks to see if an LWC local dev server is needed for previewing an LWC for a provided target app.
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
            (appConfig !== undefined &&
                appConfig.preview_server_enabled === true)
        );
    }

    /**
     * Validates a preview configuration file against a schema.
     * @param configFile The path to the preview configuration file.
     * @param schema The schema object to be used for validation.
     * @returns A ValidationResult object containing a pass/fail boolean and, for failure, an error message string.
     */
    public static async validateConfigFileWithSchema(
        configFile: string,
        schema: object
    ): Promise<ValidationResult> {
        try {
            const configFileJson = CommonUtils.loadJsonFromFile(configFile);

            const ajv = new Ajv({ allErrors: true });
            const validationResult = await ajv.validate(schema, configFileJson);
            const hasError = ajv.errors ? ajv.errors.length > 0 : false;
            const errorText = ajv.errors ? ajv.errorsText() : '';
            const isValid = validationResult === true && hasError === false;
            return Promise.resolve({
                errorMessage: errorText,
                passed: isValid
            });
        } catch (err) {
            return Promise.resolve({
                errorMessage: err,
                passed: false
            });
        }
    }

    /**
     * Loads a preview configuration file.
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
     * @param basePath Path to the directory that contains the preview configuration file.
     * @param appConfig An app preview configuration.
     * @returns A string representing the app bundle path.
     */
    public static getAppBundlePath(
        basePath: string,
        appConfig: IOSAppPreviewConfig | AndroidAppPreviewConfig
    ): string | undefined {
        if (appConfig.get_app_bundle) {
            const module = require(path.resolve(
                basePath,
                appConfig.get_app_bundle
            ));
            return module.run();
        } else {
            return undefined;
        }
    }
}
