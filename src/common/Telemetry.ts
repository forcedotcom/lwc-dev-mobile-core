/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { Lifecycle } from '@salesforce/core';

export type TelemetryEmitter = {
    emitTelemetry(eventName: string, data: Record<string, unknown>): void;
};

export class SfCliTelemetryEmitter implements TelemetryEmitter {
    // eslint-disable-next-line class-methods-use-this
    public emitTelemetry(eventName: string, data: Record<string, unknown>): void {
        void Lifecycle.getInstance().emitTelemetry({
            ...data,
            eventName
        });
    }
}
