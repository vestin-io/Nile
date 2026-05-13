# Pre-Extension Cleanup Build Log

## 2026-05-12

### Plan refinement: expand pre-extension scope beyond agent-only cleanup

- Updated `pre-extension-cleanup.md` to make the cleanup plan more complete before Gemini work starts.
- Extended the plan to explicitly cover seams that had emerged during implementation review but were not called out in the original draft:
  - import side-effect discipline
  - model catalog discipline
  - browser-safe core boundary
  - setup scan/probe cost
  - migration/compatibility discipline
- Added a `Phase 2.5` section to separate “small but important extension-seam cleanup” from the larger guardrail/documentation work in Phase 3.

### Step 1: Seed pre-Gemini cleanup plan

- Added `pre-extension-cleanup.md` to define the cleanup goal before Gemini work starts.
- Focused the cleanup on two concrete architecture seams first:
  - shared agent capability contract
  - shared local-setup reconciliation

### Step 2: Add shared agent capability contract

- Added `packages/core/src/models/agent/Capabilities.ts` as the current single source of truth for exercised agent capability rules:
  - selected-model requirement
  - env-backed API-key requirement
  - managed env-backed API-key support
- Rewired `packages/core/src/models/connection/Requirements.ts` to derive apply requirements from that contract instead of a hardcoded OpenClaw-only policy shape.
- Rewired `packages/core/src/models/connection/AgentPolicy.ts` to reuse the same contract for env-key support checks instead of maintaining a separate hardcoded agent list.

### Step 3: Add shared local-setup reconciliation

- Added `packages/core/src/actions/local-setup/Reconciliation.ts` as the shared translation from detector validity into extension-facing setup state:
  - `already_saved`
  - `new`
  - `invalid`
  - `unverified`
  - `unavailable`
- Updated `packages/core/src/actions/local-setup/Status.ts` to expose reconciliation alongside the existing desktop-facing sync/current-connection state.
- Updated `packages/core/src/actions/local-setup/ScanLocalSetups.ts` to consume reconciliation output instead of re-deriving onboarding state independently.
- Kept the desktop DTO surface stable for now so the cleanup stays incremental rather than forcing a wide UI rename.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/agent/Capabilities.test.ts packages/core/src/models/connection/Requirements.test.ts packages/core/src/actions/local-setup/Reconciliation.test.ts packages/core/src/actions/local-setup/Status.test.ts`
- `npm run typecheck`

### Step 4: Centralize connection compatibility in agent capability policy

- Expanded `packages/core/src/models/agent/Capabilities.ts` beyond apply-only requirements so it now also answers:
  - which detected protocol families an agent supports
  - which saved connections an agent can use
  - which selectable connection presets/auth-mode combinations an agent supports
- Rewired:
  - `packages/core/src/models/connection/AgentPolicy.ts`
  - `packages/core/src/models/connection/setup/OnboardingPolicy.ts`
  to derive compatibility from that shared capability source instead of carrying their own OpenClaw/Codex/Claude compatibility branches.

### Step 5: Start moving desktop state toward reconciliation-first semantics

- Added `reconciliationState` to desktop agent/settings state so renderer surfaces can depend on the shared core reconciliation result directly.
- Switched desktop current-connection status resolution to rely on `status.reconciliation.state === "already_saved"` instead of the older sync-state string where possible.
- Updated profile assignment UI to use reconciliation for “missing local setup” instead of hand-checking `currentConnectionState + liveConnection`.
- Removed the unused `formatSyncLabel(...)` helper and the now-dead `sync.*` i18n entries.
- Removed the stale `unsupported` onboarding state from the setup scan path because it no longer had any producer.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/agent/Capabilities.test.ts packages/core/src/models/connection/AgentPolicy.test.ts packages/core/src/models/connection/setup/OnboardingPolicy.test.ts packages/core/src/models/connection/Requirements.test.ts packages/core/src/actions/local-setup/Reconciliation.test.ts packages/core/src/actions/local-setup/Status.test.ts`
- `npm run typecheck`

### Step 6: Remove legacy sync-state projection

