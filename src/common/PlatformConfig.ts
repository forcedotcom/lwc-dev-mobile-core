/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

/*
 * TODO: Find a proper/permanent solution
 *
 * There seems to be a problem with accessing the IOS/Android config values from outside modules.
 * If module A has a dependency on our module, and if there is a module B that also has a dependency
 * on our module *and* a dependency on module A, then if module B calls into module A and A calls into
 * IOSConfig/AndroidConfig then module A gets garbled values.
 *
 * An example would be if module B called into Device Create command in module A at which point the
 * Device Create command would try to access ios/android config values and would fail b/c it gets back
 * garbled values.
 *
 * This only happens if the field in these config classes are defined as Static, or an instance
 * of these classes are cached. So for now as a workaround, we have the PlatformConfig class where
 * it instantiates a new instance of the config classes everytime they need to be accessed and this
 * ensures that both module A and B will always get the correct/non-garbled values. This is not an
 * ideal solution and is temporary until we can root cause the issue and find a better solution.
 *
 * NOTE: The same issue would occur if these classes were defined as JSON files and where imported
 * (i.e import iOSConfig from { IOSConfig.json } or similar for Android)
 */
export class PlatformConfig {
    public static iOSConfig(): IOSConfig {
        return new IOSConfig();
    }

    public static androidConfig(): AndroidConfig {
        return new AndroidConfig();
    }
}

// tslint:disable-next-line: max-classes-per-file
export class IOSConfig {
    public readonly minSupportedRuntime: string = '13';
    public readonly defaultSimulatorName: string = 'SFDXSimulator';
}

// tslint:disable-next-line: max-classes-per-file
export class AndroidConfig {
    public readonly minSupportedRuntime: string = '23';
    public readonly supportedImages: string[] = [
        'google_apis',
        'default',
        'google_apis_playstore'
    ];
    public readonly supportedArchitectures: string[] = ['x86_64', 'x86'];
    public readonly supportedDeviceTypes: string[] = [
        'pixel',
        'pixel_xl',
        'pixel_c'
    ];
    public readonly defaultEmulatorName: string = 'SFDXEmulator';
    public readonly defaultAdbPort: number = 5572;
    public readonly deviceBootReadinessWaitTime: number = 10000;
    public readonly deviceBootStatusPollRetries: number = 10;
}
