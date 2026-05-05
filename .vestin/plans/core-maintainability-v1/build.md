# Core Maintainability V1 Build Log

## 2026-05-05

### Step 13: Remove agent adapter pass-through field boilerplate

- Reworked the four built-in agent adapters so they no longer keep a wide set of stored constructor fields purely to reopen downstream collaborators later.
- Each adapter now resolves its concrete collaborator openers once in the constructor and keeps only those focused closures:
  - apply
  - import
  - rollback
  - detect
- Applied the cleanup across:
  - `CodexAgentAdapter`
  - `ClaudeAgentAdapter`
  - `CursorAgentAdapter`
  - `OpenClawAgentAdapter`
- This keeps the adapter classes concrete without adding another abstraction layer, while still reducing pass-through state and repeated branch logic.

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 9: Split CLI connection add/onboarding flow out of command handlers

- Moved CLI add-connection input resolution into `apps/cli/src/commands/ConnectionAddFlow.ts`.
- Kept `ConnectionCommands` focused on concrete command handlers:
  - list
  - remove
  - add/create session write
  - import
  - scan/import-detected
  - use/apply
- Moved these responsibilities out of `ConnectionCommands`:
  - preset selection
  - auth-mode selection
  - endpoint prompt
  - onboarding describe call
  - agent-selection reconciliation
  - OpenClaw add-flow validation
- Reduced the command surface sizes to:
  - `ConnectionCommands.ts` -> 131 lines
  - `ConnectionAddFlow.ts` -> 372 lines

### Verification

- `npm run test:cli`
- `npm run typecheck`

### Step 12: Split Claude gateway model cache and ranking out of the settings store

- Moved Claude gateway model cache reading and preferred-model ranking into `GatewayModelCatalog`.
- Kept `ClaudeSettingsStore` focused on:
  - snapshot/document read-write
  - env/oauth account preservation
  - api-key/session apply flows
  - model field reconciliation
- Reduced the Claude hotspot sizes to:
  - `SettingsStore.ts` -> 251 lines
  - `GatewayModelCatalog.ts` -> 102 lines

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 11: Split CLI agent-selection flow out of add/onboarding orchestration

- Split agent-selection prompting and OpenClaw validation out of `ConnectionAddFlow` into `ConnectionAgentSelectionFlow`.
- Kept `ConnectionAddFlow` focused on:
  - flag vs interactive entry selection
  - preset/auth/credential resolution
  - endpoint prompt
  - label prompt
  - onboarding describe call wiring
- Moved these responsibilities into the selection flow:
  - `--agents` parsing
  - selectable-agent prompt orchestration
  - OpenClaw model-id prompt
  - OpenClaw capability/flag validation
  - default enabled-agent reconciliation
- Reduced the CLI hotspot sizes to:
  - `ConnectionAddFlow.ts` -> 243 lines
  - `ConnectionAgentSelectionFlow.ts` -> 169 lines

### Verification

- `npm run test:cli`
- `npm run typecheck`

### Step 10: Split CLI entry routing and presenter label normalization

- Split top-level CLI dispatch out of `NileCli` into `NileCliCommandRouter`.
- Split JSON/text/cancel/error result wrapping out of `NileCli` into `NileCliResultFactory`.
- Kept `NileCli` focused on:
  - dependency composition
  - argv parsing
  - interactive default-mode entry
  - command logging and top-level error handling
- Split Azure endpoint/connection label normalization out of `ConnectionPresenter` into `EndpointLabelFormatter`.
- Reduced the CLI hotspot sizes to:
  - `NileCli.ts` -> 147 lines
  - `NileCliCommandRouter.ts` -> 219 lines
  - `ConnectionPresenter.ts` -> 352 lines

### Verification

- `npm run test:cli`
- `npm run typecheck`

### Step 12: Replace implicit access credential compensation with explicit sync state

- Reworked `models/access` away from hidden in-memory rollback assumptions.
- Added explicit credential sync state on access rows:
  - `ready`
  - `pending_write`
  - `write_failed`
  - `pending_delete`
  - `delete_failed`
