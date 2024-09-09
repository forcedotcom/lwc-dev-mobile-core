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
import { AndroidLauncher } from '../../../src/common/AndroidLauncher.js';
import { AndroidUtils } from '../../../src/common/AndroidUtils.js';
import { PreviewUtils } from '../../../src/common/PreviewUtils.js';
import { AndroidMockData } from './AndroidMockData.js';

describe('Android Launcher tests', () => {
    const $$ = new TestContext();

    afterEach(() => {
        $$.restore();
    });

    it('Should attempt to invoke preview in mobile browser', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: AndroidMockData.mockRawPackagesString
        });
        stubMethod($$.SANDBOX, AndroidUtils, 'hasEmulator').resolves(true);
        stubMethod($$.SANDBOX, AndroidUtils, 'startEmulator').resolves(5572);

        const launchUrlMock = stubMethod($$.SANDBOX, AndroidUtils, 'launchURLIntent').resolves();

        const launcher = new AndroidLauncher('Pixel XL');
        await launcher.launchPreview('helloWorld', '~', undefined, 'browser', undefined, '3333');

        expect(launchUrlMock.calledWith('http://10.0.2.2:3333/lwc/preview/c/helloWorld', 5572)).to.be.true;
    });

    it('Should attempt to invoke preview in native app', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stderr: '',
            stdout: AndroidMockData.mockRawPackagesString
        });
        stubMethod($$.SANDBOX, AndroidUtils, 'hasEmulator').resolves(true);
        stubMethod($$.SANDBOX, AndroidUtils, 'startEmulator').resolves(5572);

        const launchAppMock = stubMethod($$.SANDBOX, AndroidUtils, 'launchAppInBootedEmulator').resolves();

        const launcher = new AndroidLauncher('Pixel XL');
        await launcher.launchPreview('helloWorld', '~', undefined, 'com.salesforce.test', undefined, '3333');

        expect(
            launchAppMock.calledWith(
                5572,
                'com.salesforce.test',
                undefined,
                [
                    {
                        name: PreviewUtils.COMPONENT_NAME_ARG_PREFIX,
                        value: 'helloWorld'
                    },
                    {
                        name: PreviewUtils.PROJECT_DIR_ARG_PREFIX,
                        value: '~'
                    }
                ],
                undefined
            )
        ).to.be.true;
    });
});
