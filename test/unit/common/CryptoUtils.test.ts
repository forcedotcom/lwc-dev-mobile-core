/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { expect } from 'chai';
import { Messages } from '@salesforce/core';
import { CryptoUtils, SSLCertificateData } from '../../../src/common/CryptoUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('CryptoUtils tests', () => {
    const testCertData: SSLCertificateData = {
        derCertificate: Buffer.from(
            'MIIDoTCCAomgAwIBAgIBATANBgkqhkiG9w0BAQsFADBgMRIwEAYDVQQDEwlsb2NhbGhvc3QxCzAJBgNVBAYTAlVTMT0wOwYDVQQKEzRTYWxlc2ZvcmNlIExvY2FsIERldmVsb3BtZW50IFNlcnZlciBTZWxmIFNpZ25lZCBDZXJ0MB4XDTI0MDgyNjE2MzIxMloXDTI2MTEyNDE3MzIxMlowYDESMBAGA1UEAxMJbG9jYWxob3N0MQswCQYDVQQGEwJVUzE9MDsGA1UEChM0U2FsZXNmb3JjZSBMb2NhbCBEZXZlbG9wbWVudCBTZXJ2ZXIgU2VsZiBTaWduZWQgQ2VydDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMJ89nZclASzv380d79bjZUgQ/4vbdDYxFyWrxJywoDdYfSAhtO0bffiIfXiMGWprm8YmcATyODYMbF3v6z5Qn8kQ6fjgbsAe5a3NZdYBN2pUWckzsalkRlWbLb5pZaIr9jlnnmbfp8BkaxSVQZygD4Eq2IOYyVpPBGRNYMe2wYCK2pkP7vRkTKumZEqD70A4NGolUeJJH0JJY1+a5T4ZCv0CHMdvtvWMJT1+t/d8j6DmrHUtr5LwMfJx1ni8ZqHew5/KtFRq5RoUCzQF7p+0IRFimp66w1ra2zRNwsIlx1x23mxzle3NB5Ln+dQiPKmyLzlAi7fjFJF46qFBTW6T7sCAwEAAaNmMGQwDAYDVR0TBAUwAwEB/zALBgNVHQ8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwMgYDVR0RBCswKYIJbG9jYWxob3N0hwR/AAABhwQKAAIChxAAAAAAAAAAAAAAAAAAAAABMA0GCSqGSIb3DQEBCwUAA4IBAQBxP0VVxno3LGaKSoNUDwsWk1eoNwEO3E7Eo24ni5w83GE5nhOzwTSpxy9R1LbL8+I3KKt53vPAtqU/wQruqle1zFBQn1azxEj4q6KAwhUa0FqSa47Mx9NALvUif0HvLGtZuq1etMnT+9ZJBFxk1Hudh+wAVMcE0hN7mrCywL5YAykcAeR16muto4AoQoxiYCafcUKIIcxJfvFhdxkWkPRPJDajcNyoUIVWnI+gh6ZdugISGIA4IASiU4u/iRICiOeeH2uCXVTPUWaIYlw+i4q08G6EECrUg8C/XZcm9gCpU96mMsn4UhzWV/r1lMLIFnGnxJiTm9DI2hGczMmMdJU+',
            'base64'
        ),
        pemCertificate:
            '-----BEGIN CERTIFICATE-----\r\nMIIDoTCCAomgAwIBAgIBATANBgkqhkiG9w0BAQsFADBgMRIwEAYDVQQDEwlsb2Nh\r\nbGhvc3QxCzAJBgNVBAYTAlVTMT0wOwYDVQQKEzRTYWxlc2ZvcmNlIExvY2FsIERl\r\ndmVsb3BtZW50IFNlcnZlciBTZWxmIFNpZ25lZCBDZXJ0MB4XDTI0MDgyNjE2MzIx\r\nMloXDTI2MTEyNDE3MzIxMlowYDESMBAGA1UEAxMJbG9jYWxob3N0MQswCQYDVQQG\r\nEwJVUzE9MDsGA1UEChM0U2FsZXNmb3JjZSBMb2NhbCBEZXZlbG9wbWVudCBTZXJ2\r\nZXIgU2VsZiBTaWduZWQgQ2VydDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\r\nggEBAMJ89nZclASzv380d79bjZUgQ/4vbdDYxFyWrxJywoDdYfSAhtO0bffiIfXi\r\nMGWprm8YmcATyODYMbF3v6z5Qn8kQ6fjgbsAe5a3NZdYBN2pUWckzsalkRlWbLb5\r\npZaIr9jlnnmbfp8BkaxSVQZygD4Eq2IOYyVpPBGRNYMe2wYCK2pkP7vRkTKumZEq\r\nD70A4NGolUeJJH0JJY1+a5T4ZCv0CHMdvtvWMJT1+t/d8j6DmrHUtr5LwMfJx1ni\r\n8ZqHew5/KtFRq5RoUCzQF7p+0IRFimp66w1ra2zRNwsIlx1x23mxzle3NB5Ln+dQ\r\niPKmyLzlAi7fjFJF46qFBTW6T7sCAwEAAaNmMGQwDAYDVR0TBAUwAwEB/zALBgNV\r\nHQ8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwMgYDVR0RBCswKYIJbG9jYWxo\r\nb3N0hwR/AAABhwQKAAIChxAAAAAAAAAAAAAAAAAAAAABMA0GCSqGSIb3DQEBCwUA\r\nA4IBAQBxP0VVxno3LGaKSoNUDwsWk1eoNwEO3E7Eo24ni5w83GE5nhOzwTSpxy9R\r\n1LbL8+I3KKt53vPAtqU/wQruqle1zFBQn1azxEj4q6KAwhUa0FqSa47Mx9NALvUi\r\nf0HvLGtZuq1etMnT+9ZJBFxk1Hudh+wAVMcE0hN7mrCywL5YAykcAeR16muto4Ao\r\nQoxiYCafcUKIIcxJfvFhdxkWkPRPJDajcNyoUIVWnI+gh6ZdugISGIA4IASiU4u/\r\niRICiOeeH2uCXVTPUWaIYlw+i4q08G6EECrUg8C/XZcm9gCpU96mMsn4UhzWV/r1\r\nlMLIFnGnxJiTm9DI2hGczMmMdJU+\r\n-----END CERTIFICATE-----\r\n',
        pemPrivateKey:
            '-----BEGIN RSA PRIVATE KEY-----\r\nMIIEpAIBAAKCAQEAwnz2dlyUBLO/fzR3v1uNlSBD/i9t0NjEXJavEnLCgN1h9ICG\r\n07Rt9+Ih9eIwZamubxiZwBPI4NgxsXe/rPlCfyRDp+OBuwB7lrc1l1gE3alRZyTO\r\nxqWRGVZstvmlloiv2OWeeZt+nwGRrFJVBnKAPgSrYg5jJWk8EZE1gx7bBgIramQ/\r\nu9GRMq6ZkSoPvQDg0aiVR4kkfQkljX5rlPhkK/QIcx2+29YwlPX6393yPoOasdS2\r\nvkvAx8nHWeLxmod7Dn8q0VGrlGhQLNAXun7QhEWKanrrDWtrbNE3CwiXHXHbebHO\r\nV7c0Hkuf51CI8qbIvOUCLt+MUkXjqoUFNbpPuwIDAQABAoIBAExptpf4dbuHN+Tt\r\no2LOwMjnnW9ACUB1+mh6V5zC9AKXeIYM/WwuRsqO0VL/JI685SkHHFloLJOSvauB\r\nZhC6+lJj2CUdcPodDXHA19B3p6nDfZUt1AQeRu0SlLIrUdDcMWLhjKsw2cX1Ytu2\r\nmWtoD1TOltt21aN8PjqUt9alh95KyjWPruWsN/qFfSKOkSundV77+AL30QjVVES/\r\nuCuCTfL41f/jARGiC3KesnRwHIBD5l3dd7Qo4GAjaZkhUrEUQ6tUDtqqIUmjVleT\r\n/yKPcZbYvdx4ylPbkAXbWBPCro3tE3KFpDsxpawRujjGdcfqTErgQLtqKP3gdIQD\r\nDAaeYdECgYEA7lzSHuzg5R5xjYVhWpftU7fLoGHotwMM852l0RfhciYOWr6BQ4aQ\r\nsxU/i9vM5Y+KO/TUloZlrJEgAZ8IrdC1df+lq4qGDMUu/POrW5Pji2gTAPbLsp/t\r\n4OtyAFvgFCuSyC5AZIav+2k4xgQ1kwv3DDK8NYkGYv4Tt6ZeFSedn2MCgYEA0OEN\r\nDt6Erydcy7M48nIhsEqyC+JCDARqcT9kq0dT6nvxOL0zg160lTRKSEo4/NoURvL3\r\n0Yo+YTIAnpop5KNdWfAkHG9CkYn9mlcTbbY3AxJU3rk0DKBLuOGZIxtrqFTE+8aO\r\nOmTooYKaeAgaaIAXwkthGwjxTo1HfnEaM5NSmckCgYEAldUrD91/EQcuAfPR2oyd\r\n1n42Nb7V9hSo04pJbUJBqOtbIpeV0ciItMmqhFPKXJL6Je4ko+ofh3ZCVEKPxhLn\r\nviDRFx+gW+6nNsJE+O/hnQPyzixUpxf5A+V8Z9VY6dTqE4NfXtF7VeIymeaTdreS\r\nt8w8mrpjlV55LnwZr9qTLlkCgYAX1XYd+jn9mmo2PA8Fawx5Byzluj17DY3vuiIM\r\ngSkMGnRd2wjjtoy4ca0ALqfuAhxKNDMez71qbcAwWLrrAdEHECWusOtRnAM59zGa\r\nVS5VxWO1vkA4KJo7UFKe9OQF4xZO/EsCUr1QoIxrodERl3weiWddJFoUcn5z6Qfq\r\nVqcYMQKBgQDHpawXcMvw5mtdeWeLknqpHQjTXtEPkA1vdR79femb7lxlNsBt6fkT\r\nxp9xXe6RqlbYcpQ8oCuU7VpnrjLKvCZhNHKEKUwVXCIlhuKkfmxJT78H0dc7Uw8U\r\n3QhOPAqL/fVXWSEOy9hl9Z/+9VxgMqYJGceGFbZX5cnsNRQlfo0FSQ==\r\n-----END RSA PRIVATE KEY-----\r\n',
        pemPublicKey:
            '-----BEGIN PUBLIC KEY-----\r\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwnz2dlyUBLO/fzR3v1uN\r\nlSBD/i9t0NjEXJavEnLCgN1h9ICG07Rt9+Ih9eIwZamubxiZwBPI4NgxsXe/rPlC\r\nfyRDp+OBuwB7lrc1l1gE3alRZyTOxqWRGVZstvmlloiv2OWeeZt+nwGRrFJVBnKA\r\nPgSrYg5jJWk8EZE1gx7bBgIramQ/u9GRMq6ZkSoPvQDg0aiVR4kkfQkljX5rlPhk\r\nK/QIcx2+29YwlPX6393yPoOasdS2vkvAx8nHWeLxmod7Dn8q0VGrlGhQLNAXun7Q\r\nhEWKanrrDWtrbNE3CwiXHXHbebHOV7c0Hkuf51CI8qbIvOUCLt+MUkXjqoUFNbpP\r\nuwIDAQAB\r\n-----END PUBLIC KEY-----\r\n'
    };

    const expectedSubjectHash = '2889162b';

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

    it('getSubjectHashOld succeeds to generate subject hash', async () => {
        const hash = CryptoUtils.getSubjectHashOld(testCertData);
        expect(hash).to.be.equal(expectedSubjectHash);
    });

    it('generateIdentityToken succeeds to generate tokens with correct size', async () => {
        let token = CryptoUtils.generateIdentityToken();
        let b64string = Buffer.from(token, 'base64');
        let byteSize = b64string.byteLength;
        expect(byteSize).to.equal(32);

        token = CryptoUtils.generateIdentityToken(64);
        b64string = Buffer.from(token, 'base64');
        byteSize = b64string.byteLength;
        expect(byteSize).to.equal(64);
    });
});
