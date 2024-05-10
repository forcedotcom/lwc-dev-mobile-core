/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { Messages } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { CommonUtils } from '../../src/common/CommonUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('CommonUtils', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');
    const $$ = new TestContext();

    afterEach(() => {
        $$.restore();
    });

    it('replaceTokens function', async () => {
        const template = 'A quick brown ${animal1} jumped over the lazy ${animal2}';

        const formatted = CommonUtils.replaceTokens(template, {
            animal1: 'fox',
            animal2: 'dog'
        });
        expect(formatted).to.be.equal('A quick brown fox jumped over the lazy dog');

        const notFormatted = CommonUtils.replaceTokens(template, {});
        expect(notFormatted).to.be.equal('A quick brown ${animal1} jumped over the lazy ${animal2}');
    });

    it('createTempDirectory function', async () => {
        const tmpDir = os.tmpdir();
        const folderPrefix = 'lwc-mobile-';
        const tempFolderPath = path.join(tmpDir, folderPrefix);

        const folder = await CommonUtils.createTempDirectory();
        expect(fs.existsSync(folder)).to.be.true;
        expect(folder.includes(tempFolderPath)).to.be.true;

        stubMethod($$.SANDBOX, fs, 'mkdtemp').callsFake((_, callback) => callback(new Error(''), ''));

        return CommonUtils.createTempDirectory().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property('message')
                .that.includes(messages.getMessage('error:tempfolder:create', [tempFolderPath, '']))
        );
    });

    it('Resolves the server port when it is running with multiple processes', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: `
            86659 ttys002    0:00.01 bash /usr/local/bin/sfdx force:lightning:lwc:start -p 3456
            86670 ttys002    0:00.00 bash /Users/test/.local/share/sfdx/client/bin/sfdx force:lightning:lwc:start -p 3456
            86675 ttys002    0:00.01 bash /Users/test/.local/share/sfdx/client/bin/../7.91.0-6a6ed69ebe/bin/sfdx force:lightning:lwc:start -p 3456
            86681 ttys002    0:05.81 /Users/test/.local/share/sfdx/client/7.91.0-6a6ed69ebe/bin/node /Users/test/.local/share/sfdx/client/7.91.0-6a6ed69ebe/bin/sfdx.js force:lightning:lwc:start -p 3456
            `,
            stderr: ''
        });

        const port = await CommonUtils.getLwcServerPort();
        expect(port).to.be.equal('3456');
    });

    it('Resolves the server port when it is running with a single process', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: '86659 ttys002    0:00.01 bash /usr/local/bin/sfdx force:lightning:lwc:start -p 3456',
            stderr: ''
        });

        const port = await CommonUtils.getLwcServerPort();
        expect(port).to.be.equal('3456');
    });

    it('Cannot resolve the server port when it not running', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects('');
        const port = await CommonUtils.getLwcServerPort();
        expect(port).to.be.undefined;
    });

    it('Opens a URL in desktop browser', async () => {
        let launchCommand = '';
        const url = 'http://my.domain.com';
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake((cmd) => {
            launchCommand = cmd;
            return Promise.resolve({ stdout: '', stderr: '' });
        });
        await CommonUtils.launchUrlInDesktopBrowser(url);
        expect(launchCommand.endsWith(url)).to.be.true;
    });

    it('Promise resolves before timeout', async () => {
        const innerPromise = CommonUtils.delay(50); // a quick task that finishes in 50 milliseconds
        const promiseWithTimeout = CommonUtils.promiseWithTimeout(1000, innerPromise, 'timed out');

        try {
            await promiseWithTimeout;
        } catch (error: any) {
            throw new Error(`Should have resolved b/c innerPromise should finish before timeout: ${error}`);
        }
    });

    it('Promise rejects after timeout', async () => {
        const innerPromise = CommonUtils.delay(1000);
        const promiseWithTimeout = CommonUtils.promiseWithTimeout(50, innerPromise, 'timed out');

        try {
            await promiseWithTimeout;
        } catch (error) {
            expect(error).to.be.an('error').with.property('message', 'timed out');
        }
    });

    it('downloadFile function', async () => {
        const dest = path.join(os.tmpdir(), 'ca.crt');

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile('badurl', dest);
        } catch (error) {
            expect(error).to.be.an('error');
            expect(fs.existsSync(dest)).to.be.false;
        }

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile('http://badurl', dest);
        } catch (error) {
            expect(error).to.be.an('error');
            expect(fs.existsSync(dest)).to.be.false;
        }

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile('https://badurl', dest);
        } catch (error) {
            expect(error).to.be.an('error');
            expect(fs.existsSync(dest)).to.be.false;
        }

        // should fail and not create a destination file
        try {
            await CommonUtils.downloadFile('https://www.google.com/badurl', dest);
        } catch (error) {
            expect(error).to.be.an('error');
            expect(fs.existsSync(dest)).to.be.false;
        }

        // For now don't run this part on Windows b/c our CI
        // environment does not give file write permission.
        if (process.platform !== 'win32') {
            // should pass and create a destination file
            await CommonUtils.downloadFile('https://www.google.com', dest);
            expect(fs.existsSync(dest)).to.be.true;
        }
    }).timeout(20000); // increase timeout for this test

    it('read/write text file functions', async () => {
        const dest = path.join(os.tmpdir(), 'test_file.txt');
        const testContent = 'This is a test.';

        // For now don't run this part on Windows b/c our CI
        // environment does not give file write permission.
        if (process.platform !== 'win32') {
            // should pass and create a destination file
            await CommonUtils.createTextFile(dest, testContent);
            expect(fs.existsSync(dest)).to.be.true;

            const content = await CommonUtils.readTextFile(dest);
            expect(content).to.be.equal(testContent);
        }
    }).timeout(10000); // increase timeout for this test

    it('enumerateFiles - file as input ', async () => {
        stubMethod($$.SANDBOX, fs, 'statSync').returns(createStats(true));

        expect(CommonUtils.enumerateFiles('/path/to/my/file.js')).to.deep.equal([
            path.normalize('/path/to/my/file.js')
        ]);

        expect(CommonUtils.enumerateFiles('/path/to/my/file.js', new RegExp('^.*\\.((j|J)(s|S))$'))).to.deep.equal([
            path.normalize('/path/to/my/file.js')
        ]);

        expect(CommonUtils.enumerateFiles('/path/to/my/file.txt', new RegExp('^.*\\.((j|J)(s|S))$'))).to.deep.equal([]);
    });

    it('enumerateFiles - directory as input ', async () => {
        const rootFolder = '/path/to/my/root';
        const rootFolderFile1 = 'file_1.js';
        const rootFolderFile2 = 'file_2.txt';
        const rootSubFolder = 'subfolder';
        const rootSubFolderFile1 = 'file_1.ts';
        const rootSubFolderFile2 = 'file_2.js';

        stubMethod($$.SANDBOX, fs, 'statSync').callsFake((atPath) =>
            createStats(
                !(
                    atPath.toString() === path.normalize(rootFolder) ||
                    atPath.toString() === path.normalize(`${rootFolder}/${rootSubFolder}`)
                )
            )
        );

        stubMethod($$.SANDBOX, fs, 'readdirSync').callsFake((atPath) => {
            if (atPath.toString() === path.normalize(rootFolder)) {
                return [
                    createDirent(rootFolderFile1, true),
                    createDirent(rootFolderFile2, true),
                    createDirent(rootSubFolder, false)
                ];
            } else if (atPath.toString() === path.normalize(`${rootFolder}/${rootSubFolder}`)) {
                return [createDirent(rootSubFolderFile1, true), createDirent(rootSubFolderFile2, true)];
            } else {
                return [];
            }
        });

        const results = CommonUtils.enumerateFiles(rootFolder, new RegExp('^.*\\.((j|J)(s|S))$'));

        expect(results).to.deep.equal([
            path.normalize('/path/to/my/root/file_1.js'),
            path.normalize('/path/to/my/root/subfolder/file_2.js')
        ]);
    });

    // Disabling this test for now. It runs & passes locally but it fails
    // in CI b/c the child process errors out with `read ENOTCONN` error.
    /* it('spawnCommandAsync', async () => {
        const fakeProcess = new ChildProcess();
        fakeProcess.stdout = process.stdout;
        fakeProcess.stderr = process.stderr;

        const mockSpawn = jest.fn((): ChildProcess => fakeProcess);
        jest.spyOn(cp, 'spawn').mockImplementation(mockSpawn);

        setTimeout(() => {
            fakeProcess.stdout?.push('Test STDOUT');
            fakeProcess.stderr?.push('Test STDERR');
            fakeProcess.emit('close', 0);
            fakeProcess.kill(0);
        }, 2000);

        const results = await CommonUtils.spawnCommandAsync(
            'cmd',
            ['arg1', 'arg2'],
            ['ignore', 'inherit', 'pipe']
        );

        expect(mockSpawn).toHaveBeenCalledWith('cmd', ['arg1', 'arg2'], {
            shell: true,
            stdio: ['ignore', 'inherit', 'pipe']
        });

        expect(results.stdout).toBe('Test STDOUT');
        expect(results.stderr).toBe('Test STDERR');
    });*/

    function createStats(isFile: boolean): fs.Stats {
        return {
            isFile() {
                return isFile;
            }
        } as fs.Stats;
    }

    function createDirent(fname: string, isFile: boolean): fs.Dirent {
        return {
            isFile() {
                return isFile;
            },
            isDirectory() {
                return !isFile;
            },
            isBlockDevice() {
                return false;
            },
            isCharacterDevice() {
                return false;
            },
            isSymbolicLink() {
                return false;
            },
            isFIFO() {
                return false;
            },
            isSocket() {
                return false;
            },
            name: fname,
            path: fname,
            parentPath: fname
        };
    }
});