- Reworked `AccessRegistry` and `AccessCredentials` so credential-store failures now persist a detectable SQLite state instead of pretending the system is still atomic.
- Updated connection create/update/remove flows to stop wrapping credential sync paths in outer SQLite transactions that would otherwise erase the newly persisted failure state.
- Kept best-effort cleanup where it is still safe:
  - orphan endpoint removal after failed create
  - endpoint cleanup after successful remove
- Added and updated regression coverage for:
  - create failure leaving pending state
  - credential create failure leaving `write_failed`
  - delete failure leaving `delete_failed`
  - runtime reads refusing non-ready credentials

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 11: Preserve injected shell environment in default Codex login flows

- Updated `NileSessionRuntime.createLocalCredentialResolver()` so the default `CodexSessionLogin` inherits the runtime's injected `EnvironmentSource` instead of silently falling back to `process.env`.
- Added a focused regression test that installs a temporary fake `codex` binary only in the injected PATH and verifies the runtime login path succeeds through that environment.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 10: Reject async SQLite transaction callbacks

- Tightened `SqliteDatabase.transaction()` to return only non-promise results at the type boundary.
- Added a runtime guard that throws if an async callback still slips through via casting or unsafe call sites.
- Added a focused regression test proving async transaction callbacks fail and roll back the SQLite work they started.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 9: Remove leftover single-file source directories

- Moved the concrete SQLite-backed model stores out of one-file `store/` directories so the source tree no longer carries directory shells with only one implementation:
  - `models/access/SqliteAccessStore.ts`
  - `models/endpoint/SqliteEndpointStore.ts`
  - `models/selection/SqliteAgentSelectionStore.ts`
- Updated the remaining tests and registry imports to the concrete file paths.
- Removed now-empty source directories:
  - `packages/core/src/models/access/store`
  - `packages/core/src/models/endpoint/store`
  - `packages/core/src/models/selection/store`
  - `packages/core/src/usage`

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`
- `git diff --check -- . ':(exclude)error.log'`

### Step 7: Remove usage facade and simplify adapter context access

- Removed `runtime-local/UsageAccess`; usage reads, bind, auto-bind, and artifact cleanup now live directly on `NileSessionRuntime`.
- Updated `NileSessionEffects` to depend on a single `autoBindCursorUsage(connectionId)` callback instead of a wider usage facade.
- Reduced one internal hop from:
  - CLI `cursor usage bind` / `auto-bind`
  - desktop usage binding flows
  - post-create/import local auto-bind effects
- Simplified `AgentAdapterContextSession` to expose the actual `sharedContext` directly instead of maintaining a second getter facade for endpoint/access registries.
- Updated agent current-state / import / apply / rollback factories to use:
  - `context.sharedContext.*` for session-owned adapter contexts
  - direct `SharedAgentAdapterContext` fields for shared-context paths

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`
- `git diff --check -- . ':(exclude)error.log'`

### Step 8: Remove speculative adapter/store abstractions

- Removed the model-layer SQLite store interfaces for:
  - access
  - endpoint
  - selection
- Repointed registry/selection helpers and failure-path tests at the current concrete SQLite store classes instead of carrying single-implementation interfaces.
- Shrunk `AgentAdapter` to the current runtime surface:
  - removed unused `detectCurrentState()`
  - removed the repeated multi-flag capability bag
  - kept only `rollbackSupport`, which is the only capability metadata currently consumed by desktop state/history
- Simplified projection resolution away from a strategy registry array:
  - removed `AgentProjectionStrategy`
  - switched `AgentProjectionResolver` to direct concrete dispatch by agent id
- Added shared `runWithSession` / `runWithSessionAsync` helpers in core so CLI and desktop session runners share the same open/close implementation.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 6: Collapse forwarding chains and remove premature core exports

