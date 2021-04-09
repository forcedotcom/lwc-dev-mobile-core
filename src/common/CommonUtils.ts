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
import http from 'http';
import https from 'https';
import util from 'util';
import path from 'path';
import os from 'os';
import { CommandLineUtils, Version } from './Common';

type StdioOptions = childProcess.StdioOptions;

const LOGGER_NAME = 'force:lightning:local:commonutils';

export class CommonUtils {
    public static DEFAULT_LWC_SERVER_PORT = '3333';

    /**
     * Initializes the logger used by CommonUtils for logging activities.
     */
    public static async initializeLogger(): Promise<void> {
        CommonUtils.logger = await Logger.child(LOGGER_NAME);
        return Promise.resolve();
    }

    /**
     * Returns a Promise that supports timeout
     *
     * @param timeout Timeout value in milliseconds.
     * @param promise The promise to execute
     * @param failureMessage Optional failure message when timeout happens
     * @returns A Promise that supports timeout
     */
    public static promiseWithTimeout<T>(
        timeout: number,
        promise: Promise<T>,
        failureMessage?: string
    ): Promise<T> {
        // Javascript/TypeScript do not have promises that timeout. However we could use
        // Promise.race() to easily implement that. Promise.race() executes two promises
        // and returns as soon as one of them resolves/rejects without waiting for the other.
        // So we can take the user provided promise and race it against another promise that we
        // create, which simply sleeps for a set amount of time then rejects with timeout error.
        let timeoutHandle: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((resolve, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(failureMessage));
            }, timeout);
        });

        return Promise.race([promise, timeoutPromise]).finally(() => {
            // Clear the timeout handle so that any attached debugger would not remain attached
            // until after setTimeout() call returns. This is specially useful for large timeout values.
            clearTimeout(timeoutHandle);
        });
    }

    /**
     * Sleeps for a given amount of time.
     *
     * @param ms Sleep time in milliseconds.
     * @returns A promise that simply sleeps for a given amount of time.
     */
    public static async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Starts a CLI action
     *
     * @param action Title of the action.
     * @param status Optional status message for the action.
     */
    public static startCliAction(action: string, status?: string) {
        cli.action.start(action, status, { stdout: true });
    }

    /**
     * Updates the last CLI task with the provided status message. If it cannot find
     * an active CLI task, it will call startCliAction instead to start a new task.
     *
     * @param status Status message for the action.
     */
    public static updateCliAction(status: string) {
        const task = cli.action.task;
        if (!task || !task.active) {
            CommonUtils.startCliAction(status);
        } else {
            task.status = status;
        }
    }

    /**
     * Stops a CLI action
     *
     * @param message Optional status message for the action.
     */
    public static stopCliAction(message?: string) {
        cli.action.stop(message);
    }

    /**
     * Given a path it will attempt to replace the ~ character *at the beginning* of
     * the path (if any) with the user's home path value.
     *
     * @param inputPath The path to resolve.
     * @returns Resolved path.
     */
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

    /**
     * Given the path to a JSON file, it will load the content of the file.
     *
     * @param file The path to the JSON file.
     * @returns Content of the file as JSON object.
     */
    public static loadJsonFromFile(file: string): any {
        const fileContent = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(fileContent);
        return json;
    }

    /**
     * Given a tokenized string, it replaces instances of variables in the tokenized string with their associated values.
     * Example input:
     * template: '${token}.my.salesforce.com'
     * variables['token']: 'myHost'
     * returns: 'myHost.my.salesforce.com'
     *
     * @param template Tokenized input string.
     * @param variables List of token names and values.
     * @returns Resolved string.
     */
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

    /**
     * Creates a unique temp directory that is prefixed with 'lwc-mobile-'
     *
     * @returns Path to the newaly created temp directory.
     */
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

    /**
     * Execute a command synchronously and throws any errors that occur.
     *
     * @param command The command to be executed.
     * @param stdioOptions Options to be used for [stderr, stdin, stdout]. Defaults to ['ignore', 'pipe', 'ignore']
     * @returns Result of the command execution.
     */
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

    /**
     * Execute a command asynchronously.
     *
     * @param command The command to be executed.
     * @returns A promise containing the results of stdout and stderr
     */
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

    /**
     * Launches the desktop browser and navigates to the provided URL.
     *
     * @returns A Promise that launches the desktop browser and navigates to the provided URL.
     */
    public static async launchUrlInDesktopBrowser(url: string): Promise<void> {
        const openCmd =
            process.platform === 'darwin'
                ? 'open'
                : process.platform === 'win32'
                ? 'start'
                : 'xdg-open';

        return CommonUtils.executeCommandAsync(`${openCmd} ${url}`).then(() =>
            Promise.resolve()
        );
    }

    /**
     * A Promise that checks whether the local dev server plugin is installed or not.
     * The Promise will resolve if the plugin is installed and will reject otherwise.
     *
     * @returns A Promise that checks whether the local dev server plugin is installed or not.
     */
    public static async isLwcServerPluginInstalled(): Promise<void> {
        const command = 'sfdx force:lightning:lwc:start --help';
        return CommonUtils.executeCommandAsync(command).then(() =>
            Promise.resolve()
        );
    }

    /**
     * Gets the port number for local dev server.
     *
     * @returns The port that local dev server is running on, or undefined if the server is not running.
     */
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

    /**
     * Downloads a resource from a given url into a destination file.
     */
    public static async downloadFile(url: string, dest: string): Promise<void> {
        const finalUrl = url.toLowerCase().startsWith('http')
            ? url
            : `http://${url}`;

        const protocol = finalUrl.toLowerCase().startsWith('https')
            ? https
            : http;

        return new Promise((resolve, reject) => {
            const destFile = fs.createWriteStream(dest);

            const request = protocol.get(finalUrl, (response) => {
                if (response.statusCode !== 200) {
                    const msg = `Error downloading ${finalUrl} - ${response.socket}: ${response.statusMessage}`;
                    this.logger.error(msg);
                    fs.unlink(dest, () => reject(new Error(msg)));
                    return;
                }
                response.pipe(destFile);
            });

            destFile.on('finish', () => {
                destFile.close();
                resolve();
            });

            destFile.on('error', (err) => {
                const msg = `Error saving ${finalUrl} to file ${dest} - ${err}`;
                this.logger.error(msg);
                fs.unlink(dest, () => reject(new Error(msg)));
            });

            request.on('error', (err) => {
                const msg = `Error downloading ${finalUrl} - ${err}`;
                this.logger.error(msg);
                fs.unlink(dest, () => reject(new Error(msg)));
            });

            request.end();
        });
    }

    private static logger: Logger = new Logger(LOGGER_NAME);
}
