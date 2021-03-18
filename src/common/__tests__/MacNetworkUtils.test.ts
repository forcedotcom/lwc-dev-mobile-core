/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
// tslint:disable: no-unused-expression
import { CommonUtils } from '../CommonUtils';
import { MacNetworkUtils } from '../MacNetworkUtils';

describe('Preview utils tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('getNetworkHardwarePorts succeeds with two enabled ports with IP address', async () => {
        const executeCommandAsyncMock = jest.fn((cmd) => {
            return Promise.resolve({
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
        });

        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            executeCommandAsyncMock
        );

        const executeCommandSyncMock = jest.fn((cmd) => {
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

        jest.spyOn(CommonUtils, 'executeCommandSync').mockImplementation(
            executeCommandSyncMock
        );

        const hardwarePorts = await MacNetworkUtils.getNetworkHardwarePorts();
        expect(hardwarePorts.length).toBe(2);
        expect(hardwarePorts[0].address).toBe('192.168.0.211');
        expect(hardwarePorts[0].device).toBe('en5');
        expect(hardwarePorts[0].name).toBe('USB 10/100/1000 LAN');
        expect(hardwarePorts[1].address).toBe('192.168.0.123');
        expect(hardwarePorts[1].device).toBe('en0');
        expect(hardwarePorts[1].name).toBe('Wi-Fi');
    });

    test('getNetworkHardwarePorts fails with error', async () => {
        const executeCommandAsyncMock = jest.fn((cmd) => {
            throw new Error();
        });

        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            executeCommandAsyncMock
        );

        const aPromise = MacNetworkUtils.getNetworkHardwarePorts().catch(
            () => undefined
        );
        expect(aPromise).rejects;
    });

    test('getProxySetting returns existing proxy setting', async () => {
        const executeCommandMock = jest.fn((cmd) => {
            return Promise.resolve({
                stdout: `
                <dictionary> {
                    ProxyAutoConfigEnable : 1
                    ProxyAutoConfigURLString : http://myCore.internal.salesforce.com:6109/qa/proxy.jsp
                }`,
                stderr: ''
            });
        });

        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            executeCommandMock
        );

        const proxySetting = await MacNetworkUtils.getProxySetting();
        expect(proxySetting.proxyAutoConfigEnable).toBe(1);
        expect(proxySetting.proxyAutoConfigURLString).toBe(
            'http://myCore.internal.salesforce.com:6109/qa/proxy.jsp'
        );
    });

    test('getProxySetting returns empty object when there is no existing proxy setting', async () => {
        const executeCommandMock = jest.fn((cmd) => {
            return Promise.resolve({
                stdout: `
                <dictionary> {
                }`,
                stderr: ''
            });
        });

        jest.spyOn(CommonUtils, 'executeCommandAsync').mockImplementation(
            executeCommandMock
        );

        const proxySetting = await MacNetworkUtils.getProxySetting();
        expect(proxySetting.proxyAutoConfigEnable).toBe(undefined);
        expect(proxySetting.proxyAutoConfigURLString).toBe(undefined);
    });
});
