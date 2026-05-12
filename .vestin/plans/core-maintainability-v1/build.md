# Core Maintainability V1 Build Log

## 2026-05-06

### Step 28: Refresh remaining active core plan docs to match the current core structure

- Updated `.vestin/plans/core-endpoint-capability-refactor.md` so its recommended module layout now points at the live core clusters:
  - `actions/live-setup`
  - `actions/local-setup`
  - `actions/apply`
  - `projection`
- Added `openclaw` to the projection-strategy list in that architecture plan.
- Updated `.vestin/plans/core-maintainability-v1/plan.md` with a current-status section so it now reads as:
  - largely implemented
  - backed by the build log for detailed history
  - focused on preventing structural regrowth instead of broad rescue work
- Result:
  - active core plan docs no longer present the pre-refactor action layout as if it were still current
  - maintainers can distinguish historical intent from the current core shape more quickly

### Verification

- `git diff --check -- . ':(exclude)error.log'`

### Step 27: Sync .vestin core architecture docs to the post-refactor structure

- Updated `.vestin/architect.md` so the shared-core architecture summary now reflects the current core shape:
  - `actions/local-setup`
  - `actions/live-setup`
  - `actions/usage`
  - `actions/apply`
  - `projection/`
  - `openclaw` as a first-class adapter
- Updated `.vestin/specs/core/module.md` so the core module doc no longer describes the old `scan-local` / `use` action layout.
- Updated `.vestin/plans/plan.md` to reflect:
  - `openclaw` in current shipped scope
  - the current action-cluster layout
  - the current desktop/electron structural boundaries as a near-term rule
- Updated onboarding scan/import plan docs to reference the live `actions/local-setup/` cluster instead of the removed `actions/scan-local/` path.
- Removed the stale `.vestin/state/features.json` entry for the deleted `docs/openclaw-switching-research.md` note.
- Result:
  - `.vestin` top-level architecture docs now describe the current repository structure instead of the pre-refactor layout
  - historical build logs remain historical, but active guidance now matches the codebase again

### Verification

- `git diff --check -- . ':(exclude)error.log'`

### Step 26: Split SessionResources into workspace and history collaborators

- Added:
  - `runtime-local/SessionWorkspaceResources.ts`
  - `runtime-local/SessionHistoryResources.ts`
- Moved workspace-derived resource ownership out of `SessionResources`:
  - workspace state
  - agent selection
  - saved connections
  - connection creator
  - local connection workflows
  - local agent workflows
  - usage and cursor-usage operations
- Moved mutation-history resource ownership out of `SessionResources`:
  - history caching
  - scope-specific history reads
  - history logger scoping
- Kept `SessionResources` as the session-level coordinator for:
  - adapter registry creation
  - delegation to workspace and history collaborators
- Result:
  - `SessionResources` now reads more like a thin session composition class
  - workspace, usage, and history concerns are no longer mixed in one resource holder

### Verification

- `npm run verify:structure`
- `npm run test:core`
- `npm run typecheck`

### Step 25: Make AgentWorkflows own its own assembly and keep WorkspaceState resource-only

- Simplified `application/local/AgentWorkflows.ts`:
  - removed the extra `createActions()` hop
  - made `LocalAgentWorkflows` own its concrete `status`, `scanLocal`, and `importDetectedSetups` collaborators directly
- Removed local-agent workflow assembly from `LocalWorkspaceState`.
- Kept `LocalWorkspaceState` focused on:
  - local registries
  - connection creation helpers
  - usage and cursor-usage resource access
- Updated `runtime-local/SessionResources.ts` to build `LocalAgentWorkflows` directly from workspace registries plus the adapter registry.
- Result:
  - `WorkspaceState` now reads more like a resource holder
  - `AgentWorkflows` now reads more like one cohesive local-state workflow cluster instead of a small factory wrapper
  - one more resource-vs-workflow ownership seam is now explicit instead of split across two classes

### Verification

- `npm run verify:structure`
- `npm run test:core`
- `npm run typecheck`

### Step 24: Remove the agent runtime context leak from application/local and narrow the application/local public surface

- Moved the shared agent runtime context contract out of `application/local` into:
  - `runtime-local/AgentWorkspaceContext.ts`
