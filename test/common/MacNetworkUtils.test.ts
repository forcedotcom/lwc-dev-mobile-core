/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { CommonUtils } from '../../src/common/CommonUtils.js';
import { MacNetworkUtils } from '../../src/common/MacNetworkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('Preview utils tests', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');
    const $$ = new TestContext();

    afterEach(() => {
        $$.restore();
    });

    it('getNetworkHardwarePorts succeeds with two enabled ports with IP address', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: `
            Hardware Port: USB 10/100/1000 LAN
            Device: en5
            Ethernet Address: 00:24:9b:4a:ce:67

            Hardware Port: Wi-Fi
            Device: en0
            Ethernet Address: f0:18:98:50:06:dd

            Hardware Port: Bluetooth PAN
            Device: en7
            Ethernet Address: f0:18:98:4d:a8:a9
            `,
            stderr: ''
        });

        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandSync').callsFake((cmd: string) => {
            if (cmd.includes('en5')) {
                return '192.168.0.211';
            } else if (cmd.includes('en0')) {
                return '192.168.0.123';
            } else if (cmd.includes('en7')) {
                return '';
            } else {
                throw new Error(`Unexpected input: ${cmd}`);
            }
        });

        const hardwarePorts = await MacNetworkUtils.getNetworkHardwarePorts();
        expect(hardwarePorts.length).to.be.equal(2);
        expect(hardwarePorts[0].address).to.be.equal('192.168.0.211');
        expect(hardwarePorts[0].device).to.be.equal('en5');
        expect(hardwarePorts[0].name).to.be.equal('USB 10/100/1000 LAN');
        expect(hardwarePorts[1].address).to.be.equal('192.168.0.123');
        expect(hardwarePorts[1].device).to.be.equal('en0');
        expect(hardwarePorts[1].name).to.be.equal('Wi-Fi');
    });

    it('getNetworkHardwarePorts fails with error', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').rejects(new Error());
        return MacNetworkUtils.getNetworkHardwarePorts().catch((error) =>
            expect(error)
                .to.be.an('error')
                .with.property('message')
                .that.includes(messages.getMessage('error:network:hardware:port', ['']))
        );
    });

    it('getProxySetting returns existing proxy setting', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: `
            <dictionary> {
                ProxyAutoConfigEnable : 1
                ProxyAutoConfigURLString : http://myCore.internal.salesforce.com:6109/qa/proxy.jsp
            }`,
            stderr: ''
        });
        const proxySetting = await MacNetworkUtils.getProxySetting();
        expect(proxySetting.proxyAutoConfigEnable).to.be.equal(1);
        expect(proxySetting.proxyAutoConfigURLString).to.be.equal(
            'http://myCore.internal.salesforce.com:6109/qa/proxy.jsp'
        );
    });

    it('getProxySetting returns empty object when there is no existing proxy setting', async () => {
        stubMethod($$.SANDBOX, CommonUtils, 'executeCommandAsync').resolves({
            stdout: `
            <dictionary> {
            }`,
            stderr: ''
        });
        const proxySetting = await MacNetworkUtils.getProxySetting();
        expect(proxySetting.proxyAutoConfigEnable).to.be.undefined;
        expect(proxySetting.proxyAutoConfigURLString).to.be.undefined;
    });
});
