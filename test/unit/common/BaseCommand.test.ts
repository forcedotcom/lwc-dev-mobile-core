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
import { BaseCommand } from '../../../src/common/BaseCommand.js';
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
        expect(payload).to.have.property('eventName', 'force:lightning:local:setup.executed');
        expect(payload).to.have.property('commandName');
    });
});

describe('BaseCommand CLI Version Check', () => {
    it('Should not throw when version equals minimum', () => {
        expect(() => BaseCommand.verifyCliVersion('2.126.0')).to.not.throw();
    });

    it('Should not throw when patch version is higher', () => {
        expect(() => BaseCommand.verifyCliVersion('2.126.1')).to.not.throw();
    });

    it('Should not throw when minor version is higher', () => {
        expect(() => BaseCommand.verifyCliVersion('2.127.0')).to.not.throw();
    });

    it('Should not throw when major version is higher', () => {
        expect(() => BaseCommand.verifyCliVersion('3.0.0')).to.not.throw();
    });

    it('Should throw when version is below minimum', () => {
        expect(() => BaseCommand.verifyCliVersion('2.125.0')).to.throw(
            `This command requires @salesforce/cli version ${BaseCommand.MINIMUM_SALESFORCE_CLI_VERSION_REQUIRED} or later. You are running version 2.125.0.`
        );
    });

    it('Should throw when major version is below minimum', () => {
        expect(() => BaseCommand.verifyCliVersion('1.999.999')).to.throw(
            `This command requires @salesforce/cli version ${BaseCommand.MINIMUM_SALESFORCE_CLI_VERSION_REQUIRED} or later. You are running version 1.999.999.`
        );
    });

    it('Should throw when minor version is below minimum', () => {
        expect(() => BaseCommand.verifyCliVersion('2.125.9')).to.throw(
            `This command requires @salesforce/cli version ${BaseCommand.MINIMUM_SALESFORCE_CLI_VERSION_REQUIRED} or later. You are running version 2.125.9.`
        );
    });
});