- Removed the adapter-context creation method from `LocalWorkspaceState`.
- Kept `LocalWorkspaceState` focused on local workspace resources and local workflow factories.
- Updated runtime and agent operation code to consume `AgentWorkspaceContext` from the runtime layer instead of reaching back into `application/local`.
- Narrowed `application/local/index.ts` so it now exposes only the surface-facing local API:
  - local connection input/result types
  - credential request building
  - credential resolution
  - cursor usage probe types
  - cursor usage auto-bind result type
  - state reset
- Explicitly stopped exporting internal implementation clusters from `application/local`:
  - `AgentWorkflows`
  - `ConnectionWorkflows`
  - `WorkspaceState`
  - `CursorUsageAutoBinder`
- Extended the structure check to block those internal `application/local` exports from reappearing.
- Result:
  - `application/local` no longer owns an agent-runtime context concept
  - `application/local` reads more like a surface-facing local workflow boundary and less like an internal grab-bag

### Verification

- `npm run verify:structure`
- `npm run test:core`
- `npm run typecheck`

### Step 23: Write the core target structure down and enforce the highest-value boundary rules

- Added the maintainer-facing roadmap:
  - `quality-roadmap.md`
- Added the concrete `packages/core` boundary target:
  - `architecture-core-target.md`
- Added a repository structure check:
  - `scripts/check-structure.mjs`
- Hooked the check into the normal repo verification path:
  - `npm run verify:structure`
  - `verify:pre-push`
- The structure check currently enforces the most valuable architecture constraints:
  - non-test source files must stay under 500 lines
  - `packages/core/src/runtime-local/index.ts` may export only `NileSession` and `SessionWork`
  - workspace imports may use `@nile/core/runtime-local` only for session lifecycle APIs
  - code outside `models/connection` may not import from the `models/connection/setup/` internal cluster
- Result:
  - the current architecture cleanup is no longer just convention and memory
  - the repo now actively blocks the most likely regressions in `core` boundary shape

### Verification

- `npm run verify:structure`
- `npm run typecheck`

### Step 22: Remove the runtime-local adapter type facade

- Deleted `runtime-local/AgentAdapterTypes.ts`.
- Moved the shared adapter/result contracts back to their real owner:
  - `models/agent/Adapter.ts`
  - `models/agent/index.ts`
- Updated core internals to import adapter contracts from `models/agent` instead of routing through `runtime-local`, including:
  - runtime resource and registry code
  - apply/current-state/local-state actions
  - built-in agent adapters and current-state readers
- Tightened the public `runtime-local` entry again:
  - removed `AgentAdapterRegistry`
  - removed adapter/result type re-exports
  - kept only `NileSession` and `SessionWork`
- Updated desktop imports so rollback/import result types now come from `models/agent`, leaving `runtime-local` responsible only for session lifecycle APIs.
- Result:
  - `runtime-local` is no longer a mixed session-plus-types bucket
  - adapter/result contracts now have one canonical home
  - this removes an exact type re-export layer that was adding indirection without semantics

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 9: Add OpenClaw auth-profile support for official OpenAI and Anthropic connections

- Expanded OpenClaw capability selection so Nile now treats official OpenAI and Anthropic session/auth flows as supported instead of API-key-only.
- Split OpenClaw projection handling between:
  - legacy provider-config writes for gateway/custom API-key endpoints
  - auth-profile writes for official OpenAI and Anthropic connections
- Added `auth-profiles.json` management for OpenClaw apply/restore, including:
  - OpenAI oauth sessions via `openai-codex`
  - Anthropic oauth sessions
  - official OpenAI and Anthropic API-key storage without writing secrets into `openclaw.json`
- Reworked OpenClaw current-state detection/import to understand both:
  - legacy `models.providers`
  - modern `auth.profiles` plus `agents/main/agent/auth-profiles.json`
- Wired OpenClaw detection/import/rollback to the Codex home so OpenAI oauth state can be reconstructed from Codex session data.

### Verification

- `npm run test:core -- --run packages/core/src/agents/openclaw/current-state/Detector.test.ts packages/core/src/agents/openclaw/ImportCurrentConnection.test.ts packages/core/src/agents/openclaw/ApplySelection.test.ts packages/core/src/projection/Resolver.test.ts packages/core/src/models/connection/AgentPolicy.test.ts`
- `npx tsc -p packages/core/tsconfig.build.json --noEmit`
- `npm run typecheck`
  - blocked in the local environment by the Swift/Xcode toolchain mismatch while building `@nile/core`