- Removed `syncState` from core `AgentStatusView` and from desktop `SettingsState` / `DesktopAgentState` DTOs so setup reconciliation now has a single truth source.
- Updated CLI status presentation to derive human-readable state directly from `status.reconciliation.state`.
- Updated desktop fixtures/tests to assert `reconciliationState` instead of the older sync-state strings.
- Kept `currentConnectionState` intact because it still carries a separate persisted-selection/orphaned concern that reconciliation does not replace.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/local-setup/Status.test.ts apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`
- `npm run typecheck`

### Step 7: Unify connection support kinds and capability-driven compatibility

- Added `packages/core/src/models/connection/Support.ts` as the shared classifier from connection auth/protocol families to reusable support kinds:
  - `openai-api-key`
  - `anthropic-api-key`
  - `cursor-api-key`
  - `openai-session`
  - `claude-session`
  - `cursor-session`
- Expanded `packages/core/src/models/agent/Capabilities.ts` so the capability contract now carries both:
  - `requiredApplyRequirements`
  - `supportedConnectionKinds`
- Rewired:
  - `packages/core/src/models/connection/AgentPolicy.ts`
  - `packages/core/src/models/connection/SavedConnections.ts`
  - `packages/core/src/models/connection/setup/OnboardingPolicy.ts`
  - `packages/core/src/actions/live-setup/Import.ts`
  to derive agent compatibility and default enabled agents from the shared capability + support-kind model instead of maintaining separate gateway/OpenClaw branches.
- Added shared desktop helpers in `apps/desktop/src/renderer/shared/DesktopData.ts` so quick setup reads compatible saved connections from one surface helper instead of ad hoc filtering.
- Removed the now-unused `onboardingSuggestedAgents` branch from `AgentCapabilities`, and simplified quick setup state so the existing-connection chooser no longer depends on a redundant selected-agent lookup.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/agent/Capabilities.test.ts packages/core/src/models/connection/AgentPolicy.test.ts packages/core/src/models/connection/setup/OnboardingPolicy.test.ts packages/core/src/models/connection/Requirements.test.ts`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Step 8: Consolidate desktop local-setup presentation around reconciliation

- Added `apps/desktop/src/renderer/shared/LocalSetup.ts` as the shared presenter for:
  - local setup section primary/secondary copy
  - reconciliation-driven badge/confirmed state
  - quick setup guide tone/content
- Rewired:
  - `apps/desktop/src/renderer/quick-setup/DetectedSetup.tsx`
  - `apps/desktop/src/renderer/quick-setup/Guide.tsx`
  - `apps/desktop/src/renderer/quick-setup/AgentCard.tsx`
  - `apps/desktop/src/renderer/agents/list/Card.tsx`
  to consume that shared presenter instead of comparing onboarding state strings independently.
- Renamed desktop onboarding DTO state from `state` to `reconciliationState` in:
  - `apps/desktop/src/state/Types.ts`
  - `apps/desktop/src/state/SettingsQuery.ts`
  so renderer surfaces consume explicit reconciliation semantics rather than a generic local state label.
- Audited desktop menubar / quick setup / agent list usage:
  - menubar does not interpret detector validity directly
  - quick setup and agent list now read local-setup UI semantics through the shared presenter

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts packages/core/src/actions/local-setup/Status.test.ts`
- `npm run typecheck`

### Step 10: Connection edit/add provider summary shell cleanup

- Fixed the empty rounded placeholder shown on connection edit pages when a preset has no provider summary metadata.
- Added an explicit `hasProviderSummary(...)` check in:
  - `apps/desktop/src/renderer/providers/ProviderSummary.tsx`
  - `apps/desktop/src/renderer/connections/edit/Page.tsx`
  so the summary card shell is only rendered when real content exists.
- Applied the same guard to add-connection preset summaries in:
  - `apps/desktop/src/renderer/connections/add/PresetCard.tsx`
  to avoid rendering a separator with no summary content for custom presets.

### Verification

- `npm run typecheck`

### Step 17: Tighten managed environment sync performance and shell safety

- Reduced startup managed-env churn by only writing to the desktop environment store when the resolved secret actually changed:
  - `apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.ts`
- Added `clearForSession(...)` so reset clears stale managed env keys in one pass and then performs a single shell sync instead of rewriting the shell bridge per connection:
  - `apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.ts`
  - `apps/desktop/src/electron/shell/DesktopMain.ts`
- Added minimal shell-path hardening so Nile refuses to manage symlinked profile/script targets:
  - `apps/desktop/src/electron/environment/Shell.ts`
- Extended coverage for:
  - unchanged managed secrets skipping redundant writes
  - batched reset cleanup / shell sync
  - symlinked profile refusal
  in:
  - `apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts`
  - `apps/desktop/src/electron/environment/Shell.test.ts`

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/Shell.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts`
- `npm run typecheck`

