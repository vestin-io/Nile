# Core Remove Bun

## Goal

Make `packages/core` a Node-compatible TypeScript package so standard Electron can load it without Bun runtime support.

## Todo

### Core Runtime

- [x] Replace `bun:sqlite` usage in `packages/core/src/services/database/SqliteDatabase.ts`
- [x] Keep one internal SQLite adapter boundary for core stores and registries
- [x] Replace `Bun.hash` in `packages/core/src/services/history/SecureSnapshotStore.ts`
- [x] Replace `Bun.spawnSync` in `packages/core/src/services/credential/SecurityCli.ts`
- [x] Verify `@nile/core` loads under Node-compatible runtime and desktop build path

### Core Tests

- [x] Migrate `packages/core/**/*.test.ts` off `bun:test`
- [x] Run core tests under a Node-compatible runner

### Surfaces After Core

- [x] Move CLI entry/runtime off Bun
- [x] Move desktop build/dev scripts off Bun
- [x] Remove Bun-first desktop scripts and tests
- [x] Replace Bun-first install path with npm install
- [x] Remove Bun-first docs and repo guidance

## Result

- `packages/core` no longer depends on Bun runtime APIs.
- CLI now runs through Node + `tsx`.
- Desktop build/dev scripts and tests now run without Bun.
- Root install flow is `npm install`, which also installs `core`, `cli`, and `desktop` dependencies through `postinstall`.
