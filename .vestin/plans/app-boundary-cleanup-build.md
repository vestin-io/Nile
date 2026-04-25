# App Boundary Cleanup Build Log

## 2026-05-03

### Step 1: Move Shared Credential Request Mapping Out Of Apps

- Added `LocalCredentialRequestBuilder` under `packages/core/src/application/local/`.
- Replaced duplicated auth-mode to credential-request mapping in:
  - `apps/cli/src/commands/CredentialResolver.ts`
  - `apps/desktop/src/electron/DesktopConnectionManager.ts`
- Kept surface-specific input gathering in apps, but moved the shared request-shape construction into core.

### Step 2: Move Post-Create Cursor Auto-Bind Policy Into Core Runtime

- Added best-effort local side-effect entrypoints on `NileSession`:
  - `createConnectionWithLocalEffects`
  - `createLocalConnectionWithLocalEffects`
  - `importCurrentConnectionWithLocalEffects`
- Moved the "if this is a Cursor session connection, try auto-bind usage" rule out of:
  - CLI connection commands
  - desktop main-process IPC handlers
- Left startup-wide background auto-bind in desktop main, since that is an app lifecycle concern rather than a per-command business rule.

### Step 3: Move Enabled-Agent Reconciliation Out Of Renderer Hooks

- Added `EnabledAgentsPolicy` under `packages/core/src/models/connection/`.
- Replaced renderer-local enabled-agent reconciliation in:
  - `apps/desktop/src/renderer/useAddConnectionForm.ts`
  - `apps/desktop/src/renderer/useConnectionEditState.ts`
- Renderer still decides when to trigger a probe, but the rule that reconciles current selection against configurable/default agents now lives in core.

### Step 4: Move Login-Shell Environment Hydration Into `host-local`

- Added `ShellEnvironment` under `packages/host-local/src/`.
- Removed desktop-owned `DesktopEnvironmentSource`.
- Desktop main now builds `EnvironmentSource` from `host-local` shell environment reading instead of owning the shell execution logic directly.

### Step 5: Verification

- Verified with:
  - `npm run test:core`
  - `npm run test:cli`
  - `npm run test:desktop`
  - `npx vitest run packages/host-local/src`
  - `npm run typecheck`

### Step 6: Restore Renderer-Safe Core Import Path

- Desktop renderer initially imported `EnabledAgentsPolicy` from the `@nile/core/models/connection` barrel.
- That barrel also exports Node-only connection modules, which caused the browser esbuild bundle to pull in `AgentHomes` and `SqliteDatabase` and fail on `node:*` imports.
- Added an explicit package subpath export for `EnabledAgentsPolicy` and switched renderer hooks to import that renderer-safe entry directly.

### Step 7: Replace Desktop Dev Recursive Watchers

- After the renderer import fix, `desktop:dev` advanced to startup but crashed on `EMFILE` from recursive `FS.watch`.
- Replaced the desktop dev server's recursive watchers with a small polling snapshot over:
  - `apps/desktop/src`
  - `apps/desktop/build/icons`
  - `assets/icons/nile-mark.svg`
- This keeps rebuild behavior without depending on per-file watcher limits on macOS.