### Step 10: Desktop sign-in and browser-safe home-path cleanup

- Removed browser-side dependence on `@nile/core/models/agent/homes` by resolving default agent home paths at the desktop surface boundary instead of inside `SettingsQuery`.
- Made Codex and Claude session login prefer the current process `PATH` while still appending login-shell entries, so desktop dev runs pick the working CLI install before stale shell paths.
- Kept the OpenAI session add flow default on `current_codex`; the login path remains explicit and now resolves the CLI more robustly.

### Verification

- `npm run typecheck`
- `node --import tsx ./build.ts` in `apps/desktop`
- `./node_modules/.bin/vitest run packages/core/src/agents/codex/CodexSessionLogin.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`

### Step 16: Adopt low-risk review fixes for expansion safety

- Added exhaustive `never` checks to extension-sensitive switches in:
  - `packages/core/src/models/connection/Support.ts`
  - `packages/core/src/models/connection/AgentPolicy.ts`
  - `packages/core/src/models/connection/setup/EndpointBuilder.ts`
  - `packages/core/src/projection/Resolver.ts`
- Extracted shared JWT payload decoding to:
  - `packages/core/src/services/JwtPayloadDecoder.ts`
  and reused it from Codex/OpenClaw session readers plus connection labeling/identity resolution.
- Extracted shared `ApplySelectionValidationError` to:
  - `packages/core/src/agents/ApplySelectionValidationError.ts`
  and reused it across Codex, Claude, Cursor, and OpenClaw apply flows.
- Removed dead `LiveSetupMatcher` re-exports from:
  - `packages/core/src/agents/codex/index.ts`
  - `packages/core/src/agents/cursor/index.ts`
- Added direct tests for connection support-kind behavior:
  - `packages/core/src/models/connection/Support.test.ts`

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/models/connection/Support.test.ts packages/core/src/models/connection/AgentPolicy.test.ts packages/core/src/projection/Resolver.test.ts packages/core/src/agents/codex/apply/ApplySelection.test.ts packages/core/src/agents/claude/ApplySelection.test.ts packages/core/src/agents/cursor/ApplySelection.test.ts packages/core/src/agents/openclaw/ApplySelection.test.ts`

### Step 13: Auto-sync matched live selections for stable agents

- Added `packages/core/src/actions/local-setup/SelectionSync.ts` to reconcile persisted agent selections with uniquely matched saved live setups before status/scan reads.
- Extended `AgentCapabilities` with `autoSyncMatchedSelection` so only stable agents auto-follow matched live state:
  - `codex`, `claude`, `cursor`: `true`
  - `openclaw`: `false`
- Updated local-setup status/scan flows to reuse synced detections instead of re-detecting after selection sync:
  - `packages/core/src/actions/local-setup/Status.ts`
  - `packages/core/src/actions/local-setup/ScanLocalSetups.ts`
  - `packages/core/src/application/local/AgentWorkflows.ts`
  - `packages/core/src/runtime-local/SessionWorkspaceResources.ts`
  - `packages/core/src/runtime-local/SessionRuntime.ts`
- Added regression coverage proving:
  - Codex matched live sessions auto-update persisted selection
  - OpenClaw does not auto-follow Codex-linked live auth
  - `packages/core/src/actions/local-setup/SelectionSync.test.ts`

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/local-setup/SelectionSync.test.ts packages/core/src/models/agent/Capabilities.test.ts packages/core/src/actions/local-setup/Status.test.ts`
- `npm run typecheck`

### Step 14: Decouple OpenClaw steady-state detection from Codex live auth

- Removed the `openai-codex` live-state dependency on `~/.codex/auth.json` from OpenClaw detection.
- OpenClaw now treats its own saved OAuth auth-profile as the steady-state truth for OpenAI-session matching:
  - `packages/core/src/agents/openclaw/live-setup/Resolver.ts`
  - `packages/core/src/agents/openclaw/live-setup/StateFactory.ts`
  - `packages/core/src/agents/openclaw/live-setup/Reader.ts`
