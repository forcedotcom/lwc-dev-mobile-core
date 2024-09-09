/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
export class AppleMockData {
    public static mockRuntimes = {
        runtimes: [
            {
                bundlePath:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_21F79/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.5.simruntime',
                platform: 'iOS',
                runtimeRoot:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_21F79/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.5.simruntime/Contents/Resources/RuntimeRoot',
                identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-17-5',
                version: '17.5',
                isInternal: false,
                isAvailable: true,
                name: 'iOS 17.5'
            },
            {
                bundlePath:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_21A328/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.0.simruntime',
                platform: 'iOS',
                runtimeRoot:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_21A328/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 17.0.simruntime/Contents/Resources/RuntimeRoot',
                identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
                version: '17.0',
                isInternal: false,
                isAvailable: true,
                name: 'iOS 17.0'
            },
            {
                bundlePath:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_20A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.0.simruntime',
                platform: 'iOS',
                runtimeRoot:
                    '/Library/Developer/CoreSimulator/Volumes/iOS_20A360/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 16.0.simruntime/Contents/Resources/RuntimeRoot',
                identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-16-0',
                version: '16.0',
                isInternal: false,
                isAvailable: true,
                name: 'iOS 16.0'
            },
            {
                bundlePath:
                    '/Library/Developer/CoreSimulator/Volumes/watchOS_21T575/Library/Developer/CoreSimulator/Profiles/Runtimes/watchOS 10.5.simruntime',
                platform: 'watchOS',
                runtimeRoot:
                    '/Library/Developer/CoreSimulator/Volumes/watchOS_21T575/Library/Developer/CoreSimulator/Profiles/Runtimes/watchOS 10.5.simruntime/Contents/Resources/RuntimeRoot',
                identifier: 'com.apple.CoreSimulator.SimRuntime.watchOS-10-5',
                version: '10.5',
                isInternal: false,
                isAvailable: true,
                name: 'watchOS 10.5'
            },
            {
                bundlePath:
                    '/Library/Developer/CoreSimulator/Volumes/tvOS_21L569/Library/Developer/CoreSimulator/Profiles/Runtimes/tvOS 17.5.simruntime',
                platform: 'tvOS',
                runtimeRoot:
                    '/Library/Developer/CoreSimulator/Volumes/tvOS_21L569/Library/Developer/CoreSimulator/Profiles/Runtimes/tvOS 17.5.simruntime/Contents/Resources/RuntimeRoot',
                identifier: 'com.apple.CoreSimulator.SimRuntime.tvOS-17-5',
                version: '17.5',
                isInternal: false,
                isAvailable: true,
                name: 'tvOS 17.5'
            },
            {
                bundlePath:
                    '/Library/Developer/CoreSimulator/Volumes/xrOS_21O5565d/Library/Developer/CoreSimulator/Profiles/Runtimes/xrOS 1.2.simruntime',
                platform: 'xrOS',
                runtimeRoot:
                    '/Library/Developer/CoreSimulator/Volumes/xrOS_21O5565d/Library/Developer/CoreSimulator/Profiles/Runtimes/xrOS 1.2.simruntime/Contents/Resources/RuntimeRoot',
                identifier: 'com.apple.CoreSimulator.SimRuntime.xrOS-1-2',
                version: '1.2',
                isInternal: false,
                isAvailable: true,
                name: 'visionOS 1.2'
            }
        ]
    };

    public static mockRuntimeDevices = {
        devices: {
            'com.apple.CoreSimulator.SimRuntime.iOS-17-5': [
                {
                    lastBootedAt: '2024-07-08T22:57:06Z',
                    logPath: '~/Library/Logs/CoreSimulator/9826FDA1-7800-423C-9EC3-822FBF543C3B',
                    udid: '9826FDA1-7800-423C-9EC3-822FBF543C3B',
                    isAvailable: true,
                    deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
                    state: 'Shutdown',
                    name: 'iPhone 15 Pro'
                },
                {
                    lastBootedAt: '2024-07-18T23:15:38Z',
                    dataPath: '~/Library/Developer/CoreSimulator/Devices/5D6ED992-29C3-43CC-8F94-3F8003B8494F/data',
                    logPath: '~/Library/Logs/CoreSimulator/5D6ED992-29C3-43CC-8F94-3F8003B8494F',
                    udid: '5D6ED992-29C3-43CC-8F94-3F8003B8494F',
                    isAvailable: true,
                    deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M4-8GB',
                    state: 'Shutdown',
                    name: 'iPad Pro 13-inch (M4)'
                }
            ],
            'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
                {
                    lastBootedAt: '2024-07-18T23:40:29Z',
                    dataPath: '~/Library/Developer/CoreSimulator/Devices/5346B959-091E-41F9-8E74-D18F9421FE6A/data',
                    logPath: '~/Library/Logs/CoreSimulator/5346B959-091E-41F9-8E74-D18F9421FE6A',
                    udid: '5346B959-091E-41F9-8E74-D18F9421FE6A',
                    isAvailable: true,
                    deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-11',
                    state: 'Shutdown',
                    name: 'iPhone 11'
                }
            ],
            'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [
                {
                    lastBootedAt: '2024-07-18T23:50:23Z',
                    dataPath: '~/Library/Developer/CoreSimulator/Devices/7E223FDB-1F81-4145-9DAA-68A6F8F5C90E/data',
                    logPath: '~/Library/Logs/CoreSimulator/7E223FDB-1F81-4145-9DAA-68A6F8F5C90E',
                    udid: '7E223FDB-1F81-4145-9DAA-68A6F8F5C90E',
                    isAvailable: true,
                    deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-XR',
                    state: 'Shutdown',
                    name: 'iPhone Xʀ'
                }
            ],
            'com.apple.CoreSimulator.SimRuntime.watchOS-10-5': [
                {
                    dataPath: '~/Library/Developer/CoreSimulator/Devices/EA6908D7-636C-43F6-B66E-636B692AA249/data',
                    logPath: '~/Library/Logs/CoreSimulator/EA6908D7-636C-43F6-B66E-636B692AA249',
                    udid: 'EA6908D7-636C-43F6-B66E-636B692AA249',
                    isAvailable: true,
                    deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-9-45mm',
                    state: 'Shutdown',
                    name: 'Apple Watch Series 9 (45mm)'
                }
            ],
            'com.apple.CoreSimulator.SimRuntime.tvOS-17-5': [
                {
                    dataPath: '~/Library/Developer/CoreSimulator/Devices/72DEDEF9-B1F8-4723-91D4-5DD80B0ADA11/data',
                    logPath: '~/Library/Logs/CoreSimulator/72DEDEF9-B1F8-4723-91D4-5DD80B0ADA11',
                    udid: '72DEDEF9-B1F8-4723-91D4-5DD80B0ADA11',
                    isAvailable: true,
                    deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.Apple-TV-4K-3rd-generation-4K',
                    state: 'Shutdown',
                    name: 'Apple TV 4K (3rd generation)'
                }
            ],
            'com.apple.CoreSimulator.SimRuntime.xrOS-1-2': [
                {
                    dataPath: '~/Library/Developer/CoreSimulator/Devices/1B9B24B0-7A1B-4998-BCF3-646501D75AC6/data',
                    logPath: '~/Library/Logs/CoreSimulator/1B9B24B0-7A1B-4998-BCF3-646501D75AC6',
                    udid: '1B9B24B0-7A1B-4998-BCF3-646501D75AC6',
                    isAvailable: true,
                    deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.Apple-Vision-Pro',
                    state: 'Shutdown',
                    name: 'Apple Vision Pro'
                }
            ]
        }
    };
}
