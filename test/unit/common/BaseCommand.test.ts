/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Lifecycle } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { Setup } from '../../../src/cli/commands/force/lightning/local/setup.js';
import { RequirementProcessor } from '../../../src/common/Requirements.js';

describe('BaseCommand Telemetry', () => {
    const $$ = new TestContext();

    afterEach(() => {
        $$.restore();
    });

    it('Should emit telemetry with command name during init', async () => {
        stubMethod($$.SANDBOX, RequirementProcessor, 'execute').resolves(Promise.resolve());
        const emitTelemetryStub = stubMethod($$.SANDBOX, Lifecycle.getInstance(), 'emitTelemetry');

        await Setup.run(['-p', 'ios']);

        expect(emitTelemetryStub.calledOnce).to.be.true;
        const payload = emitTelemetryStub.firstCall.args[0];
        expect(payload).to.have.property('eventName', 'lwc-dev-mobile-core');
        expect(payload).to.have.property('commandName');
    });
});