### Step 9: Build the keychain helper as a universal macOS binary and surface helper startup errors

- Changed `packages/core/build.mjs` so the native `KeychainGenericPasswordHelper` is now compiled twice on macOS:
  - `arm64-apple-macos12.0`
  - `x86_64-apple-macos12.0`
- Combined those two slices with `lipo -create` into one universal helper before desktop packaging copies it into the app bundle.
- Removed the temporary per-arch helper slices after the universal binary is created so `packages/core/dist` keeps only the real shipped helper.
- Extended keychain command result reporting so helper/security process startup failures preserve `spawnSync(...).error.message` instead of collapsing to a vague exit-code-only error.
- Updated credential-store command error formatting to prefer:
  - `stderr`
  - then low-level startup error text
  - then the generic exit-code fallback
- Lowered the helper deployment target to `macOS 12.0` so the packaged keychain helper stays compatible with supported Monterey installs such as `12.7.6`, instead of requiring newer Foundation runtime symbols at launch time.

### Verification

- `npm run test:core`
- `npm run typecheck`
- `file packages/core/dist/services/credential/KeychainGenericPasswordHelper`

### Step 21: Extract cursor follow-up and narrow the runtime-local public surface

- Moved cursor post-create/import follow-up out of `NileSession.ts` into:
  - `runtime-local/CursorUsageConnectionFollowUp.ts`
- Kept the behavior the same:
  - cursor-session connection creation/import still attempts usage auto-bind
  - bind failures still log a warning instead of failing the main operation
- Tightened the `runtime-local` package surface so it now exports only:
  - `NileSession`
  - `SessionWork`
  - adapter-facing runtime types
- Added explicit package exports for the concrete non-runtime surfaces that workspace consumers actually use:
  - `actions/local-setup`
  - `actions/usage`
  - `actions/usage/cursor`
- Updated CLI and desktop consumers to import those DTO/result types from their real owning modules instead of the runtime facade.
- Normalized cross-domain onboarding type imports back to `models/connection` root so `setup/` stays a connection-internal cluster.
- Result:
  - `NileSession` no longer owns cursor-specific follow-up logic directly
  - `runtime-local` no longer acts as a catch-all export bag for unrelated action/application DTOs

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 20: Rename the remaining runtime-local architecture terms to concrete session names

- Renamed the internal runtime files and types:
  - `Runtime.ts` -> `SessionRuntime.ts`
  - `Resources.ts` -> `SessionResources.ts`
  - `RuntimeOptions.ts` -> `SessionRuntimeOptions.ts`
- Renamed the internal runtime classes and types:
  - `NileSessionRuntime` -> `SessionRuntime`
  - `RuntimeResources` -> `SessionResources`
  - `NileSessionRuntimeOptions` -> `SessionRuntimeOptions`
- Renamed the owned agent context session:
  - `AgentAdapterContextSession` -> `AgentWorkspaceSession`
  - `AgentAdapterContext.ts` -> `AgentWorkspaceSession.ts`
- Kept the public `runtime-local` entry surface stable:
  - `NileSession` remains the package-facing API
  - these renamed pieces stay internal implementation details
- Renamed the matching runtime test file to keep the directory context coherent:
  - `Runtime.test.ts` -> `SessionRuntime.test.ts`
- Result:
  - `runtime-local` now reads less like a generic architecture layer and more like a concrete session implementation
  - agent operation classes now refer to an owned workspace session directly instead of a vague adapter-context session

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 19: Group connection setup helpers into one local cluster

- Moved the connection setup support files into `models/connection/setup/`:
  - `PresetTypes.ts`
  - `OnboardingPolicy.ts`
  - `GatewayProbe.ts`
  - `EndpointBuilder.ts`
  - `IdentityKeyResolver.ts`
- Updated all creator/updater, runtime, local workflow, and test imports to read through the new cluster.
- Kept behavior and exported connection surface stable; this was a directory-shape cleanup, not a domain rewrite.
- Result:
  - `Creator` and `Updater` now read more like one cohesive "build or update a connection" story
  - maintainers no longer need to scan the whole `models/connection/` root to find the setup-only support pieces

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 18: Remove the inherited managed adapter template layer