- Removed the duplicate `connection` field from `PreparedAgentApplySelection`; apply flows now use the single `access` record that actually backs the selected connection.
- Split `NileSessionRuntime` connection composition into concrete `SavedConnections`, `ConnectionCreator`, and `SessionConnections` workflow accessors.
- Shrank `SessionConnections` so it only owns update/local-credential conversion workflows instead of also forwarding pure saved-connection CRUD and create/describe calls.
- Removed the unused top-level `WorkspaceState` interface; `LocalWorkspaceState` is now the concrete class until a second implementation exists.
- Removed the single-file `usage/cursor` package entrypoint and the corresponding build/export entries.
- Consolidated agent capability typing into a named capability-key record and reduced future-extension wording in `AgentAdapterRegistry`.
- Collapsed CLI `StatusCommands` and `HistoryCommands` into `AgentCommands`, reducing pure command wrapper classes while keeping the interactive-menu command boundary.
- Deduplicated CLI add/import connection summary mapping.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 5: Remove redundant agent session facade

- Removed `runtime-local/SessionAgents`, which only forwarded calls from `NileSession` to agent actions, adapter registry, or mutation history.
- Moved agent-session operations into `NileSessionRuntime`, keeping `NileSession` as the public API while removing one internal call hop from agent status, scan, import, apply, rollback, capability, and history flows.
- Removed unused `SessionConnections.createLocal(...)` and `SessionConnections.describeLocalOnboarding(...)` convenience methods so the connection session service only exposes currently exercised paths.
- Kept `SessionRunner`, `NileSessionEffects`, and `SessionConnections` because they still own concrete responsibilities:
  - session open/close cleanup
  - post-create/import local effects
  - local credential request conversion for connection creation/update

### Verification

- `npm run test:core`
- `npm run typecheck`
- `npm run test:desktop`

## 2026-05-04

### Step 1: Agent Flow Unification

- Started the maintainability refactor with the highest-duplication path: agent apply orchestration.
- Chose to unify the shared apply lifecycle first:
  - prepare
  - mutation-history start
  - apply
  - restore-on-error
  - mark-failed-safely
  - complete
- Deferred wider session and package-boundary changes until the apply refactor lands cleanly.
- Added a shared `ApplyMutation` orchestrator under `packages/core/src/agents/` so codex / claude / cursor / openclaw now share one implementation for:
  - mutation-history start
  - apply execution
  - restore-on-error
  - mark-failed-safely
  - apply completion
- Rewired the four agent `ApplySelection` classes to keep only agent-specific config and credential writes while delegating the common mutation lifecycle.
- Added focused tests for the shared orchestrator covering:
  - successful apply completion
  - original error preservation when `markFailed(...)` itself fails
- Added a shared `RollbackLatest` helper for the simple rollback flow used by codex / claude / openclaw.
- Rewired those three rollback classes so they now delegate:
  - mutation-history rollback
  - selection clear
  - state reconciliation
  - success logging
  to one shared implementation.
- Completed PR1 scope for the common agent lifecycle without changing external apply / rollback behavior.

### Step 2: Access Registry Split

- Split `models/access/Registry.ts` into focused collaborators:
  - `Builder` for access record construction and validation
  - `Credentials` for credential create / update / remove rollback handling
- Reduced `AccessRegistry` to orchestration:
  - build record
  - persist access row
  - delegate credential lifecycle
- Preserved previous `readCredential(...)` semantics at the registry boundary so connection reuse and live-state matching still read credentials from the same place.
- Added focused rollback tests for:
  - restoring the previous credential when access-row update persistence fails
  - restoring the previous credential when access removal persistence fails

### Step 3: Session Surface Narrowing

- Split `runtime-local/NileSession.ts` into narrower collaborators:
  - `Runtime` for lazy composition of workspace state, agent adapters, mutation history, and session facades
  - `Effects` for local side effects such as Cursor usage auto-bind after create/import flows
- Kept the `NileSession` public API stable for CLI and desktop callers while shrinking it from a wide composition root into a thin delegator.
- Reduced `NileSession.ts` from 332 lines to 193 lines without changing external behavior.

### Step 4: Core Package Boundary

- Added a real `@nile/core` build pipeline:
  - `build.mjs` bundles exported runtime entrypoints into `dist/`
  - `tsconfig.build.json` emits declaration files into the same `dist/` tree
