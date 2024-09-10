/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { randomBytes } from 'node:crypto';
import forge from 'node-forge';
import { Messages, SfError } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'crypto-utils');

export type SSLCertificateData = {
    derCertificate: Buffer;
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
    ): SSLCertificateData {
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
            { name: 'organizationName', value: 'Salesforce Local Development Server Self Signed Cert' }
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
                digitalSignature: true,
                keyEncipherment: true
            },
            {
                name: 'extKeyUsage', // Needed by iOS (see https://support.apple.com/en-gb/103769)
                serverAuth: true
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
                        ip: '127.0.0.1'
                    },
                    {
                        type: 7, // IP
                        ip: '10.0.2.2'
                    },
                    {
                        type: 7, // IP (IPv6 loopback)
                        ip: '::1'
                    }
                ]
            }
        ]);

        cert.sign(keys.privateKey, forge.md.sha256.create());

        const pemCert = forge.pki.certificateToPem(cert);
        const privateKey = forge.pki.privateKeyToPem(keys.privateKey);
        const publicKey = forge.pki.publicKeyToPem(keys.publicKey);

        const derCertString = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        const derCertBuffer = Buffer.from(derCertString, 'binary');

        return {
            derCertificate: derCertBuffer,
            pemCertificate: pemCert,
            pemPrivateKey: privateKey,
            pemPublicKey: publicKey
        };
    }

    /**
     * Converts a certificate from PEM to DER format.
     *
     * @param pemCertificate A string representing a certificate in PEM format.
     * @returns A buffer containing the data of the certificate in DER format.
     */
    public static PEMtoDER(pemCertificate: string): Buffer {
        const cert = this.getCertFromPEM(pemCertificate);
        const derCertString = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        const derCertBuffer = Buffer.from(derCertString, 'binary');
        return derCertBuffer;
    }

    /**
     * Converts a certificate from DER to PEM format.
     *
     * @param derCertificate A buffer containing the binary data of the certificate in DER format.
     * @returns A string representing a certificate in PEM format.
     */
    public static DERtoPEM(derCertificate: Buffer): string {
        const cert = this.getCertFromDER(derCertificate);
        const pemCert = forge.pki.certificateToPem(cert);
        return pemCert;
    }

    /**
     * Computes the subject hash (similar to subject_hash_old of OpenSSL). When invoking
     * this method, the caller should either provide a DER or PEM certificate (but not both).
     *
     * @param derCertificate A buffer containing the data of the certificate in DER format.
     * @param pemCertificate A string representing a certificate in PEM format.
     * @returns A string representing the subject hash.
     */
    public static getSubjectHashOld(derCertificate?: Buffer, pemCertificate?: string): string {
        if (!derCertificate && !pemCertificate) {
            throw new SfError('Must provide either a DER or PEM certificate.');
        } else if (derCertificate && pemCertificate) {
            throw new SfError('Must provide either a DER or PEM certificate, but not both.');
        }

        const cert = derCertificate ? this.getCertFromDER(derCertificate) : this.getCertFromPEM(pemCertificate!);

        return this.doGetSubjectHashOld(cert);
    }

    /**
     * Determines if a certificate is expired. When invoking this method, the caller
     * should either provide a DER or PEM certificate (but not both).
     *
     * @param derCertificate A buffer containing the binary data of the certificate in DER format.
     * @param pemCertificate A string representing a certificate in PEM format.
     * @returns A boolean indicating whether the certificate is expired or not.
     */
    public static isExpired(derCertificate?: Buffer, pemCertificate?: string): boolean {
        if (!derCertificate && !pemCertificate) {
            throw new SfError('Must provide either a DER or PEM certificate.');
        } else if (derCertificate && pemCertificate) {
            throw new SfError('Must provide either a DER or PEM certificate, but not both.');
        }

        const cert = derCertificate ? this.getCertFromDER(derCertificate) : this.getCertFromPEM(pemCertificate!);
        const now = new Date();

        return cert.validity.notAfter < now;
    }

    /**
     * Generates a cryptographically secure pseudorandom number generator(CSPRNG) token.
     *
     * @param {number} byteSize the size of the token to be generated. Default is 32(256-bit).
     * @returns the generated CSPRNG token expressed in base64.
     */
    public static generateIdentityToken(byteSize: number = 32): string {
        return randomBytes(byteSize).toString('base64');
    }

    private static getCertFromDER(derCertificate: Buffer): forge.pki.Certificate {
        const derBytes = forge.util.decode64(derCertificate.toString('binary'));
        const asn1 = forge.asn1.fromDer(derBytes);
        const cert = forge.pki.certificateFromAsn1(asn1);
        return cert;
    }

    private static getCertFromPEM(pemCertificate: string): forge.pki.Certificate {
        const cert = forge.pki.certificateFromPem(pemCertificate);
        return cert;
    }

    private static doGetSubjectHashOld(cert: forge.pki.Certificate): string {
        // Get a reference to forge.pki.distinguishedNameToAsn1 by casting to ANY
        // We do this b/c @types/node-forge doesn't expose distinguishedNameToAsn1
        // even though it is there. So we jump through this hoop to get to it.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const distinguishedNameToAsn1 = (forge.pki as any).distinguishedNameToAsn1;

        // 1. Extract the subject name in ASN.1 format
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const subjectAsn1 = distinguishedNameToAsn1(cert.subject) as forge.asn1.Asn1;

        // 2. Convert the subject to DER-encoded form
        const derSubject = forge.asn1.toDer(subjectAsn1).getBytes();

        // 3. Create an MD5 hash of the DER-encoded subject
        const md = forge.md.md5.create();
        md.update(derSubject, 'raw');
        const md5Hash = md.digest().getBytes();

        // 4. The first four bytes of the MD5 hash are the subject hash in little-endian format
        const hashBuffer = forge.util.createBuffer(md5Hash.slice(0, 4), 'raw');
        const hashArray = Array.from(hashBuffer.bytes()).reverse();

        // 5. Convert the little-endian hash to a hexadecimal string
        const subjectHash = hashArray.map((byte) => ('00' + byte.charCodeAt(0).toString(16)).slice(-2)).join('');

        return subjectHash;
    }
}
