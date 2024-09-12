/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import * as childProcess from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import util from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { Logger, Messages, SfError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { ux } from '@oclif/core';

type StdioOptions = childProcess.StdioOptions;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

export class CommonUtils {
    public static DEFAULT_LWC_SERVER_PORT = '3333';

    /**
     * Converts a path to UNIX style path.
     *
     * @param dirPath Input path.
     * @returns UNIX style path.
     */
    public static convertToUnixPath(dirPath: string): string {
        return dirPath.replace(/[\\]+/g, '/');
    }

    /**
     * Returns a Promise that supports timeout
     *
     * @param timeout Timeout value in milliseconds.
     * @param promise The promise to execute
     * @param failureMessage Optional failure message when timeout happens
     * @returns A Promise that supports timeout
     */
    public static async promiseWithTimeout<T>(
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
    public static startCliAction(action: string, status?: string): void {
        if (process.stdout?.isTTY === true) {
            ux.action.start(action, status, { stdout: true });
        } else {
            // eslint-disable-next-line no-console
            console.log(`${action}... ${status ?? ''}`);
        }
    }

    /**
     * Updates the last CLI task with the provided status message. If it cannot find
     * an active CLI task, it will call startCliAction instead to start a new task.
     *
     * @param status Status message for the action.
     */
    public static updateCliAction(status: string): void {
        const task = ux.action.task;
        if (!task || !task.active) {
            CommonUtils.startCliAction(status);
        } else if (process.stdout?.isTTY === true) {
            task.status = status;
        } else {
            // eslint-disable-next-line no-console
            console.log(`${task.action}... ${status ?? ''}`);
        }
    }

    /**
     * Stops a CLI action
     *
     * @param message Optional status message for the action.
     */
    public static stopCliAction(message?: string): void {
        ux.action.stop(message);
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
            const userHome = process.env.HOME ?? process.env.HOMEPATH ?? process.env.USERPROFILE ?? '';
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
    public static loadJsonFromFile(file: string): AnyJson {
        const fileContent = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(fileContent) as AnyJson;
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
    public static replaceTokens(template: string, variables: { [name: string]: string }): string {
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
     * @returns Path to the newly created temp directory.
     */
    public static async createTempDirectory(): Promise<string> {
        const mkdtemp = util.promisify(fs.mkdtemp);
        const folderPrefix = 'lwc-mobile-';
        const tempFolderPath = path.join(os.tmpdir(), folderPrefix);
        return mkdtemp(tempFolderPath)
            .then((folder) => Promise.resolve(folder))
            .catch((error) =>
                Promise.reject(
                    new SfError(
                        messages.getMessage('error:tempfolder:create', [tempFolderPath, error]),
                        'lwc-dev-mobile-core'
                    )
                )
            );
    }

    /**
     * Execute a command synchronously and throws any errors that occur.
     *
     * @param command The command to be executed.
     * @param stdioOptions Options to be used for [stderr, stdin, stdout]. Defaults to ['ignore', 'pipe', 'ignore']
     * @returns Result of the command execution.
     */
    public static executeCommandSync(command: string, stdioOptions?: StdioOptions, logger?: Logger): string {
        logger?.debug(`Executing command: '${command}'`);
        try {
            return childProcess
                .execSync(command, {
                    stdio: stdioOptions ?? ['ignore', 'pipe', 'ignore']
                })
                .toString();
        } catch (error) {
            logger?.error(`Error executing command '${command}':`);
            logger?.error(error);
            throw error;
        }
    }

    /**
     * Execute a command asynchronously using child_process.exec()
     *
     * @param command The command to be executed.
     * @returns A promise containing the results of stdout and stderr
     */
    public static async executeCommandAsync(
        command: string,
        logger?: Logger
    ): Promise<{ stdout: string; stderr: string }> {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            logger?.debug(`Executing command: '${command}'`);
            childProcess.exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger?.error(`Error executing command '${command}':`);

                    // also include stderr & stdout for more detailed error
                    let msg = error.message;
                    if (stderr && stderr.length > 0) {
                        msg = `${msg}\nstderr:\n${stderr}`;
                    }
                    if (stdout && stdout.length > 0) {
                        msg = `${msg}\nstdout:\n${stdout}`;
                    }

                    logger?.error(msg);
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    /**
     * Execute a command asynchronously using child_process.spawn()
     *
     * @param command The command to be executed.
     * @param args Array of arguments for the command (if any). Defaults to an empty array.
     * @param stdioOptions Options to be used for [stderr, stdin, stdout]. Defaults to ['ignore', 'pipe', 'ignore']
     * @returns A promise containing the results of stdout and stderr
     */
    public static async spawnCommandAsync(
        command: string,
        args: string[] = [],
        stdioOptions: StdioOptions = ['ignore', 'pipe', 'ignore'],
        logger?: Logger
    ): Promise<{ stdout: string; stderr: string }> {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            const capturedStdout: string[] = [];
            const capturedStderr: string[] = [];

            const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

            logger?.debug(`Executing command: '${fullCommand}'`);

            const prc = CommonUtils.spawnWrapper(command, args, stdioOptions);

            prc.stdout?.on('data', (data: Buffer) => {
                capturedStdout.push(data.toString());
            });

            prc.stderr?.on('data', (data: Buffer) => {
                capturedStderr.push(data.toString());
            });

            prc.on('close', (code) => {
                if (code !== 0) {
                    logger?.error(`Error executing command '${fullCommand}':`);

                    // also include stderr & stdout for more detailed error
                    let msg = `stderr:\n${capturedStderr.join()}`;
                    if (capturedStdout.length > 0) {
                        msg = `${msg}\nstdout:\n${capturedStdout.join('\n')}`;
                    }

                    logger?.error(msg);
                    reject(new Error(capturedStderr.join()));
                } else {
                    resolve({
                        stdout: capturedStdout.join(),
                        stderr: capturedStderr.join()
                    });
                }
            });
        });
    }

    /**
     * Used as a wrapper to child_process spawn function solely for unit testing purposes
     *
     * @param command the command to be forwarded to child_process spawn function
     * @param args the arguments to be forwarded to child_process spawn function
     * @param stdioOptions  the options to be forwarded to child_process spawn function
     * @returns the process that is returned as the result of a call to child_process spawn function
     */
    public static spawnWrapper(
        command: string,
        args: string[] = [],
        stdioOptions: StdioOptions = ['ignore', 'pipe', 'ignore']
    ): childProcess.ChildProcess {
        return childProcess.spawn(command, args, {
            shell: true,
            stdio: stdioOptions
        });
    }

    /**
     * Launches the desktop browser and navigates to the provided URL.
     *
     * @returns A Promise that launches the desktop browser and navigates to the provided URL.
     */
    public static async launchUrlInDesktopBrowser(url: string, logger?: Logger): Promise<void> {
        const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';

        CommonUtils.startCliAction(
            messages.getMessage('launchBrowserAction'),
            messages.getMessage('openBrowserWithUrlStatus', [url])
        );
        return CommonUtils.executeCommandAsync(`${openCmd} ${url}`, logger).then(() => {
            CommonUtils.stopCliAction();
            return Promise.resolve();
        });
    }

    /**
     * A Promise that checks whether the local dev server plugin is installed or not.
     * The Promise will resolve if the plugin is installed and will reject otherwise.
     *
     * @returns A Promise that checks whether the local dev server plugin is installed or not.
     */
    public static async isLwcServerPluginInstalled(logger?: Logger): Promise<void> {
        const command = 'sfdx force:lightning:lwc:start --help';
        return CommonUtils.executeCommandAsync(command, logger).then(() => Promise.resolve());
    }

    /**
     * Gets the port number for local dev server.
     *
     * @returns The port that local dev server is running on, or undefined if the server is not running.
     */
    public static async getLwcServerPort(logger?: Logger): Promise<string | undefined> {
        const getProcessCommand =
            process.platform === 'win32'
                ? 'wmic process where "CommandLine Like \'%force:lightning:lwc:start%\'" get CommandLine  | findstr -v "wmic"'
                : 'ps -ax | grep force:lightning:lwc:start | grep -v grep';

        return CommonUtils.executeCommandAsync(getProcessCommand, logger)
            .then((result) => {
                const output = result.stdout.trim();
                const portPattern = 'force:lightning:lwc:start -p';
                const startIndex = output.indexOf(portPattern);
                let port = CommonUtils.DEFAULT_LWC_SERVER_PORT;
                if (startIndex > 0) {
                    const endIndex = output.indexOf('\n', startIndex + portPattern.length);
                    if (endIndex > startIndex) {
                        port = output.substring(startIndex + portPattern.length, endIndex);
                    } else {
                        port = output.substr(startIndex + portPattern.length);
                    }
                }
                return Promise.resolve(port.trim());
            })
            .catch((error) => {
                logger?.warn(`Unable to determine server port: ${error}`);
                return Promise.resolve(undefined);
            });
    }

    /**
     * Given an sfdc.co shortened url it returns the actual/full url that this will redirect to.
     *
     * @param httpsUrl The sfdc.co shortened url
     * @returns The actual/full url
     */
    public static async fetchFullUrlFromSfdcShortenedUrl(httpsUrl: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            https
                .get(httpsUrl, (response) => {
                    let data = '';
                    response.on('data', (chunk) => {
                        data += chunk;
                    });
                    response.on('end', () => {
                        // sfdc.co urls will lead to an html page where, among other elements, there would be
                        // an element with id='full-url' and whose value would be the url to redirect to, eg:
                        // <h2 class="home-heading" style="word-wrap:break-word;" id="full-url">
                        //      https://developer.salesforce.com/files/sfmobiletools/SalesforceApp-Simulator-248.061-iOS.zip
                        // </h2>
                        const regex = /<[^>]*id\s*=\s*["']full-url["'][^>]*>(.*?)<\/[^>]*>/i;
                        const match = data.match(regex);
                        if (match?.[1]) {
                            resolve(match[1]);
                        } else {
                            resolve('');
                        }
                    });
                })
                .on('error)', (error) => {
                    reject(error);
                });
        });
    }

    /**
     * Downloads a resource from a given url into a destination file.
     */
    public static async downloadFile(url: string, dest: string, logger?: Logger): Promise<void> {
        const finalUrl = url.toLowerCase().startsWith('http') ? url : `http://${url}`;

        const protocol = finalUrl.toLowerCase().startsWith('https') ? https : http;

        return new Promise((resolve, reject) => {
            const destFile = fs.createWriteStream(dest);

            const request = protocol.get(finalUrl, (response) => {
                if (response.statusCode !== 200) {
                    const msg = `Error downloading ${finalUrl}: ${response.statusMessage ?? ''}`;
                    logger?.error(msg);
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
                const msg = `Error saving ${finalUrl} to file ${dest} - ${err.message}`;
                logger?.error(msg);
                fs.unlink(dest, () => reject(new Error(msg)));
            });

            request.on('error', (err) => {
                const msg = `Error downloading ${finalUrl} - ${err.message}`;
                logger?.error(msg);
                fs.unlink(dest, () => reject(new Error(msg)));
            });

            request.end();
        });
    }

    /**
     * Extracts a ZIP archive to an output directory.
     *
     * @param zipFilePath The path to the ZIP archive
     * @param outputDir An optional output directory - if omitted then defaults to the same directory as the ZIP file
     * @param logger An optional logger to be used for logging
     */
    public static async extractZIPArchive(zipFilePath: string, outputDir?: string, logger?: Logger): Promise<void> {
        let archive = path.resolve(CommonUtils.resolveUserHomePath(zipFilePath));
        let outDir = outputDir ? path.resolve(CommonUtils.resolveUserHomePath(outputDir)) : path.dirname(archive);

        archive = CommonUtils.convertToUnixPath(archive);
        outDir = CommonUtils.convertToUnixPath(outDir);

        const cmd =
            process.platform === 'win32'
                ? `powershell -Command "$ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path \\"${archive}\\" -DestinationPath \\"${outDir}\\" -Force"`
                : `unzip -o -qq ${archive} -d ${outDir}`;

        logger?.debug(`Extracting archive ${zipFilePath}`);
        await CommonUtils.executeCommandAsync(cmd, logger);
    }

    /**
     * Creates a text file at a destination location with the given content
     */
    public static async createTextFile(dest: string, content: string, logger?: Logger): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.writeFile(dest, content, (err) => {
                if (err) {
                    const msg = `Error creating file ${dest} - ${err.message}`;
                    logger?.error(msg);
                    reject(err);
                }
                resolve();
            });
        });
    }

    /**
     * Creates a text file at a destination location with the given content
     */
    public static async readTextFile(filePath: string, logger?: Logger): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    const msg = `Error reading file ${filePath} - ${err.message}`;
                    logger?.error(msg);
                    reject(err);
                }
                resolve((data ?? '').toString());
            });
        });
    }

    /**
     * Given an input path, this method enumerates all of the files that are in
     * that path. If the input path itself is path to a file then only that file
     * is returned, otherwise all the files in that path that match the filtering
     * expression will be returned.
     *
     * @param atPath An input path to start with.
     * @param filterRegEx Optional regular expression to use for further filtering the results.
     * @returns Array of file paths that are contained under the provided input path.
     */
    public static enumerateFiles(atPath: string, filterRegEx?: RegExp): string[] {
        const inputPath = path.normalize(atPath);

        const stat = fs.statSync(inputPath);

        const filterFunc = (input: string): string | undefined => {
            const trimmed = input.trim();

            return (filterRegEx && !filterRegEx.test(trimmed)) ?? trimmed.length === 0 ? undefined : trimmed;
        };

        if (stat.isFile()) {
            const result = filterFunc(inputPath);
            return result ? [result] : [];
        }

        let files: string[] = [];
        const items = fs.readdirSync(inputPath, {
            withFileTypes: true
        });
        items.forEach((item) => {
            const itemPath = path.join(inputPath, item.name);
            if (item.isDirectory()) {
                files = [...files, ...this.enumerateFiles(itemPath, filterRegEx)];
            } else {
                const result = filterFunc(itemPath);
                if (result) {
                    files.push(result);
                }
            }
        });

        return files;
    }
}