- Removed `codexHome` plumbing from OpenClaw detector/import/rollback wiring so OpenClaw no longer depends on Codex home just to validate local state:
  - `packages/core/src/agents/openclaw/live-setup/Detector.ts`
  - `packages/core/src/agents/openclaw/ImportCurrentConnection.ts`
  - `packages/core/src/agents/openclaw/RollbackLatestMutation.ts`
  - `packages/core/src/agents/openclaw/OpenClawAgentAdapter.ts`
  - `packages/core/src/runtime-local/BuiltInAdapters.ts`
- Updated OpenClaw tests to reflect independent auth-profile matching instead of Codex-auth coupling:
  - `packages/core/src/agents/openclaw/live-setup/Detector.test.ts`
  - `packages/core/src/agents/openclaw/ImportCurrentConnection.test.ts`

### Verification

- `./node_modules/.bin/vitest run packages/core/src/agents/openclaw/live-setup/Detector.test.ts packages/core/src/agents/openclaw/ImportCurrentConnection.test.ts packages/core/src/agents/openclaw/RollbackLatestMutation.test.ts packages/core/src/agents/openclaw/ApplySelection.test.ts`
- `npm run typecheck`

### Step 10: Remove thin presentation shells

- Deleted the unused desktop compatibility re-export shell:
  - `apps/desktop/src/electron/types.ts`
- Deleted the CLI formatter re-export shell and updated callers to import the shared agent label formatter directly from core:
  - `apps/cli/src/formatters.ts`
- Folded the thin shared definitions wrapper back into `DesktopData`:
  - moved `readDefinitionKeywords(...)`
  - moved `orderSupportedAuthModes(...)`
  - deleted `apps/desktop/src/renderer/shared/Definitions.ts`
- Removed the desktop connection presenter pass-through shell and rewired callers directly to the focused list/status presenters:
  - deleted `apps/desktop/src/state/ConnectionPresenter.ts`
  - updated `Surface.ts`, `SettingsQuery.ts`, `MenubarQuery.ts`, `HistoryQuery.ts`, and `DesktopConnectionGateway.ts`

### Verification

- `npm run typecheck`

### Step 11: Default OpenAI session onboarding to current Codex import

- Restored the add-connection OpenAI session default to `current_codex` instead of `login`:
  - `apps/desktop/src/renderer/connections/add/useForm.ts`
- Reordered the OpenAI session method cards so the default import path appears before explicit sign-in:
  - `apps/desktop/src/renderer/connections/ConnectionFormParts.tsx`
- Added a renderer regression test covering the method ordering/default intent:
  - `apps/desktop/src/renderer/connections/add/useForm.test.ts`

### Verification

- `npm run typecheck`
- `node --import tsx ./build.ts` (in `apps/desktop`)

### Step 12: Make session sign-in non-blocking

- Switched Codex and Claude login helpers from synchronous `spawnSync(...)` to asynchronous child-process execution so desktop sign-in flows no longer block the Electron main process:
  - `packages/core/src/agents/codex/CodexSessionLogin.ts`
  - `packages/core/src/agents/claude/ClaudeSessionLogin.ts`
- Added `LocalCredentialResolver.resolveAsync(...)` for session-login-backed credential resolution and updated local connection workflows plus desktop/CLI onboarding flows to await it:
  - `packages/core/src/application/local/LocalCredentialResolver.ts`
  - `packages/core/src/application/local/ConnectionWorkflows.ts`
  - `apps/desktop/src/electron/connections/DesktopConnectionManager.ts`
  - `apps/cli/src/commands/CredentialResolver.ts`
  - `apps/cli/src/commands/ConnectionAddFlow.ts`
- Restored add-connection OpenAI session defaults to prefer importing the current Codex session over triggering a fresh login:
  - `apps/desktop/src/renderer/connections/add/useForm.ts`
  - `apps/desktop/src/renderer/connections/ConnectionFormParts.tsx`

### Verification

- `./node_modules/.bin/vitest run packages/core/src/agents/codex/CodexSessionLogin.test.ts packages/core/src/agents/codex/live-setup/CurrentCredentialReader.test.ts packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/runtime-local/SessionRuntime.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/cli/src/NileCli.test.ts`
- `npm run typecheck`
- `node --import tsx ./build.ts` (in `apps/desktop`)

### Step 17: Restore browser-safe desktop build after managed-env reset fixes

- Fixed the browser-safe `@nile/core/models/connection/requirements` entry so it no longer imports the broad `models/agent` barrel:
  - `packages/core/src/models/connection/Requirements.ts`
