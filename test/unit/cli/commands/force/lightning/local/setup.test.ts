/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Logger, Messages } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { Setup } from '../../../../../../../src/cli/commands/force/lightning/local/setup.js';
import { RequirementCheckResultType, RequirementProcessor } from '../../../../../../../src/common/Requirements.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('Setup Tests', () => {
    const $$ = new TestContext();
    let executeSetupMock: sinon.SinonStub<any[], any>;

    beforeEach(() => {
        executeSetupMock = stubMethod($$.SANDBOX, RequirementProcessor, 'execute');
    });

    afterEach(() => {
        $$.restore();
    });

    it('Checks that Setup is initialized correctly for iOS', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'ios']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Checks that Setup is initialized correctly for Android', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'android']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Checks that Setup fails for invalid Platform flag', async () => {
        executeSetupMock.resolves(Promise.resolve());
        try {
            await Setup.run(['-p', 'someplatform']);
        } catch (error) {
            expect(error).to.be.an('error').with.property('message').that.includes('--platform=someplatform');
        }
    });

    it('Checks that Setup will validate API Level flag for iOS platform', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'ios', '-l', '1.2.3']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Checks that Setup will validate API Level flag for Android platform', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'android', '-l', '33']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Should execute successfully with apiLevel for iOS platform', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'ios', '-l', '16.0']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Should execute successfully with apiLevel for Android platform', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'android', '-l', '33']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Should execute successfully without apiLevel for iOS', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'ios']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Should execute successfully without apiLevel for Android', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'android']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Should validate valid API Level format', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'ios', '-l', '16.4.1']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Should validate semantic version format for API Level', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'ios', '-l', '17.0']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Should validate single digit API Level', async () => {
        executeSetupMock.resolves(Promise.resolve());
        await Setup.run(['-p', 'android', '-l', '34']);
        expect(executeSetupMock.calledOnce).to.be.true;
    });

    it('Logger must be initialized and invoked', async () => {
        executeSetupMock.resolves(Promise.resolve());
        const loggerMock = stubMethod($$.SANDBOX, Logger.prototype, 'info');
        await Setup.run(['-p', 'ios']);
        expect(loggerMock.calledOnce).to.be.true;
    });

    it('Messages folder should be loaded', async () => {
        expect(!Setup.summary).to.be.false;
    });

    describe('JSON Flag Tests', () => {
        const sampleCheckResult: RequirementCheckResultType = {
            hasMetAllRequirements: true,
            totalDuration: '1 sec',
            tests: [
                {
                    title: 'test1',
                    hasPassed: true,
                    duration: '1 sec',
                    message: 'test1'
                }
            ]
        };

        it('Should pass jsonFlag=false to RequirementProcessor when --json is not provided', async () => {
            executeSetupMock.resolves(Promise.resolve());
            await Setup.run(['-p', 'android']);
            expect(executeSetupMock.calledOnce).to.be.true;
            const callArgs = executeSetupMock.firstCall.args;
            expect(callArgs).to.have.lengthOf(2);
            expect(callArgs[1]).to.equal(false);
        });

        it('Should pass jsonFlag=true to RequirementProcessor when --json is provided', async () => {
            executeSetupMock.resolves(Promise.resolve(sampleCheckResult));
            await Setup.run(['-p', 'android', '--json']);
            expect(executeSetupMock.calledOnce).to.be.true;
            const callArgs = executeSetupMock.firstCall.args;
            expect(callArgs).to.have.lengthOf(2);
            expect(callArgs[1]).to.equal(true);
        });

        it('Should pass jsonFlag=true for iOS platform with --json', async () => {
            executeSetupMock.resolves(Promise.resolve(sampleCheckResult));
            await Setup.run(['-p', 'ios', '--json']);
            expect(executeSetupMock.calledOnce).to.be.true;
            const callArgs = executeSetupMock.firstCall.args;
            expect(callArgs[1]).to.equal(true);
        });

        it('Should pass jsonFlag correctly with other flags', async () => {
            await Setup.run(['-p', 'android', '-l', '33', '--json']);
            expect(executeSetupMock.calledOnce).to.be.true;
            const callArgs = executeSetupMock.firstCall.args;
            expect(callArgs[1]).to.equal(true);
        });

        it('Should handle jsonFlag with API level for iOS', async () => {
            executeSetupMock.resolves(Promise.resolve(sampleCheckResult));
            await Setup.run(['-p', 'ios', '-l', '16.0', '--json']);
            expect(executeSetupMock.calledOnce).to.be.true;
            const callArgs = executeSetupMock.firstCall.args;
            expect(callArgs[1]).to.equal(true);
        });

        it('Should print correct result JSON to process.stdout', async () => {
            executeSetupMock.resolves(Promise.resolve(sampleCheckResult));
            const stdoutSpy = stubMethod($$.SANDBOX, process.stdout, 'write');

            await Setup.run(['-p', 'android', '--json']);

            expect(stdoutSpy.calledOnce).to.be.true;
            const output = stdoutSpy.firstCall.args[0] as string;
            const parsedOutput = JSON.parse(output);

            expect(parsedOutput).to.have.property('outputSchema');
            expect(parsedOutput).to.have.property('outputContent');

            expect(parsedOutput.outputContent).to.deep.equal(sampleCheckResult);
        });

        it('Should print correct result JSON to process.stdout for outputformat=api', async () => {
            executeSetupMock.resolves(Promise.resolve(sampleCheckResult));
            const stdoutSpy = stubMethod($$.SANDBOX, process.stdout, 'write');

            await Setup.run(['-p', 'android', '-f', 'api']);

            expect(stdoutSpy.calledOnce).to.be.true;
            const output = stdoutSpy.firstCall.args[0] as string;
            const parsedOutput = JSON.parse(output);

            expect(parsedOutput).to.have.property('outputSchema');
            expect(parsedOutput).to.have.property('outputContent');

            expect(parsedOutput.outputContent).to.deep.equal(sampleCheckResult);
        });
    });
});
