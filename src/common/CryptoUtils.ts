/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import forge from 'node-forge';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'crypto-utils');

export type PEMCertificate = {
    derCertificate: string;
    pemCertificate: string;
    pemPrivateKey: string;
    pemPublicKey: string;
};

export class CryptoUtils {
    /**
     * Generates a self-signed certificated using the provided parameters.
     *
     * @param {string} hostname the hostname to use. Defaults to LOCALHOST.
     * @param {number} keySize the size for the private key in bits, which must
     * be between 2048 and 16384. Defaults to 4096.
     * @param {number | Date} validity the validity length for the certificate.
     * It can either be a number (representing the number of days from today) or
     * it can be a specific date (which has to be at least 24 hours from now).
     * Defaults to 365 days. The maximum length cannot be more than 825 days in the
     * future to meet Apple guidelines: https://support.apple.com/en-gb/103769
     * @returns the generated certificate and key.
     */
    public static generateSelfSignedCert(
        hostname: string = 'localhost',
        keySize: number = 4096,
        validity: number | Date = 365
    ): PEMCertificate {
        if (keySize < 2048 || keySize > 16_384) {
            throw new Error(messages.getMessage('error:invalidKeySize'));
        }

        if (validity instanceof Date) {
            const millisecondsInOneDay = 24 * 60 * 60 * 1000;
            const diff = validity.getTime() - new Date().getTime();
            if (diff < millisecondsInOneDay || diff > 825 * millisecondsInOneDay) {
                throw new Error(messages.getMessage('error:invalidValidityDate'));
            }
        } else if (validity < 1 || validity > 825) {
            throw new Error(messages.getMessage('error:invalidValidityNumber'));
        }

        const keys = forge.pki.rsa.generateKeyPair(keySize);
        const cert = forge.pki.createCertificate();

        const startDate = new Date();
        let endDate = new Date();
        if (validity instanceof Date) {
            endDate = validity;
        } else {
            endDate.setDate(startDate.getDate() + validity);
        }

        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = startDate;
        cert.validity.notAfter = endDate;

        const attrs = [
            { name: 'commonName', value: hostname },
            { name: 'countryName', value: 'US' },
            { shortName: 'ST', value: 'California' },
            { name: 'localityName', value: 'San Francisco' },
            { name: 'organizationName', value: 'Salesforce Inc.' },
            { shortName: 'OU', value: 'LocalDevPreview' }
        ];

        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        // Add the subjectAltName and ExtendedKeyUsage extensions, which are required by Apple
        cert.setExtensions([
            {
                name: 'basicConstraints',
                cA: true
            },
            {
                name: 'keyUsage',
                keyCertSign: true,
                digitalSignature: true,
                nonRepudiation: true,
                keyEncipherment: true,
                dataEncipherment: true
            },
            {
                name: 'extKeyUsage',
                serverAuth: true,
                clientAuth: true,
                codeSigning: true,
                emailProtection: true,
                timeStamping: true
            },
            {
                name: 'nsCertType',
                client: true,
                server: true,
                email: true,
                objsign: true,
                sslCA: true,
                emailCA: true,
                objCA: true
            },
            {
                name: 'subjectAltName',
                altNames: [
                    {
                        type: 2, // DNS
                        value: hostname
                    },
                    {
                        type: 7, // IP
                        value: '127.0.0.1'
                    },
                    {
                        type: 7, // IP
                        value: '10.0.2.2'
                    },
                    {
                        type: 7, // IP (IPv6 loopback)
                        value: '::1'
                    }
                ]
            },
            {
                name: 'subjectKeyIdentifier'
            }
        ]);

        cert.sign(keys.privateKey, forge.md.sha256.create());

        const pemCert = forge.pki.certificateToPem(cert);
        const privateKey = forge.pki.privateKeyToPem(keys.privateKey);
        const publicKey = forge.pki.publicKeyToPem(keys.publicKey);

        const derCert = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

        return {
            derCertificate: derCert,
            pemCertificate: pemCert,
            pemPrivateKey: privateKey,
            pemPublicKey: publicKey
        };
    }
}