- Narrowed the internal dependency to:
  - `../agent/Capabilities`
  - `../agent/Types`
  instead of `../agent`, which had been pulling in `models/agent/Homes.ts` and its `node:fs/node:os/node:path` runtime into the renderer bundle.
- Confirmed the regression source was the browser bundle path, not Electron main/preload:
  - `apps/desktop/src/renderer/shared/ApplyRequirements.ts`
  - `apps/desktop/src/state/connection/List.ts`
  can safely keep consuming `@nile/core/models/connection/requirements` now that the subpath is truly browser-safe again.

### Verification

- `node --import tsx ./build.ts` in `apps/desktop`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/OpenClaw.test.ts apps/desktop/src/electron/environment/Shell.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/environment/Source.test.ts`
- `npm run typecheck`

### Step 18: Remove dead compatibility shells

- Deleted `apps/desktop/src/electron/types.ts`, which had become an unused compatibility re-export layer after the bridge contracts were split by domain.
- Deleted `apps/cli/src/formatters.ts`, which only re-exported `formatAgentLabel` with no added semantics and violated the repository rule against exact alias re-exports.
- Updated CLI callers to import `formatAgentLabel` directly from:
  - `@nile/core/models/agent/types`

### Verification

- `npm run typecheck`

### Step 15: Refine managed shell environment syncing

- Narrowed the default POSIX shell bridge to the minimum common login entrypoints:
  - `.zprofile`
  - `.bash_profile`
  - `.profile`
- Kept fish support through the generated `conf.d` script without adding extra profile-source blocks.
- Hardened the generated POSIX profile block with a `NILE_SWITCHER_MANAGED_ENV_LOADED` guard so repeated sourcing in one shell session does not repeat the same Keychain lookups.
- Preserved empty user profile files when removing Nile-managed blocks instead of deleting the files outright.
- Added batch startup reconciliation for managed API-key exports:
  - `ManagedApiKeyEnvironment.syncForSession(...)` now rewrites the shell bridge once per session sync instead of once per saved connection
  - per-connection metadata rollback remains in place when a managed env write fails
  - shell bridge write failures are reported as warnings instead of blocking desktop startup
- Strengthened shell bridge verification:
  - `Shell.test.ts` now runs the generated POSIX script in `/bin/sh` with a fake `security` executable
  - added coverage for preserving empty profile files
  - added managed-env batch sync coverage in `ManagedApiKeyEnvironment.test.ts`

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/Shell.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/environment/Source.test.ts`
- `npm run typecheck`

### Step 16: Preserve still-referenced Nile env keys across reset/startup

- Investigated a remaining terminal warning after reset:
  - `~/.nile-switcher/switcher.sqlite` was empty
  - `~/.openclaw/openclaw.json` still contained a Nile-managed provider reference
  - reset had removed the backing `NILE_*` env and shell bridge anyway
  - so OpenClaw kept complaining about a missing env var on every terminal start
- Changed the policy from “prune stale Nile-managed OpenClaw config” to “preserve managed env keys that local agent config still references”.
- Added `DesktopOpenClawEnvironmentReader` to read `NILE_*` env references from Nile-managed OpenClaw providers without mutating the config.
- Wired this into desktop lifecycle:
  - reset cleanup now keeps managed env keys that OpenClaw still references
  - desktop startup reconciliation now unions saved-connection env keys with OpenClaw-referenced env keys before rebuilding the shell bridge
  - startup no longer deletes Nile-managed OpenClaw provider config just because the workspace database is empty
- Added coverage for:
  - reading managed env keys from `openclaw.json`
  - preserving externally referenced env keys during batch shell sync

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/OpenClaw.test.ts apps/desktop/src/electron/environment/Shell.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/environment/Source.test.ts`
- `npm run typecheck`

### Step 10: Repair managed OpenClaw environment bridging

- Confirmed the regression source: desktop was storing managed `NILE_*` API-key values only in Nile's keychain-backed environment store, while OpenClaw provider configs in `~/.openclaw/openclaw.json` referenced those keys as real process env vars.
- Added a zsh login-shell bridge in:
  - `apps/desktop/src/electron/environment/Shell.ts`
  which:
  - maintains `~/.nile-switcher/environment/managed.zsh`
  - keeps a managed key index at `~/.nile-switcher/environment/managed-keys.json`
  - installs/removes a managed source block in `~/.zprofile`
  - reads actual secret values from Keychain at shell startup instead of writing plaintext secrets to disk
- Updated `ManagedApiKeyEnvironment` to:
  - sync shell exports when promoting a direct API key to a managed `NILE_*` env key
  - remove shell exports when deleting managed connection env keys
  - roll back connection metadata and keychain values if shell-bridge setup fails
- Updated `DesktopMain` startup to re-sync managed API-key shell exports for already-saved connections, so existing installs self-heal on next desktop launch without re-importing connections.
- Added regression coverage in:
  - `apps/desktop/src/electron/environment/Shell.test.ts`
  - `apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts`

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/Shell.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/environment/Source.test.ts`
- `npm run typecheck`