- Deleted `runtime-local/ManagedAgentAdapter.ts`.
- Reworked the four built-in adapters to implement the `AgentAdapter` contract directly:
  - `CodexAgentAdapter`
  - `ClaudeAgentAdapter`
  - `CursorAgentAdapter`
  - `OpenClawAgentAdapter`
- Inlined the three shared `open -> run -> close` flows for:
  - detect current selection
  - apply selection
  - import current connection
- Kept rollback logic concrete inside each adapter where it already differed slightly by result mapping.
- Result:
  - removed one inheritance layer from `runtime-local`
  - adapter files now show their full behavior directly instead of hiding three core methods behind a template base class
  - this aligns better with the repo rule to prefer composition and concrete classes over shallow-but-mechanical inheritance

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 17: Remove two single-use technical buckets from runtime-local and usage

- Folded `runtime-local/Effects.ts` back into `runtime-local/NileSession.ts`.
- Kept the behavior the same:
  - create connection with local effects
  - create local connection with local effects
  - import current connection with local effects
  still auto-bind cursor usage for cursor session connections and still warn on bind failures.
- Result:
  - maintainers no longer need to chase a vague `Effects` helper to understand post-create/import cursor usage behavior
  - `NileSession` now owns the only follow-up behavior it actually triggers
- Folded `actions/usage/ReaderRegistry.ts` back into `actions/usage/Usage.ts`.
- Kept the concrete readers:
  - OpenAI session usage
  - Claude session usage
  - Cursor usage
  but removed the extra registry hop because it only served one caller.
- Result:
  - the usage read path is now visible in one file
  - `actions/usage` has one less technical indirection layer

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 16: Rename apply actions and split built-in adapter wiring out of the registry

- Renamed the vague `actions/use/` cluster to the concrete `actions/apply/` cluster:
  - `actions/apply/Support.ts`
- Updated the apply path across:
  - `ApplyMutation`
  - all four agent apply-selection flows
  - rollback tests that build `AgentApplySupport`
- Kept `AgentApplySupport` as the concrete class name, but moved it under an apply-specific cluster so maintainers no longer need to infer that `use` means "apply a saved connection".
- Split built-in adapter construction out of `runtime-local/AgentAdapterRegistry.ts` into:
  - `runtime-local/BuiltInAdapters.ts`
- Kept `AgentAdapterRegistry` focused on actual registry responsibilities:
  - duplicate detection
  - adapter lookup
  - rollback-support listing
- Updated `RuntimeResources` to compose the two pieces explicitly:
  - built-in adapters
  - registry from adapters
- Result:
  - the apply path now reads more like a concrete use-case cluster
  - the registry no longer mixes collection semantics with built-in adapter assembly

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 15: Add typed subpath exports for workspace consumers

- Updated `packages/core/package.json` exports so each public subpath now declares both:
  - `types`
  - `default`
- Covered the current desktop-consumed surfaces, including:
  - `application/local`
  - `runtime-local`
  - `models/agent`
  - `models/agent/types`
  - `models/connection/enabled-agents-policy`
  - wildcard `models/*`
  - wildcard `services/*`
- Result:
  - bundler-mode TypeScript can now resolve desktop imports against `@nile/core` without falling back to missing declaration warnings
  - workspace consumers no longer depend on accidental JS-only export behavior for subpath typing

### Verification

- `npm run build -w @nile/desktop`
- `npm run test:desktop`
- `npm run typecheck`

### Step 14: Rename generic import actions into one current-state cluster

- Moved the cross-agent current-state helper seam out of the vague `actions/import/` folder into:
  - `actions/live-setup/Import.ts`
  - `actions/live-setup/Matcher.ts`
- Renamed the exported collaborators to read like the story they support:
  - `AgentImportSupport` -> `CurrentStateImportSupport`
  - `AgentStateMatcher` -> `CurrentStateMatcher`
- Updated all detector and import-current flows so the cross-agent path now reads as:
  - current-state reader
  - current-state matcher
  - import current connection
- Removed the old `actions/import/` shell once the call sites moved over.
- Result:
  - this seam no longer looks like a generic import framework
  - maintainers can now find current-state reconciliation and current-connection import support under one concrete cluster

