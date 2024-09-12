/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import net from 'node:net';
import { Logger, Messages, SfError } from '@salesforce/core';
import { CommonUtils } from './CommonUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

export type ProxySetting = {
    proxyAutoConfigEnable?: number;
    proxyAutoConfigURLString?: string;
};

export type HardwarePort = {
    name: string;
    device: string;
    address: string;
};

export class MacNetworkUtils {
    /**
     * Obtains a list of all available network ports on the host machine.
     *
     * @returns An array of HardwarePort objects containing a list of all available network ports on the host machine.
     */
    public static async getNetworkHardwarePorts(logger?: Logger): Promise<HardwarePort[]> {
        // Hardware ports listing comes in this form
        //
        // '''
        // Hardware Port: USB 10/100/1000 LAN
        // Device: en5
        // Ethernet Address: 00:24:9b:4a:ce:67

        // Hardware Port: Wi-Fi
        // Device: en0
        // Ethernet Address: f0:18:98:50:06:dd

        // Hardware Port: Bluetooth PAN
        // Device: en7
        // Ethernet Address: f0:18:98:4d:a8:a9

        // Hardware Port: Thunderbolt 1
        // Device: en1
        // Ethernet Address: 82:b9:03:a1:cc:01
        // '''

        const cmd = 'networksetup -listallhardwareports';
        const hardwarePortPrefix = 'Hardware Port: ';
        const devicePrefix = 'Device: ';
        return CommonUtils.executeCommandAsync(cmd, logger)
            .then((result) => {
                const parsedLines = result.stdout
                    .split('\n')
                    .filter((line) => line.includes(hardwarePortPrefix) || line.includes(devicePrefix))
                    .map((line) => line.replace(hardwarePortPrefix, '').replace(devicePrefix, '').trim());

                const hardwarePorts: HardwarePort[] = [];
                for (let i = 0; i < parsedLines.length - 1; i += 2) {
                    // ifconfig output comes in this form
                    //
                    // '''
                    // en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
                    //     options=400<CHANNEL_IO>
                    //     ether f0:18:98:50:06:dd
                    //     inet6 fe80::10d5:86ce:c79:4eb8%en0 prefixlen 64 secured scopeid 0x7
                    //     inet 192.168.0.211 netmask 0xffffff00 broadcast 192.168.0.255
                    //     nd6 options=201<PERFORMNUD,DAD>
                    //     media: autoselect
                    //     status: active
                    // '''

                    const ifconfigCmd = `ifconfig ${parsedLines[i + 1]} | awk '$1 == "inet" {print $2}'`;

                    let ipAddress = CommonUtils.executeCommandSync(ifconfigCmd, undefined, logger);
                    if (ipAddress) {
                        ipAddress = ipAddress.trim();
                        if (net.isIP(ipAddress)) {
                            hardwarePorts.push({
                                name: parsedLines[i],
                                device: parsedLines[i + 1],
                                address: ipAddress
                            });
                        } else {
                            logger?.warn(`Invalid IP address ${ipAddress}`);
                        }
                    }
                }
                return Promise.resolve(hardwarePorts);
            })
            .catch((error) => Promise.reject(new SfError(messages.getMessage('error:network:hardware:port', [error]))));
    }

    /**
     * Obtains the proxy settings of the host machine.
     *
     * @returns A ProxySetting object containing the proxy settings of the host machine.
     */
    public static async getProxySetting(logger?: Logger): Promise<ProxySetting> {
        // Proxy setting comes in this form
        //
        // '''
        // <dictionary> {
        //  ProxyAutoConfigEnable : 1
        //  ProxyAutoConfigURLString : http://myCore.internal.salesforce.com:6109/qa/proxy.jsp
        // }
        // '''

        const cmd = 'scutil --proxy';
        const proxyAutoConfigEnabled = 'ProxyAutoConfigEnable';
        const proxyAutoConfigUrlString = 'ProxyAutoConfigURLString';
        return CommonUtils.executeCommandAsync(cmd, logger).then((result) => {
            const proxySettings = result.stdout
                .split('\n')
                .filter((line) => line.includes(proxyAutoConfigEnabled) || line.includes(proxyAutoConfigUrlString))
                .map((line) => {
                    const keyValuePair = line.split(' : ', 2).map((value) => value.trim());

                    if (keyValuePair[0] === proxyAutoConfigEnabled) {
                        return {
                            key: keyValuePair[0].charAt(0).toLowerCase() + keyValuePair[0].slice(1),
                            value: parseInt(keyValuePair[1], 10)
                        };
                    } else {
                        return {
                            key: keyValuePair[0].charAt(0).toLowerCase() + keyValuePair[0].slice(1),
                            value: keyValuePair[1]
                        };
                    }
                })
                .reduce(
                    (kvps, kvp) => ({
                        ...kvps,
                        [kvp.key]: kvp.value
                    }),
                    {}
                );

            return proxySettings;
        });
    }
}
