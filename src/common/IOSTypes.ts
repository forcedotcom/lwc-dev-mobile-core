/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

export class IOSSimulatorDevice {
    /**
     * Attempts to parse the output of `simctl list --json devices available` command.
     *
     * @param jsonString The JSON string blob that is the output of `simctl list --json devices available` command.
     * @param supportedRuntimes String array including the runtimes that are supported.
     * @returns An array of IOSSimulatorDevice objects containing information about each simulator.
     */
    public static parseJSONString(
        jsonString: string,
        supportedRuntimes: string[]
    ): IOSSimulatorDevice[] {
        const DEVICES_KEY = 'devices';
        const NAME_KEY = 'name';
        const UDID_KEY = 'udid';
        const STATE_KEY = 'state';
        const IS_AVAILABLE_KEY = 'isAvailable';
        const runtimeMatchRegex = new RegExp(
            // eslint-disable-next-line no-useless-escape
            `\.SimRuntime\.(${supportedRuntimes.join('|')})`
        );

        const simDevices: IOSSimulatorDevice[] = [];

        const devicesJSON: any = JSON.parse(jsonString);
        const runtimeDevices: any[] = devicesJSON[DEVICES_KEY] || [];
        let runtimes: any[] = Object.keys(runtimeDevices).filter((key) => {
            return key && key.match(runtimeMatchRegex);
        });
        runtimes = runtimes.sort().reverse();

        for (const runtimeIdentifier of runtimes) {
            const devices = runtimeDevices[runtimeIdentifier];
            for (const device of devices) {
                const sim = new IOSSimulatorDevice(
                    device[NAME_KEY],
                    device[UDID_KEY],
                    device[STATE_KEY],
                    runtimeIdentifier,
                    device[IS_AVAILABLE_KEY]
                );

                simDevices.push(sim);
            }
        }

        // sort by name in ascending order and then by ios version (runtimeid) in descending order
        // if someone starts a device by name (eg. iPhone 11), rather than udid, then the newer
        // version of iOS will be chosen as it will be first on the list.
        return simDevices.sort((a, b) =>
            a.name == b.name
                ? a.runtimeId > b.runtimeId
                    ? -1
                    : 1
                : a.name < b.name
                ? -1
                : 1
        );
    }

    public name: string;
    public udid: string;
    public state: string;
    public runtimeId: string;
    public isAvailable: boolean;

    constructor(
        name: string,
        udid: string,
        state: string,
        runtimeId: string,
        isAvailable: boolean
    ) {
        const runtime: string = runtimeId
            .replace('com.apple.CoreSimulator.SimRuntime.', '') // com.apple.CoreSimulator.SimRuntime.iOS-13-3-2 --> iOS-13-3-2
            .replace('-', ' ') // iOS-13-3-2 --> iOS 13-3-2
            .replace(/-/gi, '.'); // iOS 13-3-2 --> iOS 13.3.2

        this.name = name;
        this.udid = udid;
        this.state = state;
        this.runtimeId = runtime;
        this.isAvailable = isAvailable;
    }

    /**
     * A string representation of an IOSSimulatorDevice which includes Name, Runtime Id, and udid
     */
    public toString(): string {
        return `${this.name}, ${this.runtimeId}, ${this.udid}`;
    }
}