### Verification

- `npm run test:core`
- `npm run typecheck`

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

### Step 12 (Core): Group local state actions into one use-case cluster

- Moved the local-state use-case files into one `actions/local-setup/` cluster:
  - `Status`
  - `ScanLocalSetups`
  - `ImportDetectedSetups`
  - `Result`
- Updated `application/local/AgentWorkflows` and `runtime-local` exports to read from the new cluster instead of splitting that story across `actions/status/` and `actions/scan-local/`.
- Result:
  - "read local agent status"
  - "scan local setup"
  - "import detected setup"
  now live in one maintainer-facing area instead of two sibling action folders.

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 11 (Core): Split runtime resource graph from NileSessionRuntime

- Moved the lazy resource graph and object wiring out of `runtime-local/Runtime.ts` into:
  - `runtime-local/Resources.ts`
  - `runtime-local/RuntimeOptions.ts`
- Kept `NileSessionRuntime` as the session-facing entry object for:
  - saved connections
  - local connection workflows
  - agent status/import/apply/rollback calls
  - usage and mutation-history reads
- Moved the following responsibilities into `RuntimeResources`:
  - workspace-state caching
  - agent-selection caching
  - adapter-registry wiring
  - local agent workflow caching
  - mutation-history creation
  - usage and cursor-binding resource access
- Result:
  - `Runtime.ts` dropped to 119 lines
  - the runtime composition root now reads more like an entry API over a resource holder instead of one mixed class doing both

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 10 (Core): Split local agent workflow assembly from workspace resources

- Added `application/local/AgentWorkflows.ts` to own the local agent use-case assembly for:
  - status
  - scan local setups
  - import detected setups
- Renamed `LocalWorkspaceState.createAgentActions(...)` to `createLocalAgentWorkflows(...)` so `WorkspaceState` now reads more like a resource holder and less like a mixed resource-plus-use-case bucket.
- Kept `WorkspaceState` focused on shared local resources:
  - endpoint registry
  - access registry
  - saved connections
  - connection creator
  - usage/binding artifacts
- Updated `NileSessionRuntime` to ask for local agent workflows explicitly instead of generic "agent actions".

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 9 (Core): Move local connection workflows out of runtime-local

- Moved the local connection workflow object from `runtime-local/Connections.ts` into:
  - `application/local/ConnectionWorkflows.ts`
- Renamed `SessionConnections` to `LocalConnectionWorkflows` so the type now reads as a concrete local workflow owner instead of a vague runtime helper.
- Moved the local connection input/result types out of `runtime-local/ConnectionTypes.ts` into:
  - `application/local/ConnectionInputs.ts`
- Kept the public `runtime-local` package surface stable by re-exporting those types from `runtime-local/index.ts`.
- Updated `NileSessionRuntime` and `NileSession` naming so this path now reads as:
  - session runtime
  - local connection workflows
  - local credential resolution
  instead of mixing all three concerns under `runtime-local/`.

### Verification

- `npm run test:core`
- `npm run typecheck`

### Step 9 (CLI): Split CLI connection add/onboarding flow out of command handlers

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

### Step 12 (Claude): Split Claude gateway model cache and ranking out of the settings store

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

### Step 11 (CLI): Split CLI agent-selection flow out of add/onboarding orchestration

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

### Step 10 (CLI): Split CLI entry routing and presenter label normalization

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

### Step 12 (Access Sync): Replace implicit access credential compensation with explicit sync state

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

### Step 11 (Login Env): Preserve injected shell environment in default Codex login flows

- Updated `NileSessionRuntime.createLocalCredentialResolver()` so the default `CodexSessionLogin` inherits the runtime's injected `EnvironmentSource` instead of silently falling back to `process.env`.
- Added a focused regression test that installs a temporary fake `codex` binary only in the injected PATH and verifies the runtime login path succeeds through that environment.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 10 (SQLite): Reject async SQLite transaction callbacks

- Tightened `SqliteDatabase.transaction()` to return only non-promise results at the type boundary.
- Added a runtime guard that throws if an async callback still slips through via casting or unsafe call sites.
- Added a focused regression test proving async transaction callbacks fail and roll back the SQLite work they started.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 9 (Cleanup): Remove leftover single-file source directories

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
