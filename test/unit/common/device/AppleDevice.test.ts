import { expect } from 'chai';
import { Version } from '../../../../src/common/Common.js';
import { AppleDevice } from '../../../../src/common/device/AppleDevice.js';
import { DeviceState, DeviceType } from '../../../../src/common/device/BaseDevice.js';

describe('AppleDevice tests', () => {
    it('toString should return the correct string', async () => {
        const mockDevice = new AppleDevice(
            '1234567890',
            'iPhone 15 Pro',
            DeviceType.mobile,
            'iOS',
            new Version(17, 0, 0),
            DeviceState.Booted
        );
        expect(mockDevice.toString()).to.be.equal('iPhone 15 Pro, iOS 17.0.0, 1234567890, Booted');
    });
});
