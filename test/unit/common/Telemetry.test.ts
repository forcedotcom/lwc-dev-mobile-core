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
import { SfCliTelemetryEmitter } from '../../../src/common/Telemetry.js';

describe('SfCliTelemetryEmitter', () => {
    const $$ = new TestContext();

    afterEach(() => {
        $$.restore();
    });

    it('Should call Lifecycle.emitTelemetry with eventName and data', () => {
        const emitTelemetryStub = stubMethod($$.SANDBOX, Lifecycle.getInstance(), 'emitTelemetry');

        const emitter = new SfCliTelemetryEmitter();
        emitter.emitTelemetry('test-event', { commandName: 'test:command' });

        expect(emitTelemetryStub.calledOnce).to.be.true;
        const payload = emitTelemetryStub.firstCall.args[0];
        expect(payload).to.deep.equal({
            commandName: 'test:command',
            eventName: 'test-event'
        });
    });

    it('Should spread all data fields into the telemetry payload', () => {
        const emitTelemetryStub = stubMethod($$.SANDBOX, Lifecycle.getInstance(), 'emitTelemetry');

        const emitter = new SfCliTelemetryEmitter();
        emitter.emitTelemetry('test-event', { field1: 'value1', field2: 42 });

        expect(emitTelemetryStub.calledOnce).to.be.true;
        const payload = emitTelemetryStub.firstCall.args[0];
        expect(payload).to.have.property('field1', 'value1');
        expect(payload).to.have.property('field2', 42);
        expect(payload).to.have.property('eventName', 'test-event');
    });
});