- Moved `packages/core/package.json` runtime exports from `src/` to `dist/`.
- Added package metadata for the built boundary:
  - `main`
  - `types`
  - `files`
- Retargeted workspace TypeScript path aliases to the built declaration boundary under `packages/core/dist/` so CLI / desktop / host-local compile against the packaged surface instead of the source tree.
- Added `build:core` orchestration at the repo root and wired CLI / desktop start-build flows to build `@nile/core` before use.
- Confirmed local `file:` dependencies point to the shared workspace package via symlink, so building `packages/core/dist` updates the runtime boundary used by CLI and desktop directly.

### Verification

- `npm run test:core`
- `npm run typecheck`
- `npm run test:host-local`
- `npm run test:cli`
- `npm run test:desktop`

## 2026-05-05

### Step 5: Decouple agent metadata, cleanup policy, and CLI catalog wiring

- Moved shared agent adapter contracts out of `runtime-local` and into stable lower-layer modules:
  - `packages/core/src/models/agent/Adapter.ts`
  - `packages/core/src/application/local/AgentAdapterContext.ts`
- Rewired `actions/status` and `application/local/WorkspaceState` to depend on those shared contracts instead of importing session-composition types from `runtime-local`.
- Centralized agent registration metadata in `models/agent/Types.ts`:
  - one `AGENT_DEFINITIONS` source
  - derived `SUPPORTED_AGENT_IDS`
  - shared `formatAgentLabel(...)`
- Reused the shared agent catalog in CLI and desktop so labels/examples no longer drift across:
  - CLI routing/help
  - desktop renderer labels
  - desktop presenter formatting
- Chose an explicit stale-selection cleanup policy instead of keeping orphaned saved selections:
  - removing a saved connection now clears the saved agent-selection row for affected agents
  - CLI and desktop tests were updated to assert the new repaired state model

### Step 6: Add schema migration ledger and tighten CLI parser boundaries

- Added `SchemaMigrations` as a shared SQLite migration ledger under `services/database/`.
- Replaced ad hoc `ALTER TABLE` probes with ordered versioned migrations in:
  - access store
  - endpoint store
  - selection store
  - mutation history store
  - Cursor usage binding/snapshot stores
- Added `CliCatalog` as the shared source for:
  - help lines
  - agent-scoped command examples
  - known flag registry
- Tightened `ArgumentParser` so unknown flags are rejected instead of silently accepted.

### Step 7: Move CLI and host-local onto built package boundaries and workspace scripts

- Added npm workspaces at the repo root and removed the old nested-install `postinstall` choreography.
- Gave `@nile/host-local` a real built package boundary:
  - `build.mjs` for runtime bundling
  - `tsconfig.build.json` for emitted declarations
  - `package.json` exports/main/types/files pointed at `dist/`
- Gave `@nile/cli` a built bin entrypoint:
  - `build.mjs` emits `dist/main.js`
  - package bin/main now point to `dist/`
  - root `nile` / `start` scripts now execute the built CLI entrypoint
- Split the old DOM-enabled root TypeScript config into:
  - `tsconfig.base.json`
  - `tsconfig.node.json`
  - `tsconfig.renderer.json`
  - a thin reference-only `tsconfig.json`
- Adjusted the root verification scripts so typecheck/CLI/desktop runs build the shared package boundaries first.

### Verification

- `npm run typecheck`
- `npm run test:host-local`
- `npm run test:cli`
- `npm run test:desktop`
- `npm run build:cli`

### Step 8: Split mutation-history schema and row mapping from the SQLite store

- Moved mutation-history schema initialization into `services/history/SqliteMutationHistorySchema.ts`.
- Moved SQLite row-to-domain mapping into `services/history/SqliteMutationHistoryRows.ts`.
- Kept `SqliteMutationHistoryStore` focused on concrete query/write flows and reduced it to 291 lines.
- Preserved rollback lookup behavior by mapping the latest unapplied rollback candidate through the shared row mapper plus file lookup.

### Verification

- `npm run test:core`
- `npm run typecheck`