### Step 11: Soften managed shell bridge startup behavior

- Broadened the managed environment shell bridge from a single zsh login profile to common shell startup targets:
  - POSIX profiles: `.zprofile`, `.zshrc`, `.bash_profile`, `.bashrc`, `.profile`
  - fish: `.config/fish/conf.d/nile-switcher-managed.fish`
- Split the bridge into:
  - a POSIX script at `~/.nile-switcher/environment/managed.sh`
  - a fish-native script at `~/.config/fish/conf.d/nile-switcher-managed.fish`
  while keeping secrets in Keychain and only resolving them at shell startup
- Changed desktop startup managed-env reconciliation to warn per connection instead of failing app startup if a shell/profile sync step fails.
- Narrowed `ManagedApiKeyEnvironment` internals so metadata promotion and managed shell export reconciliation are clearer, while keeping rollback behavior unchanged.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/Shell.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/environment/Source.test.ts`
- `npm run typecheck`

### Step 12: Remove remaining legacy live-setup and OpenClaw model seams

- Removed the last runtime `openclawModelId` seam from source code and tests:
  - CLI add/selection flows now use a generic `selectedModelId` handoff while still honoring the existing `--openclaw-model-id` flag
  - OpenClaw tests now persist selected models through `AgentConnectionSettings` instead of smuggling model ids through access-record inputs
- Finished the internal naming cleanup from `current-state` to `live-setup` by renaming remaining detected-state types:
  - `CodexDetectedLiveSetup`
  - `ClaudeDetectedLiveSetup`
  - `CursorDetectedLiveSetup`
  - `OpenClawDetectedLiveSetup`
  and rewired detector/index exports accordingly.
- Removed the last obvious test-only `current-state` temp-path naming leftovers in live-setup and import tests.
- Fixed a follow-on regression in `SqliteAccessStore.insert(...)` where the `accesses` insert statement still had a stale placeholder count after earlier access-schema cleanup.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/actions/live-setup/Matcher.test.ts packages/core/src/agents/openclaw/ApplySelection.test.ts packages/core/src/agents/openclaw/RollbackLatestMutation.test.ts packages/core/src/agents/openclaw/live-setup/Detector.test.ts`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Step 10: Finish Phase 2.5 extension seam cleanup

- Clarified the import side-effect transaction boundary in `apps/desktop/src/electron/connections/Imports.ts` by capturing matched-import rollback snapshots from `AgentStatusView` instead of building full onboarding scan items again.
- Promoted connection model handling into a more explicit shared renderer view-model in `apps/desktop/src/renderer/shared/ConnectionModels.ts`:
  - explicit field mode (`hidden` / `select` / `manual`)
  - shared next-selected-model derivation
  - shared preview/message behavior
- Rewired both model-driven UI entrypoints to consume that shared selection state:
  - `apps/desktop/src/renderer/quick-setup/ConnectionDialog.tsx`
  - `apps/desktop/src/renderer/agents/detail/ModelEditor.tsx`
- Documented the intended distinction between:
  - `reconciliationState`
  - `currentConnectionState`
  - `liveConnection`
  in `.vestin/plans/pre-extension-cleanup.md`, and added matching inline comments to desktop state DTOs.
