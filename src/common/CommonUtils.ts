/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger } from '@salesforce/core';
import * as childProcess from 'child_process';
import { cli } from 'cli-ux';
import fs from 'fs';
import os from 'os';
import path from 'path';

type StdioOptions = childProcess.StdioOptions;

const LOGGER_NAME = 'force:lightning:local:commonutils';

export class CommonUtils {
    public static DEFAULT_LWC_SERVER_PORT = '3333';

    public static async initializeLogger(): Promise<void> {
        CommonUtils.logger = await Logger.child(LOGGER_NAME);
        return Promise.resolve();
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
                throw new Error(
                    `Can't find a value for the key '${key}' in the property bag parameter.`
                );
            }
            return variables[key];
        });
    }

    public static createTempDirectory(subfolder: string = ''): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.mkdtemp(path.join(os.tmpdir(), subfolder), (error, folder) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(folder);
                }
            });
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
                ? 'wmic process where "CommandLine Like \'%force:lightning:lwc:start%\'" get CommandLine  | findstr "sfdx.js"'
                : "ps -ax | grep 'force:lightning:lwc:start' | grep 'sfdx.js' | grep -v grep";

        return CommonUtils.executeCommandAsync(getProcessCommand)
            .then((result) => {
                // The result of the above command would be in the form of [ "........./sfdx.js" "force:lightning:lwc:start" ]
                // when no port is specified, or in the form of [ "........./sfdx.js" "force:lightning:lwc:start" "-p" "1234" ]
                // when a port is specified.

                const output = result.stdout.trim();
                let port = CommonUtils.DEFAULT_LWC_SERVER_PORT;
                const pIndex = output.indexOf('-p');
                if (pIndex > 0) {
                    port = output
                        .substr(pIndex + 2)
                        .replace(/"/gi, '')
                        .trim();
                }
                return Promise.resolve(port);
            })
            .catch((error) => {
                // If we got here it's b/c the grep command fails on empty set,
                // which means that the server is not running
                return Promise.resolve(undefined);
            });
    }

    private static logger: Logger = new Logger(LOGGER_NAME);
}
