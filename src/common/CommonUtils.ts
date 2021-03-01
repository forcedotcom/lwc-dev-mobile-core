/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, SfdxError } from '@salesforce/core';
import * as childProcess from 'child_process';
import { cli } from 'cli-ux';
import fs from 'fs';
import util from 'util';
import path from 'path';
import os from 'os';

type StdioOptions = childProcess.StdioOptions;

const LOGGER_NAME = 'force:lightning:local:commonutils';

export class CommonUtils {
    public static DEFAULT_LWC_SERVER_PORT = '3333';

    public static async initializeLogger(): Promise<void> {
        CommonUtils.logger = await Logger.child(LOGGER_NAME);
        return Promise.resolve();
    }

    public static promiseWithTimeout<T>(
        timeout: number,
        promise: Promise<T>,
        failureMessage?: string
    ): Promise<T> {
        let timeoutHandle: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((resolve, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(failureMessage));
            }, timeout);
        });

        return Promise.race([promise, timeoutPromise]).finally(() => {
            clearTimeout(timeoutHandle);
        });
    }

    public static async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    public static startCliAction(action: string, status?: string) {
        cli.action.start(action, status, { stdout: true });
    }

    public static stopCliAction(message?: string) {
        cli.action.stop(message);
    }

    public static resolveUserHomePath(inputPath: string): string {
        let newPath = inputPath.trim();
        if (newPath.startsWith('~')) {
            const userHome =
                process.env.HOME ||
                process.env.HOMEPATH ||
                process.env.USERPROFILE ||
                '';
            newPath = newPath.replace('~', userHome);
        }
        return newPath;
    }

    public static loadJsonFromFile(file: string): any {
        const fileContent = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(fileContent);
        return json;
    }

    // Replace instances of '${value}' in a string with variables['value'].
    // Example input:
    // template: '${token}.my.salesforce.com'
    // variables['token']: 'myHost'
    // returns: 'myHost.my.salesforce.com'
    public static replaceTokens(
        template: string,
        variables: { [name: string]: string }
    ): string {
        const regex = /\$\{\w+\}/g;
        return template.replace(regex, (match) => {
            const key = match.slice(2, -1);
            if (variables[key] == null) {
                return match;
            }
            return variables[key];
        });
    }

    public static async createTempDirectory(): Promise<string> {
        const mkdtemp = util.promisify(fs.mkdtemp);
        const folderPrefix = 'lwc-mobile-';
        const tempFolderPath = path.join(os.tmpdir(), folderPrefix);
        return mkdtemp(tempFolderPath)
            .then((folder) => {
                return Promise.resolve(folder);
            })
            .catch((error) => {
                return Promise.reject(
                    new SfdxError(
                        util.format(
                            'Could not create a temp folder at %s: %s',
                            tempFolderPath,
                            error
                        ),
                        'lwc-dev-mobile-core'
                    )
                );
            });
    }

    public static executeCommandSync(
        command: string,
        stdioOptions: StdioOptions = ['ignore', 'pipe', 'ignore']
    ): string {
        CommonUtils.logger.debug(`Executing command: '${command}'.`);
        try {
            return childProcess
                .execSync(command, {
                    stdio: stdioOptions
                })
                .toString();
        } catch (error) {
            CommonUtils.logger.error(`Error executing command '${command}':`);
            CommonUtils.logger.error(`${error}`);
            throw error;
        }
    }

    public static async executeCommandAsync(
        command: string
    ): Promise<{ stdout: string; stderr: string }> {
        return new Promise<{ stdout: string; stderr: string }>(
            (resolve, reject) => {
                CommonUtils.logger.debug(`Executing command: '${command}'.`);
                childProcess.exec(command, (error, stdout, stderr) => {
                    if (error) {
                        CommonUtils.logger.error(
                            `Error executing command '${command}':`
                        );

                        // also include stderr & stdout for more detailed error
                        let msg = error.message;
                        if (stderr && stderr.length > 0) {
                            msg = `${msg}\nstderr:\n${stderr}`;
                        }
                        if (stdout && stdout.length > 0) {
                            msg = `${msg}\nstdout:\n${stdout}`;
                        }

                        CommonUtils.logger.error(msg);
                        reject(error);
                    } else {
                        resolve({ stdout, stderr });
                    }
                });
            }
        );
    }

    public static async isLwcServerPluginInstalled(): Promise<void> {
        const command = 'sfdx force:lightning:lwc:start --help';
        return CommonUtils.executeCommandAsync(command).then(() =>
            Promise.resolve()
        );
    }

    public static async getLwcServerPort(): Promise<string | undefined> {
        const getProcessCommand =
            process.platform === 'win32'
                ? 'wmic process where "CommandLine Like \'%force:lightning:lwc:start%\'" get CommandLine  | findstr -v "wmic"'
                : 'ps -ax | grep force:lightning:lwc:start | grep -v grep';

        return CommonUtils.executeCommandAsync(getProcessCommand)
            .then((result) => {
                const output = result.stdout.trim();
                const portPattern = 'force:lightning:lwc:start -p';
                const startIndex = output.indexOf(portPattern);
                let port = CommonUtils.DEFAULT_LWC_SERVER_PORT;
                if (startIndex > 0) {
                    const endIndex = output.indexOf(
                        '\n',
                        startIndex + portPattern.length
                    );
                    if (endIndex > startIndex) {
                        port = output.substring(
                            startIndex + portPattern.length,
                            endIndex
                        );
                    } else {
                        port = output.substr(startIndex + portPattern.length);
                    }
                }
                return Promise.resolve(port.trim());
            })
            .catch((error) => {
                CommonUtils.logger.warn(
                    `Unable to determine server port: ${error}`
                );
                return Promise.resolve(undefined);
            });
    }

    private static logger: Logger = new Logger(LOGGER_NAME);
}
