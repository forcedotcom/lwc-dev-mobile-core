/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { CommonUtils } from '../../../src/common/CommonUtils.js';
import { IOSLauncher } from '../../../src/common/IOSLauncher.js';
import { IOSUtils } from '../../../src/common/IOSUtils.js';
import { PreviewUtils } from '../../../src/common/PreviewUtils.js';
import { IOSMockData } from './IOSMockData.js';

describe('IOS Launcher tests', () => {
    const $$ = new TestContext();
    let myCommandRouterBlock: (command: string) => Promise<{ stdout: string; stderr: string }>;

    beforeEach(() => {
        myCommandRouterBlock = (command: string): Promise<{ stdout: string; stderr: string }> => {
            let output = '';
            if (command.endsWith('simctl list --json devicetypes')) {
                output = JSON.stringify(IOSMockData.mockRuntimeDeviceTypes);
            } else if (command.endsWith('simctl list --json devices available')) {
                output = JSON.stringify(IOSMockData.mockRuntimeDevices);
            } else {
                output = JSON.stringify(IOSMockData.mockRuntimes);
            }
            return new Promise((resolve) => {
                resolve({
                    stderr: '',
                    stdout: output
                });
            });
        };
    });

    afterEach(() => {
        $$.restore();
    });

    it('Should attempt to invoke preview in mobile browser', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, IOSUtils, 'launchSimulatorApp').resolves();
        stubMethod($$.SANDBOX, IOSUtils, 'bootDevice').resolves();
        const launchUrlMock = stubMethod($$.SANDBOX, IOSUtils, 'launchURLInBootedSimulator').resolves();

        const launcher = new IOSLauncher('iPhone 11 Pro');
        await launcher.launchPreview('helloWorld', '~', undefined, 'browser', undefined, '3333');

        expect(
            launchUrlMock.calledWith(
                'F2B4097F-F33E-4D8A-8FFF-CE49F8D6C178',
                'http://localhost:3333/lwc/preview/c/helloWorld'
            )
        ).to.be.true;
    });

    it('Should attempt to invoke preview in native app', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').callsFake(myCommandRouterBlock);
        stubMethod($$.SANDBOX, IOSUtils, 'launchSimulatorApp').resolves();
        stubMethod($$.SANDBOX, IOSUtils, 'bootDevice').resolves();

        const launchAppMock = stubMethod($$.SANDBOX, IOSUtils, 'launchAppInBootedSimulator').resolves();

        const launcher = new IOSLauncher('iPhone 11 Pro');
        await launcher.launchPreview('helloWorld', '~', undefined, 'com.salesforce.test', undefined, '3333');

        expect(
            launchAppMock.calledWith('F2B4097F-F33E-4D8A-8FFF-CE49F8D6C178', undefined, 'com.salesforce.test', [
                {
                    name: PreviewUtils.COMPONENT_NAME_ARG_PREFIX,
                    value: 'helloWorld'
                },
                {
                    name: PreviewUtils.PROJECT_DIR_ARG_PREFIX,
                    value: '~'
                }
            ])
        ).to.be.true;
    });
});