- Tightened the browser-safe core import guard in `apps/desktop/src/renderer/CoreImportBoundaries.test.ts` so browser-safe sources now allow only a small explicit runtime whitelist of `@nile/core` imports instead of merely banning two broad barrels.
- Marked all `Phase 2.5` checklist items complete in `.vestin/plans/pre-extension-cleanup.md`.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/CoreImportBoundaries.test.ts`
- `npm run typecheck`

### Step 11: Finish Phase 3 extension guardrails

- Added a concrete "New Agent Checklist" section to `.vestin/plans/pre-extension-cleanup.md` so future agent work has one explicit minimal path:
  - agent definition
  - capability registration
  - adapter wiring
  - reconciliation participation
  - shared compatibility policy
  - requirement kinds
  - model-catalog split
  - browser-safe renderer boundaries
- Added capability registration coverage to `packages/core/src/models/agent/Capabilities.test.ts`, backed by `AgentCapabilities.listConfiguredAgentIds()`, so any newly supported agent must register an explicit capability entry.
- Added `packages/core/src/models/connection/Architecture.test.ts` with two static guards:
  - shared-connection onboarding/import/saved flows must continue to reference `SHARED_CONNECTION_AGENT_POLICY`
  - renderer apply/switch flows must not reintroduce hardcoded agent-id branching
- Marked all `Phase 3` checklist items complete in `.vestin/plans/pre-extension-cleanup.md`.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/agent/Capabilities.test.ts packages/core/src/models/connection/Architecture.test.ts apps/desktop/src/renderer/CoreImportBoundaries.test.ts`
- `npm run typecheck`

### Step 13: Remove the last user-facing OpenClaw model naming seam

- Renamed the CLI-facing selected-model flag from `--openclaw-model-id` to the generic `--model-id` across:
  - `apps/cli/src/commands/ConnectionAddFlow.ts`
  - `apps/cli/src/commands/ConnectionAgentSelectionFlow.ts`
  - `apps/cli/src/CliCatalog.ts`
  - `apps/cli/src/NileCli.test.ts`
- Removed the remaining `openclaw_model_id` schema legacy instead of preserving old-database compatibility:
  - deleted the historical `version: 2` access migration from `packages/core/src/models/access/SqliteAccessStore.ts`
  - removed the one-time legacy OpenClaw model migration from `packages/core/src/models/agent-settings/SqliteStore.ts`
- Kept only the forward-looking schema assertion in `packages/core/src/models/agent-settings/Settings.test.ts`:
  - fresh access schemas must not contain `openclaw_model_id`

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/agent-settings/Settings.test.ts`
- `npm run typecheck`

### Step 14: Improve developer extension workflow

- Fixed the CLI vitest environment so workspace tests resolve `@nile/core` and `@nile/host-local` directly to source instead of fragile `dist` chunks:
  - `vitest.config.ts`
- Added human-facing extension docs under `docs/development/`:
  - [add-agent.md](../../docs/development/add-agent.md)
  - [add-connection-family.md](../../docs/development/add-connection-family.md)
- Added a minimal core agent scaffold generator:
  - `scripts/scaffold-agent.mjs`
  - `npm run scaffold:agent -- --id <agent-id> --label <Agent Label> [--dry-run]`
- Tightened CLI agent selection defaults so non-interactive add flows no longer auto-enable agents that require a selected model unless the caller explicitly provides one:
  - `apps/cli/src/commands/ConnectionAgentSelectionFlow.ts`
- Updated CLI status/add tests to current reconciliation/live-model semantics:
  - `apps/cli/src/NileCli.test.ts`

### Verification

- `./node_modules/.bin/vitest run apps/cli/src/NileCli.test.ts`
- `./node_modules/.bin/vitest run packages/core/src/models/agent-settings/Settings.test.ts`
- `node ./scripts/scaffold-agent.mjs --id gemini --label Gemini --dry-run`
- `npm run typecheck`

### Step 9: Phase 2.5 local-setup view-model cleanup

- Added `apps/desktop/src/renderer/shared/LocalSetup.ts` as the shared local-setup view-model/presenter for:
  - section primary/secondary text
  - badge label
  - saved/new/unavailable action kind
  - quick setup guide content
- Renamed desktop onboarding DTO usage to explicit `reconciliationState` semantics in:
  - `apps/desktop/src/state/Types.ts`
  - `apps/desktop/src/state/SettingsQuery.ts`
- Split `DetectedSetupSection` into:
  - `DetectedSetupContent.tsx`
  - `DetectedSetupAction.tsx`
  - `DetectedSetup.tsx`
  so the wrapper now only manages transient save state and delegates rendering/action decisions.
- Reused the shared presenter from both:
  - quick setup
  - agent list local-setup cards
  to reduce copy/state drift before future agent expansion.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts packages/core/src/actions/local-setup/Status.test.ts`
- `npm run typecheck`
