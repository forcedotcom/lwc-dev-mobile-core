/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { expect } from 'chai';
import { Messages } from '@salesforce/core';
import { CryptoUtils } from '../../../src/common/CryptoUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('CryptoUtils tests', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'crypto-utils');

    it('generateSelfSignedCert throws on invalid key size', async () => {
        const expectedErrorMsg = messages.getMessage('error:invalidKeySize');

        try {
            CryptoUtils.generateSelfSignedCert('MyHostName', 1024);
        } catch (error) {
            expect(error).to.be.an('error').with.property('message', expectedErrorMsg);
        }

        try {
            CryptoUtils.generateSelfSignedCert('MyHostName', 20000);
        } catch (error) {
            expect(error).to.be.an('error').with.property('message', expectedErrorMsg);
        }
    });

    it('generateSelfSignedCert throws on invalid validity as number of days', async () => {
        const expectedErrorMsg = messages.getMessage('error:invalidValidityNumber');

        try {
            CryptoUtils.generateSelfSignedCert('MyHostName', 2048, 0);
        } catch (error) {
            expect(error).to.be.an('error').with.property('message', expectedErrorMsg);
        }

        try {
            CryptoUtils.generateSelfSignedCert('MyHostName', 2048, 826);
        } catch (error) {
            expect(error).to.be.an('error').with.property('message', expectedErrorMsg);
        }
    });

    it('generateSelfSignedCert throws on invalid validity as specific date', async () => {
        const expectedErrorMsg = messages.getMessage('error:invalidValidityDate');

        try {
            const expiryTooShort = new Date();
            expiryTooShort.setHours(expiryTooShort.getHours() + 8); // less than 24 hours
            CryptoUtils.generateSelfSignedCert('MyHostName', 2048, expiryTooShort);
        } catch (error) {
            expect(error).to.be.an('error').with.property('message', expectedErrorMsg);
        }

        try {
            const expiryTooLong = new Date();
            expiryTooLong.setDate(expiryTooLong.getDate() + 826); // more than 825 days in the future
            CryptoUtils.generateSelfSignedCert('MyHostName', 2048, expiryTooLong);
        } catch (error) {
            expect(error).to.be.an('error').with.property('message', expectedErrorMsg);
        }
    });

    it('generateSelfSignedCert succeeds to generate a certificate and key for localhost', async () => {
        const cert = CryptoUtils.generateSelfSignedCert();
        expect(cert.derCertificate).not.to.be.null;
        expect(cert.pemCertificate.startsWith('-----BEGIN CERTIFICATE-----')).to.be.true;
        expect(cert.pemPublicKey.startsWith('-----BEGIN PUBLIC KEY-----')).to.be.true;
        expect(cert.pemPrivateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----')).to.be.true;
    }).timeout(10000); // increase timeout for this test
});
