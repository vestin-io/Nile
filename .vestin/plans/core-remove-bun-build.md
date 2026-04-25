# Core Remove Bun Build Log

## 2026-04-29

### Step 1: Replace Bun Runtime Usage In Core

- Replaced `bun:sqlite` in `packages/core/src/services/database/SqliteDatabase.ts` with a Node-compatible `node:sqlite` wrapper while keeping the existing `query/get/all/run/transaction` shape used by core stores.
- Replaced `Bun.spawnSync` in `packages/core/src/services/credential/SecurityCli.ts` with `node:child_process.spawnSync`.
- Replaced `Bun.hash` in `packages/core/src/services/history/SecureSnapshotStore.ts` with `node:crypto.createHash("sha256")`.
- Kept the rest of core registry and history code unchanged so the migration stays focused on infrastructure, not domain behavior.

### Verification

- `bun run typecheck`

### Current Known Gap

- `packages/core` tests still use `bun:test`, so `bun test ./packages/core` is no longer a valid verification path after moving runtime code to `node:sqlite`.
- Surface and tooling layers still contain Bun-first scripts and build steps; those remain for later migration phases.

### Step 2: Move Core Tests Off Bun

- Replaced all `packages/core/**/*.test.ts` imports from `bun:test` to `vitest`.
- Added root `vitest.config.ts` scoped to `packages/core/src/**/*.test.ts`.
- Added a root `test:core` script so core can be verified under a Node-compatible runner without touching CLI or desktop tests yet.
- Installed `vitest` as a root dev dependency for the new core test path.

### Verification

- `bun run typecheck`
- `bun run test:core`

### Current Known Gap

- Root, CLI, and desktop scripts are still Bun-first.
- `packages/core` now runs under Node-compatible runtime and tests, but Electron/desktop build tooling still depends on Bun.

### Step 3: Move CLI Off Bun

- Replaced CLI test imports from `bun:test` with `vitest`.
- Extended `vitest.config.ts` to cover `apps/cli/src/**/*.test.ts`.
- Added a root `test:cli` script for CLI verification under the same Node-compatible runner.
- Switched CLI entry scripts from Bun to Node + `tsx`:
  - root `nile`
  - `apps/cli` `start`
  - `apps/cli/src/main.ts` shebang

### Verification

- `bun run typecheck`
- `bun run test:cli`
- `node --import tsx ./apps/cli/src/main.ts --help`

### Current Known Gap

- Desktop build/dev/runtime still depends on Bun.
- Root `test`, `desktop:*`, and docs still assume Bun-first workflows.

### Step 4: Replace Bun Install Path

- Switched workspace-local package links from `workspace:*` to `file:` so npm can resolve the repo without Bun-specific workspace protocol handling.
- Added `packageManager: npm@10.9.4` to the root package and converted root workflow scripts to npm-friendly entrypoints where already supported.
- Added a root `start` script that launches the CLI directly from the repository root through Node + `tsx`.
- Removed `bun.lock` and reinstalled dependencies with `npm install`, producing a standard `package-lock.json`.

### Verification

- `npm install`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm start -- --help`
- `npm run nile -- --help`

### Current Known Gap

- Desktop build/dev scripts still use Bun APIs internally.
- Docs and repo guidance still mention Bun-first install and test commands.

### Step 5: Move Desktop Tooling And Repo Workflow Off Bun

- Replaced `Bun.build` in `apps/desktop/build.ts` with `esbuild`.
- Replaced `Bun.spawn` and `import.meta.dir` usage in `apps/desktop/dev.ts` with Node-compatible `child_process.spawn` and `fileURLToPath(...)`.
- Replaced `import.meta.dir` usage in `apps/desktop/generate-icons.ts`.
- Switched Electron `main` and `preload` build outputs to `.cjs` so Node-side desktop bundles can load CommonJS dependencies such as `pino` without ESM dynamic-require failures.
- Removed top-level `await` from `apps/desktop/src/electron/main.ts` so the Electron main entry can compile to CommonJS cleanly.
- Migrated desktop tests from `bun:test` to `vitest`.
- Removed npm workspace coupling from the root package and switched root desktop scripts to `--prefix` execution.
- Added explicit `version` fields to root and package manifests.
- Restored `@nile/core` app dependencies to local `file:` links and moved install orchestration to a root `postinstall` script:
  - `packages/core`
  - `apps/cli`
  - `apps/desktop`
- Regenerated root and package-local npm lockfiles from scratch after removing stale Bun-installed symlinked `node_modules`.
- Updated repo guidance and commands so the supported workflow is now:
  - `npm install`
  - `npm run typecheck`
  - `npm run test`
  - `npm start -- --help`
  - `npm run desktop:build`

### Verification

- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm start -- --help`
- `npm run desktop:build`
- `rg -n "bun:|\\bBun\\.|from \\\"bun:test\\\"|from 'bun:test'|bun run|bun test|#!/usr/bin/env bun|bun-types" . -g '!node_modules' -g '!research' -g '!apps/desktop/dist'`

### Remaining Note

- `node:sqlite` still emits Node experimental warnings during tests and CLI startup. This is a Node runtime warning, not a Bun dependency.
