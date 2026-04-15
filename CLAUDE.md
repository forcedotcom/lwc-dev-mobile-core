# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@salesforce/lwc-dev-mobile-core` is a Salesforce Node.js library providing core functionality for Mobile Extensions tooling (SF CLI plugins, VS Code extensions). It enables LWC local development and preview on iOS and Android platforms.

This is a **library package** consumed by other Salesforce CLI plugins — not a standalone application.

## Build & Development Commands

```bash
yarn build              # Full build (compile + test:compile via wireit)
yarn compile            # TypeScript compilation only (incremental)
yarn test               # Unit tests with coverage enforcement (c8 + mocha)
yarn test:only          # Unit tests via wireit (nyc + mocha)
yarn lint               # ESLint with caching
yarn format             # Prettier auto-format
yarn format:check       # Prettier check without writing
yarn clean              # Clean build artifacts
yarn clean-all          # Clean everything including node_modules artifacts
```

**Run a single test file:**

```bash
npx mocha --require ts-node/register --node-option loader=ts-node/esm 'test/unit/path/to/file.test.ts'
```

**Run tests matching a pattern:**

```bash
npx mocha --require ts-node/register --node-option loader=ts-node/esm --grep "pattern" 'test/unit/**/*.test.ts'
```

## Code Architecture

### Module Structure

-   **`src/cli/commands/`** — Oclif CLI commands (the `force lightning local setup` command)
-   **`src/common/`** — Core library (the bulk of the codebase, re-exported from `src/index.ts`)
-   **`src/common/device/`** — Device abstraction layer (Android emulators, iOS simulators)
-   **`test/unit/`** — Unit tests mirror the src/ structure
-   **`messages/`** — Localized message strings in Markdown format

### Key Abstractions

**BaseCommand** (`BaseCommand.ts`): Abstract class extending `SfCommand` with a requirements management system and JSON/API output formatting using Zod schema validation. All CLI commands extend this.

**Requirement System** (`Requirements.ts`): Composable requirement checks executed concurrently via Listr2. Each requirement defines a check function and is measured with the Performance API. Used by `AndroidEnvironmentRequirements.ts` and `IOSEnvironmentRequirements.ts` to validate SDK/toolchain setup.

**Device Abstraction** (`device/`): `BaseDevice` defines a platform-agnostic interface covering mobile, watch, TV, VR, and automotive form factors. `AndroidDevice`/`AppleDevice` implement it, and `AndroidDeviceManager`/`AppleDeviceManager` handle enumeration and management.

**PlatformConfig** (`PlatformConfig.ts`): Factory that creates fresh config instances per call (intentional — avoids multi-module caching issues). Defines minimum runtimes, supported images, and architecture detection (arm64-v8a on Apple Silicon).

**Preview System** (`PreviewUtils.ts`, `PreviewConfigFile.ts`, `AndroidLauncher.ts`): Orchestrates LWC preview on devices — emulator creation, app installation, component launching. Uses Ajv for JSON Schema validation of preview config files.

### Platform Utilities

-   **`AndroidUtils.ts`**: Android SDK interactions (ADB, AVD manager, SDK package management). Uses static caches for SDK package queries.
-   **`IOSUtils.ts`**: iOS simulator operations via `xcrun simctl` (boot, install, URL opening).
-   **`CommonUtils.ts`**: General utilities (HTTP requests, child process execution with logging, file operations, platform detection).
-   **`CryptoUtils.ts`**: Self-signed SSL certificate generation using node-forge (Apple-compliant 825-day max validity).
-   **`CommandLineUtils.ts`**: CLI argument/flag parsing helpers.
-   **`MacNetworkUtils.ts`**: macOS-specific network interface utilities.
-   **`Common.ts`**: Shared data structures (`CaseInsensitiveStringMap`) and enums.
-   **`AndroidTypes.ts`**: TypeScript type definitions for Android SDK structures.
-   **`PerformanceMarkers.ts`**: Performance marker constants used with the Performance API in requirements checks.

## Technical Conventions

-   **Message loading pattern**: Each module uses `Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)` + `Messages.loadMessages('@salesforce/lwc-dev-mobile-core', '<bundle>')` to load strings from `messages/` directory.
-   **Node built-in imports** use `node:` prefix (e.g., `import fs from 'node:fs'`).
-   **ESM modules** (`"type": "module"` in package.json). Imports use `.js` extensions even for TypeScript files.
-   **TypeScript strict mode** with experimental decorators enabled. Base config: `@salesforce/dev-config/tsconfig-strict-esm`.
-   **Prettier**: 120 char width, 4-space indent, single quotes, no trailing commas (semicolons enabled — the default).
-   **ESLint**: `eslint-config-salesforce-typescript` + `plugin:sf-plugin/recommended`.
-   **Conventional commits** enforced via commitlint (`@commitlint/config-conventional`).
-   **Coverage thresholds**: lines 75%, statements 80%, functions 75%, branches 75%.
-   **Testing stack**: Mocha (spec reporter) + Chai assertions + ts-sinon for mocking. Tests located at `test/unit/**/*.test.ts`.
-   **Mocha timeout**: 5000ms default (configured in `.mocharc.json`).
-   **Node.js >=22** required (Volta pins 22.21.1 / Yarn 1.22.22).
-   **Wireit** orchestrates build tasks with file-based caching and incremental compilation.

## CI

Tests run on Ubuntu + Windows across Node 22 and 24. Lint runs on Node 22 (Ubuntu only). Coverage uploaded to Codecov from Ubuntu runs.
