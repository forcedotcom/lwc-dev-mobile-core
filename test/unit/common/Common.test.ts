/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Messages } from '@salesforce/core';
import { expect } from 'chai';
import * as common from '../../../src/common/Common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('Commons utils tests', () => {
    const messages = Messages.loadMessages('@salesforce/lwc-dev-mobile-core', 'common');

    it('Filtering of maps returns maps', async () => {
        const mascotMapping = new Map();
        mascotMapping.set('Edddie', 'Iron Maiden');
        mascotMapping.set('Rattlehead', 'Megadeth');
        mascotMapping.set('Henry', 'Sabbath');

        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (key, value) => key.indexOf('Rattle') > -1
        );
        expect(filteredByMascots.size).to.be.equal(1);
    });

    it('Filtering of maps returns empty maps', async () => {
        const mascotMapping = new Map();
        mascotMapping.set('Edddie', 'Iron Maiden');
        mascotMapping.set('Rattlehead', 'Megadeth');
        mascotMapping.set('Henry', 'Sabbath');

        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (key, value) => key.indexOf('Murray') > -1
        );
        expect(filteredByMascots.size).to.be.equal(0);
    });

    it('Filtering of maps retrun empty maps and not null, when no match is found', async () => {
        const mascotMapping = new Map();
        mascotMapping.set('Edddie', 'Iron Maiden');
        mascotMapping.set('Rattlehead', 'Megadeth');
        mascotMapping.set('Henry', 'Sabbath');

        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (key, value) => key.indexOf('Murray') > -1
        );
        expect(filteredByMascots !== undefined && filteredByMascots != null).to.be.true;
    });

    it('Filtering of empty maps returns empty maps, when no match is found', async () => {
        const mascotMapping = new Map<string, string>();
        const filteredByMascots = common.MapUtils.filter(
            mascotMapping,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (key, value) => key.includes('Murray')
        );
        expect(filteredByMascots !== undefined && filteredByMascots != null).to.be.true;
    });

    it('Filtering of sets returns sets', async () => {
        const mascotSets = new Set<string>();
        mascotSets.add('Edddie');
        mascotSets.add('Rattlehead');
        mascotSets.add('Henry');

        const filteredByMascots = common.SetUtils.filter(mascotSets, (value) => value.includes('Rattle'));
        expect(filteredByMascots.size).to.be.equal(1);
    });

    it('Filtering of sets returns empty sets when no match is found', async () => {
        const mascotSets = new Set<string>();
        mascotSets.add('Edddie');
        mascotSets.add('Rattlehead');
        mascotSets.add('Henry');

        const filteredByMascots = common.SetUtils.filter(mascotSets, (value) => value.includes('Murray'));
        expect(filteredByMascots.size === 0);
    });

    it('Filtering of sets returns empty set and not null, when no match is found', async () => {
        const mascotSets = new Set<string>();
        mascotSets.add('Edddie');
        mascotSets.add('Rattlehead');
        mascotSets.add('Henry');

        const filteredByMascots = common.SetUtils.filter(mascotSets, (value) => value.includes('Murray'));
        expect(filteredByMascots !== undefined && filteredByMascots !== null).to.be.true;
    });

    it('Valid Version formats return expected object values', async () => {
        // Major only.
        const v1 = common.Version.from('1');
        expect(v1?.major).to.be.equal(1);
        expect(v1?.minor).to.be.equal(0);
        expect(v1?.patch).to.be.equal(0);

        // Major and minor only.
        for (const versionString of ['2.3', '2-3']) {
            const v2 = common.Version.from(versionString);
            expect(v2?.major).to.be.equal(2);
            expect(v2?.minor).to.be.equal(3);
            expect(v2?.patch).to.be.equal(0);
        }

        // Major, minor, and patch.
        for (const versionString of ['4.5.6', '4-5-6']) {
            const v3 = common.Version.from(versionString);
            expect(v3?.major).to.be.equal(4);
            expect(v3?.minor).to.be.equal(5);
            expect(v3?.patch).to.be.equal(6);
        }

        // Space-padded values.
        for (const versionString of ['  7.8.9  ', '  7-8-9  ']) {
            const v4 = common.Version.from(versionString);
            expect(v4?.major).to.be.equal(7);
            expect(v4?.minor).to.be.equal(8);
            expect(v4?.patch).to.be.equal(9);
        }

        // Multi-digit values.
        for (const versionString of ['10.111.1212', '10-111-1212']) {
            const v5 = common.Version.from(versionString);
            expect(v5?.major).to.be.equal(10);
            expect(v5?.minor).to.be.equal(111);
            expect(v5?.patch).to.be.equal(1212);
        }

        // 'Zero' releases.
        for (const versionString of ['0.1.2', '0-1-2']) {
            const v6 = common.Version.from(versionString);
            expect(v6?.major).to.be.equal(0);
            expect(v6?.minor).to.be.equal(1);
            expect(v6?.patch).to.be.equal(2);
        }
    });

    it('Invalid Version formats return null', async () => {
        const invalidVersions = [
            'some-random-string',
            '001.002.003',
            '004-005-006',
            '2-3.4',
            '2.3-4',
            '5.6.7.8',
            '9-10-11-12'
        ];
        for (const invalidVersion of invalidVersions) {
            expect(common.Version.from(invalidVersion)).to.be.null;
        }
    });

    it('compare versions', () => {
        expect(common.Version.same('1.2.3', common.Version.from('1.2.3')!)).to.be.true;

        expect(common.Version.sameOrNewer('1.2.3', common.Version.from('3.2.1')!)).to.be.false;

        expect(common.Version.same('Tiramisu', 'Tiramisu')).to.be.true;

        expect(common.Version.sameOrNewer('Tiramisu', 'Tiramisu')).to.be.true;

        expect(common.Version.sameOrNewer('Tiramisu', common.Version.from('1.2.3')!)).to.be.true;

        expect(common.Version.sameOrNewer(common.Version.from('1.2.3')!, 'Tiramisu')).to.be.false;

        expect(() => {
            common.Version.sameOrNewer('Tiramisu', 'UpsideDownCake');
        })
            .to.throw(Error)
            .with.property('message', messages.getMessage('error:version:codename:comparing'));
    });
});
