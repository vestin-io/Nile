# Desktop V2 Build Log

## 2026-06-02

### Review follow-up for session reauthentication

- Routed the new desktop `Reauthenticate` action through the existing encrypted-local unlock recovery and action-error reporting flow instead of calling the connection update path bare.
- Restored localized list-summary behavior for generic unavailable quota states, while keeping the dedicated `Reauthentication required` label for `credential_unauthorized`.
- Added a focused regression assertion so generic unavailable usage summaries do not leak raw English backend messages into translated renderer surfaces.

#### Key findings

- The first reauthentication pass had the right mutation target but skipped the renderer's existing recovery wrapper, which meant locked encrypted-local storage and interactive-login failures could surface as unhandled action failures.
- The longer quota error detail still belongs in the connection detail alert and usage panel. The compact list summary should stay localized unless the state is the explicit reauthentication CTA.

### Verification

- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run apps/desktop/src/renderer/shared/DisplayText.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts apps/desktop/src/state/UsageSummary.test.ts apps/desktop/src/state/UsageCache.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

## 2026-06-01

### OpenAI add-connection default session source regression

- Fixed the desktop add-connection form so `openai_session` now actually defaults to `current_codex` when the auth mode becomes active, instead of silently keeping the form's generic initial `login` source.
- Extracted the session-source normalization into a pure helper so auth-mode changes can explicitly prefer the mode default while still preserving valid user selections after that.
- Added a focused regression test that covers:
  - OpenAI session auth switching to `current_codex`
  - incompatible carried-over session sources falling back to the target auth mode default

#### Key findings

- The regression was in renderer form state, not in Codex session detection or OAuth execution. The method catalog already ordered `current_codex` before `login`, but the form initialized `sessionSource` to `login` and then preserved that value because it was still considered valid.
- Local Codex auth on this machine was healthy during the investigation: `~/.codex/auth.json` contained a valid OpenAI session for `jay.ji@spotto.ai`, so the unexpected browser sign-in prompt came from the wrong default branch, not from a missing local session.

### Verification

- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run apps/desktop/src/renderer/connections/add/useForm.test.ts`

### Session reauthentication UX for connection quota errors

- Stopped automatic desktop quota refresh from launching interactive session recovery on its own:
  - automatic usage refresh now reads connection quota with `recoverUnauthorizedCurrentSession: false`
  - manual refresh paths still allow interactive reauthentication when the user explicitly asks for it
- Preserved `credential_unauthorized` usage failures in desktop state instead of collapsing them to `unknown`, so session-backed connections can surface an actionable auth problem.
- Added an explicit connection-level reauthentication path in the desktop UI:
  - connection detail now shows a destructive alert when the current saved connection needs reauthentication
  - the detail action bar now offers `Reauthenticate` for interactive session-backed connections
  - the action reuses the existing `updateConnection({ sessionSource: "login" })` path instead of adding a second auth mutation surface
- Shortened list/detail summary text for this state to a concise `Reauthentication required` label while keeping the longer provider-specific error message in the detail alert.

#### Key findings

- The unwanted browser login was not only an OpenAI session issue; it came from a deeper policy problem: startup auto-refresh and explicit user-triggered refresh were sharing the same unauthorized-recovery behavior.
- Reusing the existing connection update path is the right shape here. The missing piece was state visibility and a clear user-owned entry point, not another login-specific IPC contract.
- This pass intentionally keeps the explicit reauthentication CTA in connection detail rather than adding another clickable control into every list row. The list now exposes the auth problem clearly; the detail page owns the action.

### Verification

- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run apps/desktop/src/state/UsageSummary.test.ts apps/desktop/src/state/UsageCache.test.ts apps/desktop/src/renderer/shared/DisplayText.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts`
- `npm run typecheck`

## 2026-05-27

### Codex login and runtime-path regression cleanup

- Fixed the Codex CLI resolver so login execution and UI display no longer share the same path semantics:
  - login execution still resolves to the packaged vendor binary
  - desktop/runtime surfaces keep showing the user-facing launcher path
- Tightened Codex auth parsing so auth payloads with both `OPENAI_API_KEY` and session `tokens` are treated as OpenAI sessions first instead of stalling session login polling.
- Fixed Windows detached-login environment setup for Claude and Gemini by deriving `HOME` with win32 path rules during simulated Windows flows.
- Updated the affected regression fixtures:
  - Codex current-credential test now uses a silent logger explicitly
  - builtins runtime Codex fixture now makes the resolved vendor binary executable and functional
  - SavedConnections expectations now include the stable default `credentialStorageBackend`

#### Key findings

- The original Codex resolver bug was real: any plain `bin/codex` launcher could be mistaken for the packaged binary just because the basename matched `codex`.
- Using the same resolved path for “what Nile should execute” and “what the UI should show” was the wrong abstraction. Those are related but not identical values.
- The Windows `HOME` regressions were not platform-runtime bugs on Windows itself; they came from using host-platform `path.dirname(...)` while unit tests simulated win32 paths on macOS.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/SavedConnections.test.ts packages/agents/codex/src/CodexSessionLogin.test.ts packages/agents/claude/src/ClaudeSessionLogin.test.ts packages/agents/gemini/src/GeminiSessionLogin.test.ts`
- `./node_modules/.bin/vitest run packages/builtins/src/runtime/NileSession.test.ts packages/agents/codex/src/live-setup/CurrentCredentialReader.test.ts`
- `./node_modules/.bin/vitest run packages/agents/codex/src/CodexSessionLogin.test.ts packages/builtins/src/runtime/NileSession.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run verify:pre-push`

### Quick setup duplicate saved-connection display cleanup

- Reused the shared local-setup visibility rule inside the quick-setup agent cards.
- `QuickSetupAgentCard` now hides detected setups whose reconciliation state is already `already_saved`, so the same saved Gateway/API-key setup no longer appears both in Quick Setup and the Connections list.
- Added a focused shared-presenter regression test covering:
  - `already_saved` detected setups stay hidden from actionable surfaces
  - `new` detected setups remain visible

#### Key findings

- The underlying data was not duplicated. Quick Setup and Connections were rendering the same saved setup through different state slices.
- The inconsistency came from the quick-setup surface bypassing `LOCAL_SETUP_PRESENTATION.shouldShowDetectedSetup(...)` while the agent list already used it.
- This change is intentionally narrow: it removes the duplicate saved-setup presentation without changing connection storage, reconciliation, or import behavior.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/shared/LocalSetup.test.ts apps/desktop/src/renderer/shared/DisplayText.test.ts`
- `npm run build -w @nile/desktop`

### Desktop state review follow-up cleanup

- Removed the backend-agnostic managed-environment cache bug from `DesktopEnvironmentStore`:
  - reads/writes now re-resolve the active backend
  - in-memory cache is cleared automatically when desktop storage mode flips between system store and encrypted-local file store
- Removed the one-shot `nextSettingsUsageRefreshMode` side channel from desktop state refresh:
  - `desktop:refresh-settings` now returns the manually refreshed `SettingsState` directly
  - renderer refresh flow consumes that returned state instead of immediately issuing a second generic `getSettingsState()` read
  - manual usage-refresh intent now stays attached to the same request path instead of leaking through ambient mutable state
- Replaced the managed-shell-environment heuristic with an explicit agent capability:
  - added `requiresManagedApiKeyShellEnvironment` to agent declarations/capabilities
  - `ManagedApiKeyEnvironment` now reads that capability directly instead of inferring shell mirroring from `selected-model`

#### Key findings

- The previous manual-refresh mode plumbing was functionally correct in the happy path, but it depended on request timing. Returning refreshed state directly from the IPC mutation is a much clearer boundary.
- `supportsManagedEnvBackedApiKey` and “needs shell env mirror” are separate concerns. Treating one as a proxy for the other was the kind of silent coupling that would break as soon as a new agent landed.
- Automatic usage-refresh pause state is still process-local. This cleanup fixes the in-session behavior and removes the worst feedback loops, but it does not yet persist paused connections across app restarts.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/Store.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/state/UsageCache.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/renderer/app/settings/DataLoader.test.ts packages/core/src/models/agent/registry/Capabilities.test.ts`
- `npm run typecheck`
- `npm run build -w @nile/desktop`

### Usage auto-refresh circuit breaker

- Changed desktop usage refresh behavior so failing connections no longer stay in the automatic background refresh queue forever.
- `DesktopUsageCache` now pauses auto refresh for a connection after a failed quota read, including current-session failures that would otherwise keep retrying from menubar/settings refresh loops.
- Manual refresh paths now carry an explicit `manual` usage refresh mode from IPC through the desktop state layer:
  - `desktop:refresh-settings`
  - `desktop:refresh-status-entry`
- A manual refresh attempt can probe paused connections again, and only successful reads re-enable future automatic refresh for that connection.
- Automatic menubar follow-up refreshes now also check whether the current connection is auto-refresh-eligible before scheduling another background usage refresh.

#### Key findings

- The important boundary here is not “cache vs no cache”; it is “automatic background work vs explicit user intent”. Once a connection starts failing in a way that is noisy or interactive, background refresh must stop assuming it is safe to keep retrying.
- Re-enabling auto refresh on any manual attempt would still be too eager. The connection only returns to the auto queue after a successful manual read.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/UsageCache.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`
- `npm run build -w @nile/desktop`

### Packaged desktop state refresh loop fix

- Investigated the macOS packaged-app lag regression using the local `~/.nile-switcher/logs/app.log` output instead of renderer errors, because the app was slow without crashing.
- The hot path was repeated desktop state rebuild work:
  - `menubar-state`
  - `menubar-usage-refresh`
  - `settings-state`
- Root cause was a desktop self-trigger loop, not a single failing connection:
  - `DesktopStateStore` persisted status/settings snapshots into `desktop_state_snapshots`
  - those writes touched `switcher.sqlite`
  - `DesktopWorkspaceWatcher` watches `switcher.sqlite`, `-wal`, and `-shm`
  - the packaged app then invalidated and rebuilt desktop state again from its own snapshot write traffic
- Fixed `DesktopStateSnapshotStore` so it now skips SQLite upserts when the snapshot payload and version are unchanged.
- Added regression coverage proving identical snapshot writes no longer rewrite the row.

#### Key findings

- The visible lag was amplified by quota-read noise (`Unsupported quota auth mode: api_key` and expired Gemini session refresh attempts), but those log lines were secondary. The main responsiveness regression came from the watcher reacting to unchanged app-owned snapshot writes.
- This fix intentionally does not change the existing Gemini/current-session retry behavior or the unsupported API-key quota warning. Those may still deserve follow-up cleanup, but they are no longer allowed to multiply through the snapshot write loop.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/SnapshotStore.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts`
- `npm run build -w @nile/desktop`
- `npm run typecheck`

## 2026-05-06

### Step 79: Expose live agent models in desktop settings state

- Added missing `common.model` translations so the agent detail model UI no longer falls back to the raw key.
- Extended shared current-state/status shapes to carry optional live `modelId` metadata for agents that expose it:
  - Codex reads `model = "..."` from `config.toml`
  - Claude reads `model` from `settings.json`
  - OpenClaw forwards its current primary model
- Updated desktop state assembly so agent connection lists fall back to the live model for the currently active saved connection when no agent-specific model override has been saved yet.
- Kept the storage boundary unchanged:
  - saved `(agent, connection) -> modelId` overrides still remain the explicit persisted source
  - live model fallback only fills the current settings view
- Result:
  - current Codex agent connections now show the real active model without requiring a manual model save first
  - shared model UI keeps working for explicit per-agent overrides

### Verification

- `npm run typecheck`

### Windows tray popup unification

- Reworked Windows tray interaction into a single styled popup instead of split left-click summary and right-click native menu:
  - both left and right click now open the same tray popup on Windows
  - the popup shows agent quota summaries on the first layer
  - connection switching now lives inside expandable agent cards in the popup
  - `Open app`, `Refresh`, and `Quit` are available directly from the popup
- Refreshed the Windows tray popup presentation to a dedicated Windows-specific surface instead of the previous unstyled/plain menu-like view.
- Hid the Windows `Tray` display-mode selector in Settings because `App entry / Usage summary` was a carryover from the macOS ticker model and no longer matches Windows behavior.
- Removed the old Windows-only native summary-menu path so desktop tray behavior no longer splits between two menu systems.

#### Key findings

- I did not add a new `show tray / hide tray` preference in this pass. The old display-mode selector was misleading on Windows, but tray visibility itself is still not modeled as a separate persisted setting.
- The underlying status-entry display store remains in place because macOS ticker behavior still depends on it, and Windows tooltip/title compatibility still reads from the same shared state.

### Verification

- `npx vitest run apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/renderer/shared/Platform.test.ts`
- `npx vitest run apps/desktop/src/electron/shell/PlatformCapabilities.test.ts apps/desktop/src/electron/shell/TrayPopupPlacement.test.ts`
- `npm run build -w @nile/desktop`
- `npm run typecheck`

### Settings usage cache pollution fix

- Investigated the remaining `jiqiang90@gmail.com` quota gap with desktop logs and the persisted `desktop_state_snapshots` rows.
- Confirmed the OpenAI session itself still returns live quota when read directly after unlocking encrypted local storage:
  - `jay.ji@spotto.ai`: available
  - `jiqiang90@gmail.com`: available
- Root cause was not the quota reader itself. It was the desktop state cache boundary:
  - `refreshDesktopState()` refreshes status-entry usage first
  - `evaluateAlerts()` then called `getSettingsState({ refreshUsage: false })`
  - that partial settings read was being written into the main cached `settingsState`
  - a later renderer `getSettingsState()` reused that cached/in-flight partial result, so only the current connection had quota while non-current connections stayed `Unknown`
- Fixed `DesktopStateStore.getSettingsState({ refreshUsage: false })` to bypass the main settings cache instead of poisoning it.
- Added a regression test that proves a partial `refreshUsage: false` read no longer satisfies a later live `getSettingsState()` call.

### Key findings

- The earlier `DesktopUsageCache` retry fix was necessary but not sufficient. The stale `Unknown` state here came from partial settings-state caching, not from the per-connection usage TTL alone.
- The persisted `settings_state` snapshot on disk was showing the exact bad shape we saw in UI:
  - current OpenAI connection had live usage
  - secondary saved OpenAI connection remained `usage: null`

### Verification

- `npx vitest run apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts`
- `npm run build -w @nile/desktop`

### Windows secure snapshot fallback

- Fixed a Windows-only connection switch/apply regression where mutation-history secure snapshots still defaulted to the macOS keychain helper and failed with `Nile keychain helper was not found`.
- Added a platform secure-snapshot factory in core so default history/reset paths pick the right backend automatically instead of constructing `new SecureSnapshotStore()` everywhere.
- Added a Windows secure snapshot implementation backed by Windows Credential Manager and reused chunked secret storage so large sensitive snapshots still fit within WinCred blob limits.
- Updated the remaining default construction sites to use the platform-aware factory:
  - mutation history
  - workspace binding
  - local state reset
  - Cursor/Gemini rollback flows

#### Key findings

- The regression was not in `desktop:switch-connection` itself. Desktop already used the correct Windows credential backend for saved connections, but the separate secure-snapshot default still assumed keychain.
- Fixing only the desktop composition root would have left the same regression in other paths that rely on core defaults, so the platform choice was centralized in core instead.
- Linux still follows the pre-existing non-Windows secure snapshot path. This change closes the Windows regression only and does not introduce a new Linux secure-storage backend.

### Verification

- `npx vitest run packages/core/src/services/credential/WindowsCredentialManagerStore.test.ts packages/core/src/services/history/WindowsSecureSnapshotStore.test.ts`
- `npm run typecheck`
- `npm run build -w @nile/desktop`

### Status-entry presenter extraction

- Started the cross-platform desktop status-entry refactor from the smallest reusable layer instead of renaming `MenubarState` first.
- Extracted a shared status summary presenter for:
  - selected ticker agent resolution
  - ticker title formatting
  - per-agent quota summary text
  - Windows tray tooltip summary text
- Added a minimal desktop platform capability helper in the Electron shell layer so native entry behavior can branch on declared capabilities instead of sprinkling ad hoc platform checks through menu/summary formatting.
- Kept the current tray/menu structure intact for now:
  - macOS still uses the existing title ticker path
  - Windows now gets a tray tooltip summary using the shared presenter on top of the already cross-platform tray
- Reused the presenter inside `TrayMenu` quota rows so ticker and tray summary formatting no longer duplicate usage-summary selection logic.
- Platformized the desktop settings status-entry copy without changing the stored `menubarDisplay` shape:
  - macOS keeps `Menu bar` / `Ticker`
  - Windows now shows `Tray` / `Usage summary`
  - unsupported platforms no longer show a dead status-entry display section in settings
- Platformized the tray quota toggle copy through the same renderer platform helper so Windows no longer shows `Show in ticker` in the native tray menu.
- Rewrote the focused tray-menu unit test file with clean UTF-8 literals while touching this area so future platform-copy assertions do not keep depending on mojibake text artifacts.

#### Key findings

- The existing Electron tray is already cross-platform; the main macOS-only behavior was the tray title ticker, not tray existence itself.
- Doing the shared presenter extraction first gave a real Windows-visible MVP without forcing a noisy rename of the current `MenubarState` types.
- This batch intentionally does not add a Windows popup yet. Tooltip summary is the first low-risk delivery on top of the current tray shell.
- The cross-platform status-entry copy now covers both the settings surface and the tray quota toggle, while the persisted state shape still intentionally keeps the legacy `menubarDisplay` naming for now.

### Verification

- `npx vitest run apps/desktop/src/electron/shell/TickerTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/PlatformCapabilities.test.ts`
- `npm run build -w @nile/desktop`

### Status-entry internal naming follow-up

- Renamed the internal query/presenter layer from macOS-specific terms to neutral status-entry names:
  - `DesktopMenubarStateQuery` -> `DesktopStatusEntryStateQuery`
  - `DesktopTrayTickerTitle` -> `DesktopStatusEntryTitle`
- Moved the corresponding files and tests onto the new names so new desktop work no longer has to extend `MenubarQuery` / `TickerTitle`.
- Kept the public compatibility boundary unchanged for now:
  - IPC still exposes `getMenubarState`
  - desktop-local persistence still uses `desktop_menubar_*` tables
  - shared state shapes still use `MenubarState` / `DesktopMenubarDisplayState`

#### Key findings

- This batch intentionally stops at the internal composition layer. Renaming persisted SQLite tables, preload contracts, and renderer/main IPC payloads would widen the upgrade surface and needs to be handled as a separate compatibility pass.
- The query/title rename is still worthwhile even without touching the persistence boundary because it gives new platform work a neutral place to land instead of extending more `menubar` and `ticker` classes.

### Verification

- `npx vitest run apps/desktop/src/state/StatusEntryQuery.test.ts apps/desktop/src/renderer/shared/Platform.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/PlatformCapabilities.test.ts`
- `npm run build -w @nile/desktop`

### Status-entry display store naming follow-up

- Renamed the Electron-side display preference store onto a neutral internal name:
  - `DesktopMenubarDisplayStore` -> `DesktopStatusEntryDisplayStore`
  - `MENUBAR_DISPLAY_MODES` -> `STATUS_ENTRY_DISPLAY_MODES`
  - `DesktopMenubarDisplayMode` / `DesktopMenubarDisplayState` -> `DesktopStatusEntryDisplayMode` / `DesktopStatusEntryDisplayState`
- Updated the internal shell/state consumers to read the new store/type names while keeping the user-facing and persistence compatibility edges unchanged:
  - IPC method names still use `getMenubarDisplay`, `setMenubarDisplayMode`, and `toggleMenubarTickerAgent`
  - SQLite tables still use `desktop_menubar_*`
  - the stored payload still keeps `hasConfiguredTickerAgents` / `tickerAgentIds`

#### Key findings

- Renaming the store and its immediate types gives new desktop work a neutral state-layer entry point without forcing an upgrade-sensitive migration of tables or preload contracts in the same batch.
- The remaining legacy field names inside the stored payload are now the next obvious cleanup seam. Changing them will need a more deliberate compatibility pass than this internal rename did.

### Verification

- `npx vitest run apps/desktop/src/electron/state/StatusEntryDisplayStore.test.ts apps/desktop/src/state/StatusEntryQuery.test.ts apps/desktop/src/renderer/shared/Platform.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/PlatformCapabilities.test.ts`
- `npm run build -w @nile/desktop`

### Renderer status-entry naming follow-up

- Renamed the renderer settings-state surface from `menubarDisplay*` props/handlers to `statusEntryDisplay*` across:
  - the settings app container
  - page-content prop plumbing
  - the general settings page
- Replaced the old `useMenubarDisplay` wrapper with the already-neutral `useStatusEntryDisplay` hook and removed the now-dead wrapper file.
- Kept the concrete macOS-only detached entry window in `renderer/app/menubar.ts` untouched; this batch only neutralizes the shared settings/status-entry UI path.

#### Key findings

- The renderer tree now uses status-entry terminology for the shared display-mode flow, but the underlying preload compatibility methods still intentionally expose both `getMenubarDisplay` and `getStatusEntryDisplay`.
- `renderer/app/menubar.ts` still uses the old naming because it is the specific macOS menubar surface, not the cross-platform status-entry settings path.

### Verification

- `npm run build -w @nile/desktop`

### Agent card switch loading feedback

- Added visible in-card switching feedback on the Agents list so a connection change no longer looks idle while the backend apply flow is still running:
  - the card now picks up a transient active border without a page-level blocker
  - the current-connection selector shows the pending target immediately, swaps its chevron for a spinner, and runs a subtle in-control shimmer until the switch settles
  - the card shows an inline `Switching` status row and a loading skeleton for usage while the refresh catches up
- Tightened the shared switch flow so renderer pending state stays alive until the agent state actually reports the new current connection:
  - `switchingConnectionId` is now cleared by observing `agent.currentConnection.id`, not immediately after `onSwitch()` resolves
  - failed switch attempts still clear the pending state immediately
- This change applies to both the card list and the detail connections view because both surfaces share `useConnectionSwitchFlow.ts`.

#### Key findings

- I kept the animation intentionally light and local to the selector. This pass improves perceived responsiveness without adding a full-screen blocker or introducing new timing heuristics in the renderer.
- The pending selector value is optimistic for the duration of the switch. That is deliberate: the user sees which connection is being activated even before the refreshed current connection snapshot arrives.

### Verification

- `npm run typecheck`

### Usage refresh cadence

- Increased the default desktop usage cache TTL and auto-refresh cadence from `60s` to `5m`.
- This keeps the startup refresh behavior intact, but reduces steady-state background usage polling for idle desktop sessions.

#### Key findings

- The desktop auto-refresh timer already derives its interval from `DesktopUsageCache.readCacheTtlMs()`, so changing the cache TTL updates both freshness checks and the periodic background refresh cadence in one place.
- Existing desktop usage refresh tests already read the cadence dynamically instead of hardcoding `60_000`, so no test fixture rewrite was needed for this change.

### Verification

- Code path review only; no behavioral test changes were required because cadence-sensitive tests already depend on `DesktopUsageCache.readCacheTtlMs()`.

### Step 48: Release CI Cursor Env Credential Precedence Fix

- Fixed the remaining desktop release CI failure in `apps/cli/src/NileCli.test.ts` for `imports the current cursor live state as a connection`.
- Updated `packages/agents/cursor/src/live-setup/Reader.ts` so `CURSOR_API_KEY` is resolved before any keychain read.
- This removes the hidden dependency on the macOS `security` CLI when Cursor live state is already fully provided by environment-backed API key credentials.
- Added a regression test in `packages/agents/cursor/src/live-setup/Reader.test.ts` that proves env-backed Cursor import still succeeds even when keychain reads are unavailable.

#### Key findings

- The CI-only failure was not a Cursor import semantic mismatch. It was a platform assumption leak: the reader consulted macOS keychain state before checking the explicit env credential used by the test.
- Local macOS runs masked the bug because `security` exists, while Ubuntu release runners exposed it immediately.
- The fix intentionally keeps session/keychain probing unchanged for non-env paths; it only removes the unnecessary keychain dependency when `CURSOR_API_KEY` is already present.

### Verification

- `./node_modules/.bin/vitest run packages/agents/cursor/src/live-setup/Reader.test.ts`
- `./node_modules/.bin/vitest run apps/cli/src/NileCli.test.ts --testNamePattern "imports the current cursor live state as a connection"`
- `npm run test:core`
- `npm run test:cli`

### Step 49: Release CI Desktop Agent Import Case Fix

- Fixed the next desktop release CI failure after the Cursor import patch.
- The failing desktop tests still imported browser-safe core agent helpers through lowercase package subpaths like `@nile/core/models/agent/definitions` and `@nile/core/models/agent/capabilities`.
- On local macOS this kept working because the filesystem is case-insensitive, but the Ubuntu release runner resolved those imports through the workspace source tree and failed on exact case.
- Updated the desktop state and renderer modules to import the real source-case browser-safe entrypoints instead:
  - `@nile/core/models/agent/Definitions`
  - `@nile/core/models/agent/registry/Capabilities`
- Updated the browser-safe import boundary test to allow the exact-case source entrypoints that the desktop app now relies on in workspace runs.

#### Key findings

- The release failure was not another missing build artifact. It was a workspace-resolution mismatch between public lowercase package exports and source-file case on Linux.
- I intentionally did not add lowercase shim source files under `packages/core/src/models/agent`. On a case-insensitive macOS worktree those shims alias with the existing `Definitions.ts` / `Ids.ts` / `Homes.ts` files and create unstable local behavior.
- The desktop app still uses the same browser-safe surface; only the import specifiers changed to the exact source-case paths that the workspace resolver can load on Linux.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/CoreImportBoundaries.test.ts apps/desktop/src/state/DesktopPreferences.test.ts apps/desktop/src/state/SettingsQuery.test.ts apps/desktop/src/state/StatusEntryQuery.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run test:desktop`

### Settings data loader cleanup

- Split the bridge-reading strategy out of the settings data hook:
  - `renderer/app/settings/DataLoader.ts` now owns snapshot reads, live refresh reads, and the shared supplementary-data fetch
  - `useData.ts` now focuses on request-id ordering, mounted guards, React state updates, and desktop event subscription
- Added narrow loader tests to lock the two read modes:
  - snapshot mode returns the settings snapshot first and exposes the follow-up read separately
  - refresh mode reads live settings state together with history/definitions
  - refresh forwarding stays a direct bridge call

#### Key findings

- This pass intentionally did not change the request cancellation model in `useData.ts`; stale-request suppression still lives in the hook via `requestIdRef` and mounted checks.
- `useData.ts` is only slightly shorter in raw lines because the hook still owns lifecycle wiring, but the bridge-fetch policy is now isolated and directly testable. The new split is `useData.ts` at 162 lines and `DataLoader.ts` at 64 lines.

### Verification

- `npx vitest run apps/desktop/src/renderer/app/settings/DataLoader.test.ts apps/desktop/src/renderer/app/settings/ConnectionInput.test.ts apps/desktop/src/renderer/app/settings/ConnectionMutation.test.ts apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `npx tsc -p tsconfig.renderer.json --noEmit`
- `npx tsc -p tsconfig.node.json --noEmit`
- `npm run build -w @nile/desktop`

### Agent Windows login fallback

- Added a Windows-specific detached-terminal fallback for desktop interactive sign-in:
  - `packages/agents/claude/src/ClaudeSessionLogin.ts` now opens a new `cmd.exe` window on `win32` instead of trying to use `osascript`
  - `packages/agents/gemini/src/GeminiSessionLogin.ts` now does the same for Gemini CLI sign-in on `win32`
- Kept existing macOS behavior unchanged:
  - macOS still opens Terminal via AppleScript when no attached terminal is available
  - attached-terminal behavior still runs the CLI directly
- Added regression coverage for both preserved macOS behavior and new Windows behavior:
  - `packages/agents/claude/src/ClaudeSessionLogin.test.ts`
  - `packages/agents/gemini/src/GeminiSessionLogin.test.ts`

#### Key findings

- I did not add broad Windows `homeCandidates` in this pass. After reviewing the current agent implementations, the clearer defect was the `osascript` desktop-login fallback in Claude and Gemini. Several agents already use dot-home directories as their user-state location on Windows, so inventing `AppData` candidates without source-of-truth evidence would have been riskier than leaving the manifests alone.
- This fixes the Windows desktop sign-in gap for agents that actually expose `interactiveSessionLogin`. It does not add a new desktop-initiated login path for agents like Cursor or OpenClaw that currently rely on import/current-local-state flows instead.

### Verification

- `npx vitest run packages/agents/claude/src/ClaudeSessionLogin.test.ts packages/agents/gemini/src/GeminiSessionLogin.test.ts`
- `npx tsc -p tsconfig.node.json --noEmit`
- `npm run build -w @nile/desktop`

### Settings connection action cleanup

- Split the duplicated desktop connection input mapping out of the settings action hook:
  - `renderer/app/settings/ConnectionInput.ts` now owns `AddConnectionSubmitInput -> DesktopAddConnectionInput`
  - `useConnectionActions.ts` reuses the same builder for both `addConnection()` and `prepareConnectionDraft()`
- Split the add/save completion follow-up out of the hook:
  - `renderer/app/settings/ConnectionMutation.ts` now owns reused-connection dialog staging and post-save navigation target application
  - `useConnectionActions.ts` now stays focused on bridge calls, unlock retry, and action-level decisions
- Added narrow renderer tests for both extracted responsibilities:
  - `ConnectionInput.test.ts`
  - `ConnectionMutation.test.ts`

#### Key findings

- This pass intentionally did not change the unlock retry/error mapping flow in `useConnectionActions.ts`; it only removed repeated payload construction and repeated completion-target logic.
- `useConnectionActions.ts` is still an orchestrator, but it is narrower now: the hook dropped from 235 lines to 204, and the two pure responsibilities that were easiest to drift are now directly testable.

### Verification

- `npx vitest run apps/desktop/src/renderer/app/settings/ConnectionInput.test.ts apps/desktop/src/renderer/app/settings/ConnectionMutation.test.ts apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `npx tsc -p tsconfig.renderer.json --noEmit`
- `npx tsc -p tsconfig.node.json --noEmit`
- `npm run build -w @nile/desktop`

### Settings page content assembly cleanup

- Split the remaining page-content action assembly out of the thin props hook:
  - `renderer/app/settings/PageContentBuilder.ts` now owns the `SettingsPageContentProps` action wiring
  - `renderer/app/settings/usePageContentProps.ts` is now a small projection wrapper for data fields plus builder output
- Kept `SettingsApp` focused on feature hook composition instead of inline page action construction:
  - `App.tsx` now passes a single `windowActions` collaborator plus state/data inputs
  - removed stale builder inputs that were no longer consumed after the split
- The settings-side orchestration shape is now flatter:
  - `usePageContentProps.ts` is down to 52 lines
  - `App.tsx` is down to 452 lines
  - `DesktopIpcStateRoutes.ts` remains split and stays at 168 lines

#### Key findings

- This was a behavior-preserving cleanup. The only regressions encountered were stale `App.tsx` builder inputs (`reload`, `setRepairUsageConnectionId`) left behind after moving the action assembly.
- The desktop build stayed green even while renderer typecheck caught those stale props, so `tsconfig.renderer` remains the more useful gate for this kind of settings refactor.

### Verification

- `npx tsc -p tsconfig.node.json --noEmit`
- `npx tsc -p tsconfig.renderer.json --noEmit`
- `npm run build -w @nile/desktop`

### Connection path architecture cleanup

- Extracted shared desktop credential-storage write-path behavior into:
  - `electron/connections/StorageSupport.ts`
- Reused that support in both:
  - `electron/connections/DesktopConnectionManager.ts`
  - `electron/connections/DesktopConnectionGateway.ts`
- Unified the behavior that had started to drift:
  - encrypted-local storage preparation before mutations/imports
  - system secure storage denial mapping to the encrypted-local fallback message
- Removed the stale desktop renderer/public `importDetectedSetups` path because it no longer matched the current credential-storage model:
  - dropped it from `preload`, desktop IPC state routes, the desktop renderer bridge contract, and `DesktopStateStore`
  - removed the desktop-only batch-import gateway/import helper branches and their tests
- Added gateway coverage for the previously missing mapped error path:
  - `importCurrentConnection()` now returns the same explicit system-secure-storage fallback error that add/save connection already used

#### Key findings

- The remaining desktop import surface is now the explicit `importCurrentConnection` path. The older batch `importDetectedSetups` desktop bridge had become dead surface after quick setup moved to per-agent save/import flows.
- `npm run build -w @nile/desktop` initially failed once on this machine because `build:core` hit a transient Windows filesystem/export-artifact race (`ENOTEMPTY` / missing built artifact during validation). A sequential rerun passed without code changes, so this was treated as an environment/build-script flake rather than a regression from this patch.

### Verification

- `npx vitest run apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`
- `npm run build -w @nile/desktop`
- `npx tsc -p tsconfig.node.json --noEmit`
- `npx tsc -p tsconfig.renderer.json --noEmit`

### Settings orchestration and state IPC cleanup

- Split settings renderer orchestration support into smaller units:
  - `renderer/app/settings/useWindowActions.ts` now owns the desktop/window side-effect action bundle
  - `renderer/app/settings/PageContentProps.ts` now owns the wide page-content prop contract
- Reduced the central settings files:
  - `renderer/app/settings/App.tsx` now focuses on state assembly and composition instead of inlining the whole action bundle
  - `renderer/app/settings/PageContent.tsx` now focuses on page routing/rendering instead of also owning the full prop schema
- Split `electron/ipc/DesktopIpcStateRoutes.ts` registration into grouped methods:
  - read routes
  - notification routes
  - preference routes
  - mutation routes

#### Key findings

- This pass intentionally did not redesign the settings page architecture. It removed the most obvious concentration points without changing the current settings data flow or page routing model.
- `SettingsApp` is still the main renderer composition root for the desktop settings surface. The file is healthier, but future growth should prefer new hooks/components instead of adding another inline action/config block there.

### Verification

- `npx tsc -p tsconfig.node.json --noEmit`
- `npx tsc -p tsconfig.renderer.json --noEmit`
- `npm run build -w @nile/desktop`

### Windows branch hardening follow-up

- Restored the Windows status-entry configuration path:
  - `state/DesktopPlatform.ts` now exposes the status-entry settings copy for `win32`
  - the settings page can switch Windows between `app_entry` and `summary` again
- Restored access to per-agent Windows summary selection from the tray:
  - `electron/shell/DesktopShell.ts` now keeps left-click for the popup
  - Windows right-click hides the popup and opens the full tray menu again, so the existing `Show in usage summary` toggles are reachable
- Hardened Windows credential manifest parsing:
  - `services/credential/WindowsSecretStore.ts` now converts invalid chunk manifest JSON into `WindowsSecretValidationError` instead of leaking a raw `SyntaxError`
  - that keeps both `WindowsCredentialManagerStore` and `WindowsSecureSnapshotStore` on their intended validation/error-mapping paths
- Fixed desktop connection update error mapping:
  - `DesktopConnectionManager.updateConnection()` now maps storage errors using the saved connection's actual backend instead of a hardcoded `system_secure_storage`
  - the denied-system-storage fallback message is now platform-neutral instead of incorrectly referencing macOS Keychain on Windows

#### Key findings

- I did not add a new `DesktopShell` interaction test for the Windows right-click tray wiring in this pass. The behavior change is small and local, but it is still covered only by code inspection plus the existing tray/menu tests around reachable actions.
- The status-entry selector was implemented in the renderer already; the real break was that the shared platform helper returned `null` for Windows, which silently removed the settings section.
- The Windows manifest bug affected both credential reads and secure history snapshot reads because both paths share `WindowsSecretStore`.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/shared/Platform.test.ts packages/core/src/services/credential/WindowsCredentialManagerStore.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`
- `npm run typecheck`

### Windows desktop architecture cleanup

- Reduced the main-process composition root back under the repository file-size limit:
  - extracted tray/status-entry sync into `electron/shell/StatusEntryController.ts`
  - extracted managed API-key environment startup/reset lifecycle into `electron/shell/ManagedEnvironmentLifecycle.ts`
  - simplified desktop credential-store construction to the shared `createPlatformWorkspaceCredentialStore()` path
- Promoted encrypted-local vault session behavior into a formal service instead of a duplicated side-channel:
  - added the shared `CredentialStorageSession` capability in core credential services
  - added `electron/connections/CredentialStorageSession.ts` to own encrypted-local prepare/unlock/state rules
  - removed duplicated `prepareCredentialStorage()` logic from both `DesktopConnectionManager` and `DesktopConnectionGateway`
- Narrowed the renderer bridge away from the old catch-all `state` bucket:
  - preload and `DesktopBridge` now expose task-oriented groups: `preferences`, `statusEntry`, `settingsData`, `notifications`, and `profileFeatures`
  - renderer consumers were moved to those narrower surfaces, including the tray popup, settings hooks, and preference client
- Verified that reset keeps the workspace-backend behavior:
  - current `StateReset` resolves a workspace credential store from `databasePath`
  - that path removes both secure-store refs and the local `credentials/` directory, so encrypted-local vault state is cleared during reset

#### Key findings

- The previously reviewed CLI reset gap was already fixed in the current working tree before this pass. I verified it rather than layering a second CLI-specific fix on top.
- I narrowed the preload surface by splitting the old `state` bridge, but I did not collapse `app / connections / profiles / updates` in the same batch. Those areas are smaller and were not the architecture hotspot that the Windows branch exposed first.
- `DesktopMain.ts` is now back under 500 lines, but `DesktopShell.ts`, `DesktopConnectionManager.ts`, and `DesktopStateStore.ts` remain large files. They are within the hard limit now; they are the next obvious split candidates if this branch keeps growing.

### Verification

- `npx vitest run packages/core/src/application/local/StateReset.test.ts packages/core/src/services/credential/PlatformStore.test.ts apps/desktop/src/electron/connections/CredentialStorageSession.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/renderer/settings/PreferencesClient.test.ts`
- `npx vitest run apps/desktop/src/electron/shell/StatusEntryController.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/renderer/settings/PreferencesClient.test.ts apps/desktop/src/electron/connections/CredentialStorageSession.test.ts`
- `npm run typecheck`
- `npm run build -w @nile/desktop`

### Desktop shell and connection flow follow-up cleanup

- Split `DesktopShell` window lifecycle into focused collaborators:
  - `electron/shell/SettingsWindow.ts` now owns the settings BrowserWindow lifecycle, safe sending, notification-target handoff, and auth.json dialog path resolution
  - `electron/shell/TrayPopupWindow.ts` now owns the Windows tray popup BrowserWindow lifecycle, placement, visibility toggling, and safe sending
  - `DesktopShell.ts` now stays focused on tray icon wiring, app-level external actions, and orchestration between tray and windows
- Split `DesktopConnectionManager` input/probe rules out of the session orchestrator:
  - `electron/connections/InputBuilder.ts` now owns add/update credential request shaping, local-connection input shaping, and env-key probe fallback rules
  - `DesktopConnectionManager.ts` now coordinates sessions and desktop-side flows instead of also owning low-level credential-request assembly

#### Key findings

- `DesktopShell.ts` is now down to 200 lines and `DesktopConnectionManager.ts` to 385 lines, both materially clearer than before this pass.
- I reviewed `DesktopStateStore.ts` after these cuts and deliberately did not split it in the same batch. It is still below the repository file-size limit, and the remaining logic is tightly coupled to cache invalidation semantics; a forced extraction there would be mechanical rather than clarifying right now.
- I did not add new unit tests around the two new window lifecycle helpers. The risk there was kept low by preserving behavior and re-verifying desktop build/typecheck plus the connection/status-entry tests that touch the affected wiring.

### Verification

- `npx vitest run apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/electron/connections/CredentialStorageSession.test.ts`
- `npx vitest run apps/desktop/src/electron/shell/StatusEntryController.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`
- `npm run typecheck`
- `npm run build -w @nile/desktop`

### Windows backend and reset hardening follow-up

- Fixed CLI default credential wiring so non-overridden `NileCli` sessions now use a workspace-aware backend store instead of a raw platform system store:
  - added `createPlatformWorkspaceCredentialStore(databasePath)`
  - routed `apps/cli/src/NileCli.ts` through that helper
- Fixed CLI reset wiring so the reset command now reuses the CLI credential store instead of silently constructing an unrelated default `StateReset`.
- Hardened shared reset semantics for encrypted-local storage:
  - `StateReset` still removes database-referenced system credentials and secure snapshots
  - it now also removes the sibling Nile-managed `credentials/` directory so locked encrypted-local vaults do not survive `nile reset`
- Scoped the desktop file-backed managed environment store back to Windows only:
  - `DesktopEnvironmentStore` now enables `desktop-environment.json` only on `win32`
  - Linux and macOS continue using the existing helper-backed secure-store path
- Updated CLI reset copy so the user-facing output no longer incorrectly talks about “keychain entries” on Windows or encrypted-local setups.

#### Key findings

- Fixing only the platform system store choice was not enough for CLI: saved connection reads need the backend-aware workspace wrapper because access rows can point at `encrypted_local_storage`.
- Encrypted-local reset cannot rely on per-entry deletion alone because the vault may still be locked when reset runs. Removing Nile-managed local credential files is the only reliable backend-agnostic reset path.
- I left `.vestin/state/features.json` unchanged because these are hardening fixes to already-built desktop/CLI credential flows, not a new feature-state transition.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/services/credential/PlatformStore.test.ts packages/core/src/application/local/StateReset.test.ts apps/desktop/src/electron/environment/Store.test.ts apps/cli/src/ResetCli.test.ts`
- `npm run typecheck`

### Windows credential and local-secret hardening

- Fixed the Windows secret chunking write path so a failed oversized credential update no longer corrupts the previous stored secret:
  - chunked writes now use a fresh per-write chunk namespace
  - the manifest now records explicit chunk account names
  - legacy `chunkCount` manifests still continue to load for older rows
- Unified default system credential-store selection behind a platform-aware factory:
  - Windows now defaults to `WindowsCredentialManagerStore`
  - non-Windows platforms keep the existing keychain-backed default
  - the new default wiring now covers CLI, `StateReset`, and the core backend credential-store wrapper instead of only the desktop composition root
- Hardened the desktop file-backed Windows secret store replacement flow:
  - replacing `desktop-environment.json` now stages through a backup file
  - a failed final rename restores the previous file instead of deleting it first
- Added focused regression coverage for:
  - failed Windows chunked credential updates preserving the previous secret
  - platform-aware default credential-store selection
  - desktop file secret-store replacement rollback

#### Key findings

- The Windows secret corruption risk was not in read/remove; it was specifically the update path reusing the same chunk account names before the manifest swap had succeeded.
- The CLI Windows gap was broader than one constructor. `NileCli`, `StateReset`, and `BackendCredentialStore` all still had independent macOS-keychain defaults, so the platform choice needed to move into a shared factory.
- This pass keeps backward compatibility for already-written legacy Windows chunk manifests by continuing to understand the old implicit `::chunk:<index>` format while writing the new explicit manifest shape going forward.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/services/credential/PlatformStore.test.ts packages/core/src/services/credential/WindowsCredentialManagerStore.test.ts apps/desktop/src/electron/storage/DesktopSecretFileStore.test.ts packages/core/src/application/local/StateReset.test.ts`
- `npm run typecheck`

### Desktop status entry architecture cleanup

- Moved desktop platform/status-entry helpers out of `renderer/shared` into a shared state module:
  - added `state/DesktopPlatform.ts`
  - renderer `shared/Platform.ts` is now only a compatibility re-export
  - main-process tray code no longer imports renderer-layer helpers
- Split renderer desktop preferences responsibilities:
  - added `renderer/settings/PreferencesClient.ts` for IPC-backed load/save/migration/subscription
  - added `renderer/settings/ThemeController.ts` for DOM theme application
  - `renderer/settings/Preferences.ts` is now only a thin type/constant barrel instead of another store class
- Added a semantic status-entry display model above the legacy storage shape:
  - added `state/StatusEntryDisplay.ts`
  - public mode is now `app_entry | summary`
  - `electron/state/StatusEntryDisplayStore.ts` maps that semantic model to the existing `desktop_menubar_*` tables and legacy `ticker` storage value
- Updated tray/menu/title tests and renderer settings to use the semantic `summary` mode instead of leaking `ticker` through current code paths.

#### Key findings

- I deliberately kept the SQLite table names and on-disk `ticker` value as compatibility storage. The cleanup in this pass is an adapter layer, not a breaking migration.
- `renderer/shared/Platform.ts` still exists as a compatibility import surface for renderer code, but it no longer owns the implementation and main-process code no longer depends on it.
- The tray product still has two renderers (`native menu` and `Windows popup`). This pass cleaned the boundaries and state semantics, but it did not yet unify those two presenters into one shared view-model builder.

### Verification

- `npx vitest run apps/desktop/src/electron/state/StatusEntryDisplayStore.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/renderer/shared/Platform.test.ts apps/desktop/src/state/DesktopPreferences.test.ts apps/desktop/src/electron/state/DesktopPreferencesStore.test.ts`
- `npm run build -w @nile/desktop`
- `npm run typecheck`

### Status entry presenter unification

- Added a shared status-entry presenter:
  - [state/StatusEntryPresenter.ts](D:/jiqiang90/Nile/apps/desktop/src/state/StatusEntryPresenter.ts)
  - it now owns agent visibility, current connection summary, quota badge text, quota text, and connection list shaping
- Reused that presenter in both status-entry renderers:
  - [electron/shell/TrayMenu.ts](D:/jiqiang90/Nile/apps/desktop/src/electron/shell/TrayMenu.ts)
  - [renderer/app/menubar.ts](D:/jiqiang90/Nile/apps/desktop/src/renderer/app/menubar.ts)
- This removes the previous drift where native tray menu and Windows popup each reimplemented:
  - current-connection filtering
  - quota summary selection
  - connection list projection
- Also normalized the summary separator and default profile placeholder to ASCII so the UI no longer carries the old mojibake `Â·` artifact.

#### Key findings

- The tray surface is still intentionally rendered twice: native menu on one path, HTML popup on the other. This pass unified the data shaping, not the rendering technology.
- The connection detail row still formats `authMode` in the popup renderer only, because that text is not currently needed by the native menu. If we later need identical detailed rows on both sides, that label formatting should move into the shared presenter layer too.

### Verification

- `npx vitest run apps/desktop/src/state/StatusEntryPresenter.test.ts apps/desktop/src/electron/state/StatusEntryDisplayStore.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/renderer/shared/Platform.test.ts`
- `npm run build -w @nile/desktop`
- `npm run typecheck`

### Status entry follow-up fixes

- Removed the remaining main-to-renderer i18n dependency:
  - moved shared translator implementation to [state/I18n.ts](D:/jiqiang90/Nile/apps/desktop/src/state/I18n.ts)
  - moved translation catalog under [state/i18n](D:/jiqiang90/Nile/apps/desktop/src/state/i18n/catalog.ts)
  - `renderer/shared/I18n.ts` is now only a compatibility re-export
  - main tray code now imports translator helpers from state instead of renderer
- Removed duplicate quota projection logic:
  - added [state/StatusEntryQuota.ts](D:/jiqiang90/Nile/apps/desktop/src/state/StatusEntryQuota.ts)
  - both [state/StatusEntryPresenter.ts](D:/jiqiang90/Nile/apps/desktop/src/state/StatusEntryPresenter.ts) and [electron/shell/StatusEntrySummary.ts](D:/jiqiang90/Nile/apps/desktop/src/electron/shell/StatusEntrySummary.ts) now use the same quota helper
- Restored renderer-side coverage lost during the preferences split:
  - added [renderer/settings/PreferencesClient.test.ts](D:/jiqiang90/Nile/apps/desktop/src/renderer/settings/PreferencesClient.test.ts)
  - added [renderer/settings/ThemeController.test.ts](D:/jiqiang90/Nile/apps/desktop/src/renderer/settings/ThemeController.test.ts)
  - updated [renderer/shared/I18n.test.ts](D:/jiqiang90/Nile/apps/desktop/src/renderer/shared/I18n.test.ts) for the new catalog location

#### Key findings

- The direct main-process dependency on renderer helper modules is now removed for both platform copy and i18n.
- The status-entry title/tooltip path and the popup/menu presenter path now share one quota projection source, so future metric-label or freshness changes should not drift between them.
- I left the dual-renderer product shape intact: native menu and Windows popup still render separately by design, but they no longer diverge on data shaping or summary logic.

### Verification

- `npx vitest run apps/desktop/src/renderer/shared/I18n.test.ts apps/desktop/src/renderer/settings/PreferencesClient.test.ts apps/desktop/src/renderer/settings/ThemeController.test.ts apps/desktop/src/state/StatusEntryPresenter.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/renderer/shared/Platform.test.ts`
- `npm run build -w @nile/desktop`
- `npm run typecheck`

### Quota cache retry fix

- Traced the remaining `jiqiang90@gmail.com` `Unknown` quota state past the unlock-refresh change.
- Found that the desktop usage cache treated quota read failures as fresh `null` values for 60 seconds:
  - a transient OpenAI usage read error or locked-credential read stored `null`
  - later manual refreshes reused that cached `null` instead of retrying the remote usage read
- Updated `DesktopUsageCache` so usage reads with `status: "error"` or thrown read failures are not marked fresh in the TTL cache.
- Added focused coverage proving an initial quota-read error is retried on the next refresh instead of staying stuck as cached `null`.

#### Key findings

- The visible `Unknown` state was a cache freshness bug, not a missing OpenAI quota record.
- `DesktopStateRefresher.refreshDesktopState()` already invalidated desktop state, but it did not clear the independent `DesktopUsageCache`, so stale `null` usage could survive a manual refresh.
- Keeping successful `unavailable` / `unsupported` reads cacheable is still useful, but plain `error` results must stay retryable.

### Verification

- `npx vitest run apps/desktop/src/state/UsageCache.test.ts`
- `npm run build -w @nile/desktop`
- `rg -n "menubarDisplay|useMenubarDisplay|onMenubarDisplayModeChange|isLoadedMenubarDisplay|isSavingMenubarDisplay" apps/desktop/src/renderer`

### Windows tray popup MVP

- Added a minimal Windows tray popup path on top of the existing cross-platform tray shell:
  - left click now toggles a compact popup window on Windows
  - right click still opens the native tray menu
- Reused the existing detached status-entry renderer (`menubar.html/js`) for the popup surface so the first Windows flyout can ship without introducing a second renderer implementation.
- Added a focused popup placement helper and tests so tray-window positioning logic stays out of `DesktopShell`.
- Extended platform capabilities with `supportsTrayPopup` and kept the rest of the tray summary/ticker branching on the shared capability helper.

#### Key findings

- This is intentionally an MVP. The Windows popup currently reuses the existing detached menubar renderer, so the internal file naming still reflects its historical macOS origin.
- The popup does not add a new Windows-specific interaction model yet; it is a lightweight left-click flyout over the same content, not a fully redesigned tray dashboard.
- Tray attention/icon-state work is still separate. This batch adds the missing popup surface only and does not yet change the tray icon based on alert or quota state.

### Verification

- `npx vitest run apps/desktop/src/electron/shell/PlatformCapabilities.test.ts apps/desktop/src/electron/shell/TrayPopupPlacement.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts`
- `npm run build -w @nile/desktop`

### Code-level legacy removal

- Removed the code-level status-entry compatibility aliases and switched the active desktop APIs to the neutral names:
  - removed `MenubarState` / `MenubarAgentState` type aliases
  - removed preload and IPC compatibility methods such as `getMenubarState`, `getMenubarDisplay`, `setMenubarDisplayMode`, `toggleMenubarTickerAgent`, and `refreshMenubar`
  - renamed the remaining desktop state/surface/store methods onto `statusEntry*`
- Updated the shared renderer consumers, shell code, and focused desktop tests to use the neutral names end-to-end.
- Kept the concrete `renderer/app/menubar.*` asset names in place while switching that renderer to the new bridge methods. The file still represents the macOS menubar/tray popup surface, but it no longer depends on menubar-named APIs.

#### Key findings

- The remaining legacy naming is now intentionally limited to persistence/upgrade surfaces only:
  - `desktop_menubar_*` SQLite tables
  - the `menubar_state` snapshot key
  These still need to load existing installs safely, so they were not renamed in this batch.
- The verification here is targeted to the refactored desktop state/shell/status-entry suites. The broader `Surface.test.ts` file still contains unrelated Windows Codex CLI runtime cases that are environment-sensitive and were not part of this legacy-removal pass.

### Verification

- `npx vitest run apps/desktop/src/state/StatusEntryQuery.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts apps/desktop/src/electron/shell/PlatformCapabilities.test.ts apps/desktop/src/electron/shell/TrayPopupPlacement.test.ts`
- `npm run build -w @nile/desktop`

## 2026-05-25

### Windows tray interaction simplification

- Kept the new left-click tray popup path, but finished the missing renderer styling for that surface so the popup no longer renders as raw text on Windows.
- Simplified the right-click tray menu down to a compact read-only summary:
  - `Open app`
  - one row per agent that currently has a saved active connection
  - each row shows the current quota summary when available, otherwise `Unknown`
- Removed the old right-click submenu responsibilities from `TrayMenu`:
  - profile switching
  - per-agent connection switching
  - status-entry ticker/usage-summary toggles
  Those flows still exist in the left-click popup or the main settings window, but the right-click surface is now summary-only.

#### Key findings

- The unstyled popup was not a tray-window loading issue. `menubar.html` was loading `styles.css`, but the semantic popup classes (`panel`, `hero-card`, `connection-row`, etc.) had no component-layer definitions in the stylesheet.
- The old right-click menu had become an overloaded second control surface. Keeping mutations in both left-click and right-click menus made the tray harder to scan and harder to maintain.
- The per-connection missing quota issue for `jiqiang90@gmail.com` was not resolved in this batch. Investigation started, but the task direction shifted to tray UX before the local data probe was completed.

### Verification

- `npx vitest run apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run build -w @nile/desktop`

### Encrypted-local quota refresh follow-up

- Investigated the missing quota on the saved `jiqiang90@gmail.com` OpenAI session connection.
- Verified directly against the live encrypted-local credential and OpenAI usage endpoint that the connection does have readable quota:
  - plan: `Plus`
  - `5h`: `0%`
  - `7d` / weekly: `66%`
- Confirmed the desktop issue was not the OpenAI reader or the stored session credential. The problem was the renderer refresh path after encrypted-local unlock:
  - the settings page could load a snapshot with `usage: null`
  - unlocking encrypted local storage only updated the unlock-state flag
  - no automatic settings-state refresh ran after the unlock succeeded
- Added a post-unlock settings refresh hook in the settings renderer so quota-backed connection rows reload immediately after a successful encrypted-local unlock.

#### Key findings

- The saved `jiqiang90@gmail.com` connection is an `openai_session`, not an API-key connection. It uses the same OpenAI quota reader path as `jay.ji@spotto.ai`.
- The live quota API was healthy during investigation. Repeated direct reads returned `available` for both OpenAI session connections.
- The stale `Unknown` state came from renderer state freshness, not from missing upstream quota data.

### Verification

- `npm run build -w @nile/desktop`

### Windows tray click-role correction

- Corrected the Windows tray interaction split after the previous batch inverted the intended behavior:
  - left click now opens a compact native summary menu
  - right click keeps the existing full native tray menu with profiles, per-agent connection switching, and status-entry toggles
- Removed the left-click dependency on the tray popup path for Windows and routed it through a dedicated summary template instead.
- Kept the earlier popup styling fix in the codebase, but it is no longer the active Windows left-click interaction.

#### Key findings

- The previous implementation changed the wrong surface: it simplified the right-click menu and left the rich popup on left click, which was the opposite of the requested UX.
- The clean fix was to split tray menu generation into two templates instead of trying to mutate one menu definition for both click paths.
- The `jiqiang90@gmail.com` quota investigation is still separate and remains unfinished in this batch.

### Verification

- `npx vitest run apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run build -w @nile/desktop`

### Status-entry bridge alias follow-up

- Added neutral status-entry type aliases at the shared desktop state boundary:
  - `DesktopStatusEntryAgentState`
  - `DesktopStatusEntryState`
- Switched the newer internal query/presenter/state-store files to consume those neutral types while preserving the legacy `Menubar*` aliases for compatibility.
- Added additive preload and IPC aliases so new renderer code can use status-entry naming without breaking older menubar-named calls:
  - `getStatusEntryState`
  - `getStatusEntryDisplay`
  - `setStatusEntryDisplayMode`
  - `toggleStatusEntrySelectedAgent`
  - `refreshStatusEntry`
- Added a new renderer settings hook, `useStatusEntryDisplay`, and moved the settings app plus quota-preference refresh path onto the new bridge names.

#### Key findings

- This batch intentionally keeps the legacy IPC channels, preload methods, snapshot keys, and `desktop_menubar_*` persistence names alive. The new status-entry calls are additive aliases only.
- The detached `renderer/app/menubar.ts` entry was left on its existing naming because it is still the concrete macOS menubar window surface, not a shared cross-platform abstraction.
- Settings/page prop names such as `menubarDisplayMode` are still present in the renderer tree. The bridge is now neutral enough to rename those later without needing another IPC pass first.

### Verification

- `npx vitest run apps/desktop/src/electron/state/StatusEntryDisplayStore.test.ts apps/desktop/src/state/StatusEntryQuery.test.ts apps/desktop/src/renderer/shared/Platform.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/PlatformCapabilities.test.ts`
- `npm run build -w @nile/desktop`

### Status-entry display payload naming follow-up

- Renamed the internal status-entry display payload fields to neutral names:
  - `hasConfiguredTickerAgents` -> `hasConfiguredSelectedAgents`
  - `tickerAgentIds` -> `selectedAgentIds`
  - `writeTickerAgentIds(...)` -> `writeSelectedAgentIds(...)`
- Updated the internal shell presenter/tests to consume the new field names while keeping the outer compatibility edges unchanged:
  - IPC method names still use `getMenubarDisplay`, `setMenubarDisplayMode`, and `toggleMenubarTickerAgent`
  - SQLite tables still use `desktop_menubar_*`
  - persisted rows still store the same data, only the in-memory TypeScript shape was neutralized

#### Key findings

- This closes the most obvious remaining `ticker` wording leak inside the internal display-state payload without forcing a migration of persisted data.
- The next remaining legacy seam is the exported `MenubarState` / `getMenubarState` naming. That one spans renderer/main/preload contracts and should be handled separately from this in-memory payload cleanup.

### Verification

- `npx vitest run apps/desktop/src/electron/state/StatusEntryDisplayStore.test.ts apps/desktop/src/state/StatusEntryQuery.test.ts apps/desktop/src/renderer/shared/Platform.test.ts apps/desktop/src/electron/shell/StatusEntryTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/shell/StatusEntrySummary.test.ts apps/desktop/src/electron/shell/PlatformCapabilities.test.ts`
- `npm run build -w @nile/desktop`

## 2026-05-21

### Desktop startup status batching

- Reduced one major source of desktop restart latency in the state query layer:
  - `DesktopMenubarStateQuery` now reads all agent statuses through one `session.listAgentStatuses(...)` call and reuses that batch for both menubar rows and current-connection usage refresh targeting
  - `DesktopSettingsStateQuery` now reads all agent statuses once per settings-state build instead of calling `session.getAgentStatus(...)` once per agent
- Added a startup-only prewarm path so desktop boot can seed both menubar state and settings snapshot from one shared session:
  - `DesktopSurface.primeStartupState()` now captures one shared read context and builds both state payloads from it
  - onboarding scan data is derived from the already-batched agent statuses instead of running a second `scanLocalSetups()` selection sync
  - `DesktopStateStore.primeStartupState()` stores both warmed values directly into cache without forcing an immediate live usage read
- Added desktop-local persisted state snapshots so a full app relaunch can hydrate the last known menubar/settings state before any live scan:
  - `DesktopStateSnapshotStore` writes renderer-safe JSON payloads into a dedicated SQLite table
  - `DesktopStateStore` hydrates cached menubar/settings state from those persisted snapshots during construction
  - successful menubar/settings refreshes now overwrite the persisted snapshot automatically
- Followed up on review findings in the snapshot path:
  - settings snapshot reads now go through a dedicated `getSettingsStateSnapshot()` path instead of poisoning the live `getSettingsState()` cache
  - hydrated snapshots stay displayable but remain `dirty`, so the first live settings read still refreshes from the real surface
  - startup prewarm now preserves an existing persisted settings snapshot instead of replacing it with an empty-usage in-memory snapshot before deferred quota refresh runs
  - persisted snapshot payloads now get a minimal shape check before hydration so obviously stale/corrupt rows are ignored
- Shifted first-render behavior toward cached-first rendering:
  - desktop startup now primes cached state in the background instead of immediately forcing `refreshMenubarUsage()`
  - initial settings renderer load now requests `getSettingsStateSnapshot()` first, then follows with an async live refresh after first paint
  - startup usage refresh is deferred slightly instead of competing with the first visible render path
- Added focused desktop-state unit coverage to lock the new query shape:
  - [MenubarQuery.test.ts](/Users/jiatwork/Works/nile/apps/desktop/src/state/MenubarQuery.test.ts)
  - [SettingsQuery.test.ts](/Users/jiatwork/Works/nile/apps/desktop/src/state/SettingsQuery.test.ts)

#### Key findings

- The main restart slowdown is still broader than this patch: startup currently rebuilds `settings-state`, `menubar-state`, and `menubar-usage-refresh` as separate scopes, so there are still multiple full live-detection rounds per launch.
- The new startup prewarm merges the initial menubar/settings snapshot build into one session, but later explicit refresh paths still use the broader `refreshDesktopState()` flow.
- The persisted snapshot is intentionally renderer-safe only. It does not store credentials, live secure payloads, or raw usage provider responses.
- Snapshot freshness is still best-effort. If the app quits before a later mutation is followed by a successful state refresh, the next launch can briefly show the previous saved snapshot until live refresh catches up.
- Snapshot validation is intentionally shallow right now. It protects against obviously wrong rows, but a future structural state change should still bump the snapshot version deliberately.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/state/MenubarQuery.test.ts apps/desktop/src/state/SettingsQuery.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/DesktopStateStore.test.ts`
- `./node_modules/.bin/vitest run apps/desktop/src/state/MenubarQuery.test.ts apps/desktop/src/state/SettingsQuery.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

### Connection quota metric preference

- Added a desktop-local per-connection quota metric preference that does not touch shared connection state or SQLite:
  - stored inside the existing desktop renderer preference payload
  - keyed by saved `connectionId`
  - removable so the UI can fall back to automatic metric selection
- Kept the default behavior unchanged when no preference is set:
  - Nile still picks the tightest quota window
  - OpenAI/Codex summaries still normalize `7d` into `weekly`
- Updated desktop quota displays so a pinned metric overrides the default summary everywhere that shows a single headline metric:
  - connection list summary cells
  - agent connection indicators
  - current-connection picker indicators
  - detached menubar renderer summary
  - native macOS tray ticker title
  - native macOS tray quota submenu label
- Added a lightweight row-level telescope toggle beside each quota progress bar so the operator can pin or clear a metric directly from the existing quota panel instead of opening a separate settings control.
- Refined the telescope toggle styling so the inactive state sits greyed out while the active state lights up with a warmer highlight, matching the intent of a focused watch target better than a generic checkbox.
- Kept the row action on `Telescope` after UI review; the angled silhouette reads more naturally than `Binoculars` as a compact “watch this metric” control in the quota row.
- Added Gemini quota instrumentation at the desktop usage-cache boundary so logs now capture:
  - raw Gemini quota `status`
  - `windowCount`
  - whether the desktop summary kept or hid the result
  - any returned Gemini message for unavailable/error outcomes

#### Key findings

- Keeping the preference in renderer-local preferences was fine for persistence, but native tray surfaces still needed explicit main-process reads from the hidden settings window's `localStorage`; otherwise ticker and tray labels would drift from the renderer.
- The preference intentionally changes only which metric is surfaced as the single summary field. It does not alter raw quota windows, alert metrics, or provider usage reads.
- Existing `desktop.usage.read_failed` logs only covered thrown exceptions. Gemini was also disappearing through normal `unavailable` results that the desktop summary intentionally collapses to `null`, so that path needed its own explicit instrumentation.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/ConnectionQuotaMetricPreferences.test.ts apps/desktop/src/state/UsageSummary.test.ts apps/desktop/src/renderer/settings/Preferences.test.ts apps/desktop/src/electron/shell/TickerTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Codex CLI resolution hardening

- Hardened Codex CLI discovery so Nile no longer trusts the first `codex` file in `PATH` blindly:
  - added a Codex-owned CLI resolver that validates the packaged vendor binary behind each candidate launcher
  - skipped broken installs such as stale Homebrew/global wrappers whose vendor binary is missing
  - surfaced a direct user-facing error when every discovered Codex install is broken instead of spawning a known-bad command and reporting only `exit code 1`
- Added a plugin-owned local runtime info hook on agent modules and used it in desktop settings state.
- Exposed the resolved CLI command in the agent detail `Agent home` section so the active Codex launcher path is visible from the UI.

#### Key findings

- The new validation only trusts Codex installs whose packaged vendor binary exists for the current platform/arch tuple.
- If Finder/login-shell `PATH` still does not contain a working Codex install, the home panel now shows that no working CLI command was found instead of implying Nile picked one successfully.

### Verification

- `./node_modules/.bin/vitest run packages/agents/codex/src/CodexSessionLogin.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Codex CLI global npm layout fix

- Fixed Codex CLI discovery for Windows/global npm-style installs where the `codex` launcher lives directly under the Node prefix and the platform vendor package is nested under `node_modules/@openai/codex/node_modules/@openai/codex-win32-*`.
- Kept the existing "skip obviously broken installs" behavior, but expanded the resolver's acceptable vendor-package layouts instead of treating every non-legacy wrapper as broken.
- Added targeted Codex login coverage for the nested global package layout and updated the existing tests so they no longer depend on the host machine's real `PATH` contents.

#### Key findings

- The earlier resolver was too strict about install shape, not about command existence: `C:\nvm4w\nodejs\codex` was a valid launcher on this machine, but Nile only knew how to validate the older `bin/` and direct optional-package layouts.
- Test isolation had to be tightened as part of this fix because Windows developer machines can already have a real global Codex install in `PATH`, which was leaking into "missing CLI" and browser-flow unit cases.

### Verification

- `npx vitest run packages/agents/codex/src/CodexSessionLogin.test.ts`
- `npm run typecheck`

### Windows Codex launcher follow-up

- Fixed shared runtime command discovery so Windows PATH and NVM lookups prefer spawnable launchers such as `codex.cmd` instead of returning bare extensionless wrapper paths.
- Fixed `ShellPath.merge()` to use the platform PATH delimiter instead of hardcoding `:`, which was corrupting Windows drive-letter paths during desktop login env construction.
- Added focused `ShellPath` coverage for Windows-style PATH values and updated Codex login fixtures to model platform-specific launchers explicitly.

#### Key findings

- The earlier global npm-layout fix exposed a second Windows-only failure: once Nile recognized `C:\\nvm4w\\nodejs\\codex`, it still tried to spawn an extensionless wrapper and then built an invalid merged `PATH`, producing `ENOENT` and then `EINVAL` in sequence.
- This follow-up fixes the shared command/path layer rather than adding more Codex-only exceptions, so other Windows agent login/runtime flows now inherit the same safer behavior.

### Verification

- `npx vitest run packages/core/src/services/ShellPath.test.ts packages/agents/codex/src/CodexSessionLogin.test.ts`
- `npm run typecheck`
- `npm run build -w @nile/desktop`

### Desktop-local CLI command override

- Added a desktop-local per-agent runtime command override path:
  - stored in a new desktop-only SQLite table `desktop_agent_runtime_commands`
  - exposed through IPC and preload
  - editable from the agent detail `Agent home` section
- Kept the override outside shared connection/provider/session state:
  - desktop state now injects the override into local runtime info queries for display
  - desktop connection/login flows inject the override into interactive session login context for execution
- Codex now applies the command resolution priority as:
  - desktop-local override
  - working `PATH` candidate
  - working `~/.nvm/versions/node/*/bin/codex` fallback

#### Key findings

- This setting should persist locally on the machine; keeping it memory-only would make Finder-launch recovery disappear on every restart.

### Agent home shared save

- Simplified the agent detail `Agent home` editing flow so the home path and CLI command override now share one primary save action instead of presenting two separate `Save` buttons.
- Kept the two fields visually separate, but changed the local form semantics so both values stage in the renderer until the operator clicks the shared save button.
- Updated the reset actions to stay local-only:
  - `Reset to default path` now only rewrites the input value
  - `Use auto-detected CLI command` now only clears the override input
  - neither reset writes immediately anymore, so the single save button remains the only persistence action on the page

#### Key findings

- This is still not a new atomic main-process save API. The renderer currently issues the existing `updateAgentHome(...)` and `updateAgentRuntimeCommand(...)` IPC calls sequentially under one UI action.
- The unified save button only becomes enabled when either staged value differs from the currently persisted values, which avoids redundant double-write IPC calls on unchanged forms.

### Verification

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- The override remains desktop-specific and does not belong in shared saved connection/domain state because it only describes how this one local runtime should find its CLI launcher.
- The resolved runtime command remains the source of truth for what Nile will execute, but showing override and resolved values as separate controls created needless friction. The home panel now exposes a single CLI path input seeded from the current resolved command, with warning state when resolution fails and reset-to-auto-detected behavior when users want to drop a local override.

### Runtime command capability generalization

- Generalized the desktop-local command-path feature from Codex-specific `cliCommand*` state into a shared runtime-command capability:
  - core local-runtime info now reports `runtimeCommandPath`
  - desktop state and agent detail UI now consume generic `runtimeCommand*` fields
  - agents opt in by exposing `localRuntimeInfo`, instead of the desktop treating Codex as a one-off special case
- Added Gemini as the second implementation of this capability:
  - Gemini now resolves its CLI command from `PATH`, falls back to common `~/.nvm` installs, and honors the desktop-local runtime command override during sign-in
  - Gemini agent home now shows the same local runtime command path control as Codex
- Added Claude as the third CLI-backed implementation:
  - Claude now resolves its local CLI command from `PATH` and common `~/.nvm` installs
  - Claude sign-in now honors the same desktop-local runtime command override used by the agent home UI
- Extended the same agent-home runtime command discovery to Cursor and OpenClaw:
  - Cursor now resolves `agent`
  - OpenClaw now resolves `openclaw`
  - both show the same local runtime command path control in desktop settings

#### Key findings

- Codex and Gemini need different validity checks: Codex must verify its packaged vendor binary, while Gemini currently only needs to confirm the launcher exists and is reachable with a matching `node` in `PATH`.
- The Terminal-based Gemini login flow also needed the resolved command directory in the exported `PATH`; an absolute launcher path alone is not enough for `#!/usr/bin/env node` wrappers.
- The broader product-facing meaning of this field is “which local executable represents this agent on this machine,” not only “which command does the login flow spawn.” Under that definition, Cursor (`agent`) and OpenClaw (`openclaw`) belong in the same agent-home runtime command UI even though Nile does not yet spawn those binaries elsewhere today.

### Verification

- `./node_modules/.bin/vitest run packages/agents/gemini/src/GeminiSessionLogin.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/AgentRuntimeCommandsStore.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/state/Surface.test.ts packages/agents/codex/src/CodexSessionLogin.test.ts`
- `npm run typecheck`

### Codex .nvm fallback

- Extended Codex CLI discovery so Finder/login-shell sessions can recover when `PATH` contains only broken wrappers:
  - if `PATH` does not yield a working Codex install, Nile now probes `~/.nvm/versions/node/*/bin/codex`
  - candidates are validated with the same packaged-vendor-binary check as `PATH` entries
  - the selected CLI directory is prepended to the spawned `PATH` so `#!/usr/bin/env node` launchers can still find the matching Node runtime
- The agent detail `Resolved CLI command` field now reflects `.nvm` fallback results too.

#### Key findings

- A direct absolute path to `codex` is not sufficient by itself for npm global launchers; the sibling `node` binary must also be reachable in `PATH`.
- Finder-launch failures on this machine came from two layers at once: a broken Homebrew `codex` in `PATH`, and a working `.nvm` install that was invisible to the login-shell environment.

### Verification

- `./node_modules/.bin/vitest run packages/agents/codex/src/CodexSessionLogin.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Desktop Codex browser-oauth release fix

- Fixed desktop OpenAI sign-in so packaged builds no longer depend on `codex login` opening the browser by itself:
  - extended the shared interactive-login context with an optional `openExternalUrl()` callback
  - desktop now injects that callback from the Electron shell when preparing or creating a login-backed connection
  - Codex login now captures `codex login` output in Electron, extracts the emitted OpenAI OAuth URL, and opens it through the desktop shell
- Improved Codex login failure reporting in desktop/Electron paths:
  - stopped discarding all child-process output with `stdio: ignore`
  - preserved captured login errors so the UI no longer collapses every failure into a bare `exit code 1`
- Added regression coverage for:
  - browser opener injection from `DesktopConnectionManager`
  - Codex login URL capture and browser launch
  - surfaced stderr details on failed Codex login exits

#### Key findings

- The production failure was not in `desktop:prepare-connection-draft` itself; the broken behavior was that Nile never actively opened the OAuth URL in packaged desktop flows and also hid the underlying Codex CLI output.
- The fix still relies on `codex login` printing an OpenAI auth URL. If Codex CLI changes that output format in a future release, the URL extraction pattern may need to be updated.

### Verification

- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/agents/codex/src/CodexSessionLogin.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts packages/core/src/application/local/LocalCredentialResolver.test.ts`
- `npm run typecheck`

### Review follow-up fixes

- Seeded the main-process language store during startup from the hidden settings renderer's existing desktop preference payload before creating the tray.
- Added a shared parser for the stored desktop language preference so upgrade-time bootstrap can reuse the same supported-language normalization rules.
- Made managed API-key updates remove shell wiring immediately when a connection no longer has any enabled agent that still needs the shell-backed export path.

#### Key findings

- The first tray-menu localization pass fixed steady-state syncing, but upgraded users could still briefly get an English tray until the settings renderer had time to write the new main-process store.
- Connection-update paths needed explicit shell-export removal; only pruning shell keys during later session sync left a stale prompt-triggering bridge behind after certain edits.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/UiPreferences.test.ts apps/desktop/src/electron/state/LanguageStore.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts`
- `npm run typecheck`

### Tray menu locale sync

- Added a dedicated main-process desktop language store so tray-menu localization no longer depends on renderer `localStorage`.
- Settings now sync the selected language into that store whenever the preference changes.
- Localized the Electron tray menu and tray-originated failure notifications through the shared translation catalog.
- Added Chinese tray/menu copy so the right-click menu now matches the settings surface and menubar popover language.

#### Key findings

- The screenshoted menu is not the menubar renderer window; it is the Electron tray context menu built in main, so the earlier renderer-side language fix could not affect it.
- Persisting one small language preference in main was a lower-risk fix than trying to bridge renderer `localStorage` state into tray-menu construction.
- Tray menu labels can be localized with the existing catalog once the main process has a stable language source; there was no need for a second i18n system.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/LanguageStore.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run typecheck`

### Language selector self-labels

- Changed the desktop language selector to show each language in its own native label instead of translating language names through the current UI locale.
- Moved the self-label list into shared UI preference definitions so renderer surfaces can reuse one source of truth for language names.

#### Key findings

- Translating language names through the active locale makes the selector harder to scan when users are explicitly trying to switch into a language they may not currently read well.
- The right behavior here is different from ordinary UI copy: language choices should stay self-identified, while section titles and descriptions remain localized.

### Verification

- `npm run typecheck`

### Menubar locale refresh fix

- Made the separate menubar renderer reliably re-apply language and theme preferences when desktop state refreshes.
- Settings now explicitly trigger a menubar refresh after language or theme changes so the detached menubar window no longer depends on cross-window `localStorage` propagation timing.
- Corrected the Chinese menubar settings copy:
  - description now says `agent 用量指标`
  - the ticker option label is now `用量指标`

#### Key findings

- The menubar surface is a separate renderer window, so relying on local `CustomEvent` dispatch and browser-managed storage sync was not a stable way to propagate preference changes.
- The simplest safe fix was to reuse the existing main-process `refreshMenubar` path and make the menubar renderer re-apply preferences whenever that state notification arrives.

### Verification

- `npm run typecheck`

### Update prompt visual simplification

- Removed the remaining status icon treatment from the floating desktop update prompt.
- Kept the prompt to plain:
  - title
  - body text
  - action buttons
  - dismiss button
- Narrowed the prompt width slightly so the card reads more like a compact notification than a mini status panel.

#### Key findings

- Once the fake downloading progress UI was removed, the status icons no longer added meaningful information beyond the title text.
- The update prompt is easier to scan when it behaves like a lightweight toast with explicit actions instead of a decorated status card.

### Verification

- `npm run typecheck`

### Update prompt simplification

- Removed the synthetic downloading progress treatment from the global update prompt:
  - the floating update card no longer renders a pulsing pseudo-progress bar
  - downloading remains visible in the settings update section, which already had truthful status copy
- Simplified prompt visibility so the global card now opens only for actionable or recovery states:
  - `ready`
  - `error`
- Trimmed the prompt presenter shape to match the new flow by removing the optional body slot that only existed to host the fake progress bar.

#### Key findings

- The desktop updater does not currently expose a real download-progress signal to this prompt, so the old bar was decoration rather than state.
- Showing the global card during `downloading` made the update flow feel more complicated than it was; the real user actions only happen after completion or failure.
- This change intentionally simplifies renderer UX only. It does not alter the packaged auto-update pipeline or Electron `quitAndInstall()` behavior.

### Verification

- `npm run typecheck`

### Managed env popup reduction

- Reduced Nile-managed shell env bridging so desktop-managed API keys no longer wire login-shell profile blocks for every env-capable agent:
  - desktop still writes and reads managed `NILE_*` API-key values through the keychain-backed environment store
  - shell/profile export wiring now only stays active for enabled agents whose apply requirements indicate an external env-backed runtime path
  - this keeps OpenClaw-style external env bridging while stopping Claude/Codex-only API-key connections from needlessly triggering shell-time keychain reads
- Hardened desktop startup environment probing so Nile's own login-shell snapshot skips the managed shell bridge block:
  - `ShellEnvironment.readLoginShellEnvironment()` now sets `NILE_SWITCHER_MANAGED_ENV_LOADED=1` for the spawned login shell
  - this prevents desktop startup from re-triggering its own `managed.sh` keychain reads before startup reconciliation can prune stale shell wiring

#### Key findings

- The recurring keychain prompt was not caused by `auth.json` or OpenAI session storage; it came from shell startup sourcing Nile-generated profile blocks that called `/usr/bin/security find-generic-password`.
- Desktop already had a direct keychain-backed read path through `DesktopEnvironmentSource`, so the shell bridge was only necessary for external env-driven agent runtimes, not for ordinary desktop-managed API-key connections.
- The remaining shell bridge policy still uses current agent apply requirements as the narrowest available registry signal for “external env-backed runtime”; there is not yet a dedicated capability for this distinction.

### Verification

- `./node_modules/.bin/vitest run packages/host-local/src/ShellEnvironment.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/environment/Shell.test.ts apps/desktop/src/electron/environment/Source.test.ts`
- `npm run typecheck`

### Menubar usage ticker

- Added a persisted menubar display preference in Electron main so the tray can survive restarts with either:
  - compact `App entry` mode
  - usage `Ticker` mode
- Added tray title formatting from current agent usage snapshots:
  - `codex 72% · cursor 6%` style output
  - hidden automatically when ticker mode is off or selected agents do not have available usage
- Added per-agent ticker customization from the tray menu itself:
  - each agent's `Quota` row now expands to a `Show in ticker` checkbox
  - users can keep only specific agents, such as Codex, in the top-bar ticker
- Refined ticker fallback behavior:
  - when ticker agent selection has never been configured, Nile defaults to the first agent that currently has available quota
  - when ticker mode is enabled but the selected agents do not currently expose quota, the tray falls back to the normal app-entry icon instead of showing an empty ticker
  - when ticker text is present, the macOS tray hides the Nile icon and shows text-only output
- Added a desktop Settings control for the global menubar mode without moving existing theme/language/profile settings.

### Key findings

- Tray title state cannot rely on renderer `localStorage`; it has to live in Electron main because the tray exists before or without the settings window.
- The existing menubar state already exposes `currentUsage` per agent, so this feature did not need a new usage pipeline. The right seam was main-process formatting plus a small persisted preference store.
- Keeping agent selection in the tray `Quota` submenu is materially better than adding another dense settings matrix because it lets users tune visibility where they immediately see the result.

### Verification

- `npm run typecheck`
- `npx vitest run apps/desktop/src/electron/state/MenubarDisplayStore.test.ts apps/desktop/src/electron/shell/TickerTitle.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`

### Menubar usage ticker follow-up fixes

- Fixed the first-click tray-toggle bug when ticker agents had never been explicitly configured:
  - the tray checkbox state was showing the inferred default selection
  - but the toggle mutation was still operating on the raw persisted selection
  - main-process toggles now derive from the current effective selection before writing the configured set
- Removed the unused `settings.menubar.tickerHint` locale key after the settings hint text was dropped from the UI.
- Replaced the temporary English placeholder copy for the new menubar setting in the shipped non-English desktop locale catalogs.

### Key findings

- The "default selected agent" behavior and the "persisted configured selection" behavior cannot share the same raw toggle path. The mutation has to operate on the effective selection the user actually sees.
- Locale-complete product settings need to be treated as part of the feature, not a later polish pass, because placeholder English strings create an immediate regression in already localized builds.

### Update prompt polish and shutdown safety

- Slimmed the global update prompt into a smaller notification-style card:
  - reduced width, title size, icon size, shadow, and padding
  - removed redundant downloading helper copy so the downloading state now focuses on:
    - title
    - version sentence
    - subtle progress bar
- Removed the temporary prompt preview wiring after local iteration so the settings surface stays clean.
- Hardened `DesktopShell` state notifications so shutdown/update events do not send IPC messages to a destroyed settings window or destroyed `webContents`.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Exclude broken credential-sync connections from agent switching

- Kept saved connections with failed credential synchronization visible in the general connection inventory, but removed them from per-agent switchable connection lists.
- This prevents agent pages and quick-switch selectors from offering connections that are already known to be unusable because their credential material never successfully reached Keychain.
- Added regression coverage so `write_failed` connections still appear in the saved inventory but no longer show up as selectable Codex/OpenClaw targets.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Auto-update status UX cleanup

- Expanded desktop release/update status handling to surface human-visible states instead of collapsing failures back to idle:
  - `checking`
  - `downloading`
  - `up_to_date`
  - `ready`
  - `error`
- Added `errorMessage` to desktop release info so the settings page can explain update failures.
- Updated the settings update section to show:
  - packaged-build limitations for development builds
  - background download progress
  - explicit failure text
  instead of appearing inert when update checks fail.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/updates/AutoUpdateManager.test.ts`
- `npm run typecheck`

### In-app update prompt

- Added a global renderer update prompt for:
  - `downloading`
  - `ready`
  - `error`
- The prompt is shown outside the Settings page surface so users do not need to manually reopen the update section to understand what is happening.
- `ready` now offers:
  - open release notes
  - restart to install
- `error` now offers a direct retry action instead of silently falling back to idle.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/updates/AutoUpdateManager.test.ts`
- `npm run typecheck`

### Update prompt polish

- Refined the global update prompt into a more product-like notification card instead of a generic modal-style surface.
- Added status-specific visual treatment for:
  - background download
  - ready to install
  - update check failure
- Kept the prompt honest to the current updater capabilities:
  - no fake numeric percent
  - download state is shown as an indeterminate background download
- Added clearer copy explaining:
  - background download continues while the user works
  - restart installs the ready update
  - update failures do not block normal app usage

### Verification

- `npm run typecheck`

### Desktop build fix for browser-safe core imports

- Fixed the desktop renderer build after the recent core refactors:
  - added an exact `@nile/core/models/connection/requirements` export
  - added `packages/core/src/models/connection/Requirements.ts` as a built dist entry
  - moved browser/runtime imports off the broad `@nile/core/models/connection` barrel
- Kept the fix narrow instead of changing the whole core build strategy:
  - `renderer/shared/ApplyRequirements.ts` now imports the browser-safe requirements entry directly
  - `state/connection/List.ts` now imports `CONNECTION_APPLY_REQUIREMENTS` from that exact entry and uses `@nile/core/models/agent/types` for label formatting
- This avoids dragging node-only core chunks like `node:sqlite`, `node:fs`, and `node:crypto` into the renderer bundle.

### Verification

- `npm run typecheck`
- `node --import tsx ./build.ts` (from `apps/desktop`)

### Browser-safe core import guardrails

- Removed `ConnectionApplyRequirements` exports from the broad `@nile/core/models/connection` barrel so the browser-safe `requirements` subpath is the only runtime entry for that behavior.
- Switched remaining browser-safe desktop files to narrower imports:
  - renderer/detail/quick-setup agent types now use `@nile/core/models/agent/types`
  - desktop state types now use `@nile/core/models/connection/requirements`
- Hardened the core build against export drift:
  - `packages/core/build.mjs` now validates that every exact `package.json` export points at a real built dist artifact
  - added the missing `actions/*` and `models/connection/Requirements.ts` entries to the core build graph so those exports are genuinely produced
- Added a desktop static boundary test at:
  - `apps/desktop/src/renderer/CoreImportBoundaries.test.ts`
  - it prevents browser-safe sources from importing the broad `@nile/core/models/agent` or `@nile/core/models/connection` barrels at runtime

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/CoreImportBoundaries.test.ts`
- `npm run typecheck`
- `node --import tsx ./build.ts` (from `apps/desktop`)
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts`

### Agent card section split

- Split the agent-list card body into smaller renderer pieces:
  - `renderer/agents/list/LocalSetupSection.tsx`
  - `renderer/agents/list/CurrentConnectionPanel.tsx`
- Reduced `renderer/agents/list/Card.tsx` to card-shell composition plus agent-specific routing decisions.
- Kept the shared switch/model-save orchestration in `useConnectionSwitchFlow.ts`, so the new list sections remain presentational.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts`

### Quick setup env-key helper and save progress

- Fixed desktop managed-environment writes in source/dev runtime by resolving the keychain helper from the workspace `packages/core/dist/...` path before falling back to colocated helper locations.
- This removes the half-finished `Save to Nile` state where a connection could be imported but the follow-up `NILE_*` managed env key failed to persist because the helper binary could not be found.
- Added lightweight quick-setup save progress hints so long-running `Save to Nile` actions can show staged feedback:
  - `Saving this setup in Nile`
  - `Checking connection support`
  - `Preparing managed environment key`
- Kept the progress UI renderer-only and time-based; no new IPC progress channel was introduced.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/Store.test.ts apps/desktop/src/renderer/quick-setup/SaveState.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts`
- `npm run typecheck`

### Action cluster rename

- Renamed the shared core action clusters to make their scope clearer:
  - `packages/core/src/actions/current-state` -> `packages/core/src/actions/live-setup`
  - `packages/core/src/actions/local-state` -> `packages/core/src/actions/local-setup`
- Updated core exports, runtime imports, desktop imports, CLI imports, and active architecture/spec references to use the new names.
- Kept the rename narrow: old historical build-log prose was not mass-rewritten.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/actions/live-setup/Matcher.test.ts packages/core/src/actions/local-setup/Status.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Unified apply requirements and import semantics

- Removed the stale `DesktopSurface.importDetectedSetups(...)` path so desktop detected-setup imports now go through the same gateway-managed import semantics everywhere.
- Added a core `ConnectionApplyRequirementsReader` and exposed per-agent apply requirements on desktop agent connection rows.
- Switched the OpenClaw-specific UI gating in:
  - agent detail connection switching
  - agent list card switching
  - quick-setup existing-connection selection
  to consume the shared requirement object instead of repeating `if openclaw` checks inline.
- Replaced the ad hoc imported-enabled-agent logic in current-state import with `SHARED_CONNECTION_AGENT_POLICY.readSavedConnectionConfig(...)` so gateway/shared-agent defaults come from the same policy source as the rest of the connection model.
- Kept the `current-state` / `local-state` split intact:
  - `current-state`: match/import one agent's live setup against saved connections
  - `local-state`: scan and summarize local setups across agents/machine state

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/Requirements.test.ts packages/core/src/actions/live-setup/Import.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Save-to-Nile matched import semantics

- Narrowed the matched `Save to Nile` path so it no longer rewrites user-managed connection metadata.
- Matched saves now:
  - refresh endpoint protocols/capabilities
  - update the stored credential
  - preserve the existing connection label and enabled-agent list
  - persist the current agent model when present
  - clear a previously saved model when the live setup no longer has one
- Aligned desktop `currentAgentConnections` with configurable-agent semantics so Codex-compatible shared connections appear consistently before they are explicitly enabled.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/actions/live-setup/Matcher.test.ts packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Save-to-Nile matched import fixes

- Changed current-state import so `valid_matched` setups no longer short-circuit before import enrichment.
- Matched `Save to Nile` now still:
  - runs gateway capability refresh/probe for importable gateway setups
  - reuses/upserts the existing connection
  - persists the current agent-level selected model
- Added support for carrying `modelId` through resolved import candidates instead of only legacy `openclawModelId`.
- Updated current-state matching so legacy `access.openclawModelId` only affects OpenClaw matching; Claude/Codex API-key matching now ignores stale OpenClaw-only model metadata.
- Aligned `SavedConnections.listForAgent()` with configurable-agent semantics so core callers no longer disagree with the desktop UI about which shared connections are available to an agent.

### Verification

- `node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/actions/live-setup/Matcher.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npm run typecheck`

### Gateway OpenClaw capability consistency

- Fixed generic gateway onboarding so detected `openai` or `anthropic` protocols also suggest `openclaw`, preventing follow-up direct-key env updates from silently dropping `openclaw` out of `enabledAgents`.
- Tightened saved-connection capability derivation for gateway endpoints to use detected protocols instead of treating every gateway as universally configurable for all agents.
- Updated the Connections list UI to show `configurableAgents` in the `Capability` column rather than `enabledAgents`, so the page reflects what a connection supports instead of only what is currently enabled.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/SavedConnections.test.ts packages/core/src/models/connection/setup/OnboardingPolicy.test.ts packages/core/src/models/connection/AgentPolicy.test.ts`
- `npm run typecheck`

### Gateway live-setup matching

- Fixed Claude gateway live-setup reconciliation so saved generic-gateway connections are not treated as "new setup" solely because the current local config uses `ANTHROPIC_API_KEY` while the saved endpoint metadata was probed/merged with `ANTHROPIC_AUTH_TOKEN`.
- Relaxed endpoint subset matching to ignore env-var-name overrides when comparing current live setup against saved endpoint capability.
- Further relaxed gateway subset matching so a saved probed endpoint with `/v1` protocol base paths still matches a live Claude setup that only records the root gateway URL and omits the protocol path.
- Added `packages/core/src/actions/live-setup/Matcher.test.ts` to cover the gateway env override mismatch case.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Matcher.test.ts`
- `npm run typecheck`

### Save-to-Nile gateway import performance

- Removed the redundant second generic-gateway capability probe that used to happen immediately after `Save to Nile` for direct API-key connections.
- Direct API-key imports still keep the original key and still get a managed `NILE_*` env key, but attaching that `envKey` now updates only credential metadata instead of going back through the full connection update/probe pipeline.
- Added a narrow saved-connections path for updating `envKey` on direct API-key credentials without changing endpoint capability metadata.
- This specifically speeds up `Claude -> Save to Nile` for gateway API-key setups because the post-import managed-env step no longer re-runs `/v1/models`, `/v1/responses`, and anthropic capability checks.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts`
- `npm run typecheck`

### Save-to-Nile credential semantics and shared-connection consistency

- Matched `Save to Nile` no longer downgrades user-managed API-key credential mode while refreshing a saved connection from live state.
- Added a narrow credential sync path that updates secret material without rebuilding `apiKeySource` / `envKey` metadata.
- Aligned menubar agent connection availability with `configurableAgents`, matching the desktop settings surfaces.
- Made batch detected-setup imports run the same managed `NILE_*` env-key ensure step as single-agent `Save to Nile`.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Managed env-backed API keys for OpenClaw

- Added a desktop-managed environment store for `NILE_*` API-key entries backed by keychain storage.
- Direct API-key connections now keep their original direct credential while also recording an optional `envKey`.
- Desktop add/update/import flows now auto-provision a managed `NILE_*` env entry for direct API-key connections and persist the `envKey` onto the saved connection.
- OpenClaw apply now accepts API-key credentials when an `envKey` is present and readable, even if the credential source remains `direct`.
- Agent and quick-setup OpenClaw gating now checks for `envKey` presence instead of requiring `apiKeySource === "env_key"`.
- Reset now clears managed `NILE_*` entries before workspace state is deleted.
- Saved connection summaries now surface `envKey` for direct API-key connections so renderer state can distinguish “direct only” from “direct plus managed env”.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/agents/openclaw/ApplySelection.test.ts packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/electron/state/Reset.test.ts`

### Detected model ordering

- Changed merged gateway model catalogs to surface OpenAI/Codex probe results before Claude gateway cache results.
- Prioritized the current/closest selected model in the OpenClaw model picker so switching flows do not bury `gpt-*` or `codex-*` beneath a long `claude-*` list.
- Reordered the connection detail `Detected models` preview and full modal so OpenAI/Codex families appear first when both families are available on the same gateway connection.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/application/local/ConnectionModelCatalog.test.ts`
- `npm run typecheck`

### OpenClaw list switch model gate

- Wired the agent list view through `onUpdateAgentConnectionModel(...)` so OpenClaw list-card connection switching now uses the same model-before-switch dialog path as agent detail.
- Fixed the missing `DesktopConnection` type import in the list card after reusing the shared model dialog state there.

### Model switch dialog refresh

- Forced the agent model selection dialog to request a fresh connection model catalog when it opens instead of reusing the 10-minute detected-model cache.
- Kept the 10-minute cache for passive browsing surfaces such as connection detail, but model-before-switch now prioritizes live capability data.

### OpenClaw env-key gating

- Added a renderer-side gate for `OpenClaw + direct API key` so save-and-switch no longer falls through to the raw `ApplySelectionValidationError`.
- The model dialog now explains that OpenClaw requires env-backed API key connections and, in agent detail, offers an `Edit connection` path to fix the key source.
- Applied the same guard to quick setup and the agent list-card switch flow.

### OpenClaw switch model selection

- Changed the OpenClaw agent connections list so non-current connections always keep the `Switch` action.
- When OpenClaw tries to switch to a connection without a saved model, the switch action now opens the existing model dialog instead of throwing an apply validation error.
- Saving the model from that dialog immediately continues the pending switch, so model selection and apply happen in one flow.
- Renamed the agent-detail model label to `Selected model` to distinguish it from connection-level `Detected models`.

### Verification

- `npm run typecheck`

### Generic gateway model detection merge

- Found that older generic-gateway connections imported before capability re-probe only carried `anthropic` in saved endpoint metadata.
- `Detected models` was therefore stopping at the Claude gateway cache and never probing live OpenAI-compatible `/v1/models`, even on refresh.
- Updated `ConnectionModelCatalog` so generic-gateway API-key connections:
  - always try the Claude gateway cache
  - also probe OpenAI-compatible `/v1/models` when credentials are readable, even if saved metadata has no `openai` protocol yet
  - merge and de-duplicate both model sources in the UI
- This makes Refresh meaningful for mixed-protocol gateways like `llmfk.dpdns.org`.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/application/local/ConnectionModelCatalog.test.ts`
- `npm run typecheck`

### Detected models refresh state

- Made the Detected models refresh button show a dedicated manual refresh state instead of reusing only the initial-loading flag.
- The button now enters a visible rotating state immediately on click and stays disabled until the forced refresh finishes.

### Verification

- `npm run typecheck`

### OpenClaw model-required switch guard

- Confirmed the OpenClaw connections list was exposing a raw apply validation error when switching to a non-current connection without a saved model.
- The list now treats `modelId` as a required precondition for OpenClaw:
  - non-current connections without a saved model show `Set model` instead of `Switch`
  - clicking that action opens the existing model editor rather than attempting apply
- Removed the duplicate inline switch error because the page-level action error already covers apply failures.

### Verification

- `npm run typecheck`

### Generic gateway current-setup import capability re-probe

- Changed current-setup import to re-probe `generic-gateway + api_key` candidates before upsert instead of trusting the source agent's partial local-state protocol view.
- This lets imports from Claude/OpenClaw current setup discover OpenAI-compatible capability on the same gateway and save the merged endpoint protocols.
- For probed gateway imports, enabled agents are now derived from detected protocols:
  - `openai` -> `codex`
  - `anthropic` -> `claude`
  - either protocol -> `openclaw`
- Kept the import path tolerant: if the gateway probe fails, import falls back to the original candidate instead of blocking the user.
- Async-widened the `import current connection` and `import detected setups` chain so the probe can run without leaking resources across adapter/session boundaries.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/agents/codex/import/ImportCurrentConnection.test.ts packages/core/src/agents/openclaw/ImportCurrentConnection.test.ts apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`

### Gateway model catalogs in shared connection flows

- Extended `ConnectionModelCatalog` with a second source for gateway-backed connections.
- Claude/OpenClaw-compatible gateway API-key connections now first consult Claude's local `gateway-models.json` cache before falling back to protocol-specific network model detection.
- This fixes shared gateway connections that support OpenClaw but do not expose an OpenAI `/models` route from being shown as undetectable in quick setup.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/application/local/ConnectionModelCatalog.test.ts`
- `npm run typecheck`

### Quick setup OpenClaw model fallback

- Updated the quick-setup existing-connection modal for OpenClaw so model detection failure no longer blocks the flow.
- When detected models are available, the modal still uses a model selector.
- When models cannot be detected, the modal now falls back to a manual model input and still allows `Use` once a model is provided.
- Kept the explicit `Set model` fallback entry for users who want to finish setup from the full agent detail page instead.

### Verification

- `npm run typecheck`

### Agent model editor recommendations

- Split the agent-detail model editor out of `ConnectionsSection.tsx` to keep the connections list component under the 500-line repo limit.
- Replaced the plain freeform model dialog input with a recommended-but-editable editor:
  - it fetches detected models for the selected connection
  - exposes them as native datalist suggestions
  - keeps freeform typing available for models outside the detected catalog
- Kept model changes agent-specific and preserved current-only apply behavior:
  - saving a model still updates `(agent, connection) -> modelId`
  - only the agent's current connection is re-applied immediately after save
  - non-current connections are updated without triggering apply

### Verification

- `npm run typecheck`

### Connection detected models

- Wired the existing core `ConnectionModelCatalog` service through runtime, desktop IPC, and preload so renderer code can fetch detected models on demand for a specific saved connection.
- Kept model detection out of global `SettingsState`; connection detail now queries it lazily instead of bloating the full desktop state refresh path.
- Updated connection detail to render `Quota left` and `Detected models` as side-by-side half-width cards on large layouts.
- Added a dedicated `Detected models` card with:
  - refresh action
  - comma-separated preview
  - `...More` expansion into a modal for the full model list
- Added coverage for the model-catalog fetch path for:
  - `openai_session`
  - env-backed `api_key`
- Added translation keys for the new detected-models UI across all supported desktop languages.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/application/local/ConnectionModelCatalog.test.ts packages/core/src/models/connection/GatewayProbe.test.ts`

### OpenAI session model detection

- Corrected official `openai_session` model detection so it no longer probes `https://api.openai.com/v1/models` with a ChatGPT/Codex session token.
- Official OpenAI session-backed connections now use the Codex session catalog endpoint:
  - `https://chatgpt.com/backend-api/codex/models?client_version=1.0.0`
- Kept API key and env-key connections on the existing OpenAI-compatible `/v1/models` path.
- Updated `ConnectionModelCatalog` parsing so official session responses read model `slug` values from the Codex catalog payload.
- Verified against the real `jay-ji` connection after the code change:
  - previous result: `403` from `api.openai.com/v1/models`
  - intermediate result with old `client_version=0.27.0`: `available`, but only `gpt-5.2`
  - current result with `client_version=1.0.0`: `available`, returning the full modern Codex model set

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/application/local/ConnectionModelCatalog.test.ts`

### Cached model catalogs and quick setup model selection

- Added a desktop-side `ConnectionModelCatalog` cache with a 10-minute TTL so detected models are not re-fetched on every routine renderer open.
- Kept cache invalidation explicit:
  - connection detail uses cached results by default
  - the `Refresh` button forces a fresh fetch
  - quick setup forces a fresh fetch for OpenClaw model selection so setup uses the latest catalog
- Extended the desktop connection-model IPC to accept `{ connectionId, forceRefresh? }` instead of a bare id.
- Updated quick setup so OpenClaw can now complete the shared-connection path inline:
  - choose an existing compatible connection
  - fetch detected models for that connection
  - select a model in the same modal
  - save `(openclaw, connection) -> modelId`
  - immediately use/apply the connection
- Kept a fallback path for connections that still do not expose a readable model catalog:
  - the modal shows a clear unavailable message
  - the user can jump to the full agent model setup flow

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/connections/ModelCatalog.test.ts packages/core/src/application/local/ConnectionModelCatalog.test.ts`

### Shared session import enabled agents

- Fixed current-state import so official shared session connections do not stay source-agent-only after quick setup.
- `openai_session` imports now default-enable `codex` and `openclaw` together when the imported endpoint is OpenAI-compatible.
- `claude_session` imports now default-enable `claude` and `openclaw` together when the imported endpoint is Anthropic-compatible.
- Kept `api_key` and gateway imports on the existing conservative path so we do not implicitly enable unrelated agents there.
- Added regression coverage at:
  - `packages/core/src/actions/live-setup/Import.test.ts`
  - `packages/core/src/agents/codex/import/ImportCurrentConnection.test.ts`
  - `packages/core/src/agents/openclaw/ImportCurrentConnection.test.ts`

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/agents/codex/import/ImportCurrentConnection.test.ts packages/core/src/agents/openclaw/ImportCurrentConnection.test.ts`
- `npm run typecheck`

### Quick setup existing connection modal

- Changed quick setup `Configure now` to prefer existing compatible saved connections before sending the user straight into add-connection.
- Added a quick setup modal that appears when an agent has compatible saved connections but no detected local setup.
- The modal offers two paths:
  - use an existing compatible connection
  - add a new connection
- Using an existing connection now ensures the chosen agent is added to `enabledAgents` before applying, so older shared connections do not land in a half-enabled state.
- Kept the change scoped to quick setup for now; the main Agents page still uses the previous direct add flow.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts packages/core/src/actions/local-setup/Status.test.ts packages/core/src/agents/codex/current-state/Detector.test.ts packages/core/src/agents/claude/current-state/Reader.test.ts packages/core/src/agents/openclaw/current-state/Detector.test.ts`

### Step 78: Align desktop source versioning with released builds

- Updated `apps/desktop/package.json` and `apps/desktop/package-lock.json` to `0.15.1` so the checked-in desktop package version now matches the latest shipped desktop release instead of staying on the long-lived `0.0.0` placeholder.
- Changed the desktop release workflow to validate version alignment instead of mutating it in CI:
  - `.github/workflows/desktop-release.yml` now fails if `apps/desktop/package.json` does not already match the pushed `v<semver>` tag.
- Updated desktop version presentation so development state depends on packaging mode instead of the old placeholder version:
  - `DesktopApplicationMenu` now shows `Development build` only for unpackaged dev runs
  - `UpdateSection` now shows the real checked-in version for packaged builds
  - auto-update availability now keys off `isPackaged` rather than `0.0.0`
- Updated `docs/desktop-release.md` to reflect the new release discipline:
  - bump `apps/desktop/package.json` before tagging
  - keep source version and release tag aligned
  - local signed builds now use the checked-in desktop version directly
- Result:
  - local signed test builds can report a real desktop version
  - release builds and source state now use one consistent version contract
  - the workflow no longer hides version drift by silently rewriting package metadata in CI

### Verification

- `npm run test:desktop`
- `npm run typecheck`
- `git diff --check -- . ':(exclude)error.log'`

### Step 77: Hide static API key fields for auth.json imports

- Tightened `renderer/connections/add/PostPreparation.tsx` so static credential inputs only render for `api_key` auth mode.
- Kept the `auth.json` import path field visible for session imports, but removed the unrelated API key / env key inputs from that flow.
- Passed the selected auth mode from `renderer/connections/add/Page.tsx` into the post-preparation renderer so the UI now follows the actual connection method instead of always showing credential fields.
- Added `PostPreparation.test.ts` to lock the visibility rule:
  - `api_key` shows static credential fields
  - `openai_session` hides them
  - `claude_session` hides them
- Result:
  - importing `auth.json` no longer suggests that an API key is also required
  - the add-connection form now reflects the real credential model for session-based flows

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 76: Refresh the desktop state-performance plan to the grouped desktop structure

- Updated `.vestin/plans/desktop-state-performance.md` with a current-status section so the document now clearly distinguishes:
  - the original request-oriented baseline
  - the current grouped desktop implementation
- Repointed stale file references to the current desktop paths:
  - `electron/shell/DesktopMain.ts`
  - `state/Surface.ts`
  - `renderer/app/settings/App.tsx`
  - `actions/local-setup/Status.ts`
- Updated the state-layer notes so they now reference the current desktop ownership boundaries under:
  - `electron/state`
  - `shell/DesktopMain`
- Result:
  - the desktop performance plan remains useful design context without pretending the old flat file layout still exists

### Verification

- `git diff --check -- . ':(exclude)error.log'`

### Step 75: Sync the desktop V2 plan to the current grouped desktop structure

- Updated `.vestin/architect.md` and `.vestin/plans/desktop-v2.md` so the durable desktop architecture docs now describe the current grouped implementation:
  - `electron/ipc`
  - `electron/shell`
  - `electron/state`
  - `electron/connections`
  - `electron/updates`
  - `state/`
  - workflow-oriented renderer directories
- Added explicit structural rules to the desktop V2 plan so future desktop work preserves:
  - Electron process separation
  - desktop-owned state caching in `apps/desktop`
  - shared-core ownership of business rules
  - workflow-oriented renderer organization
- Result:
  - `.vestin` no longer presents the original flat desktop structure as if it were still current
  - the desktop plan now reads as a durable boundary document instead of only an early backlog

### Verification

- `git diff --check -- . ':(exclude)error.log'`

### Step 71: Split tray menu orchestration out of DesktopMain

- Added `shell/TrayMenu.ts` so tray-specific behavior now closes inside one shell-local collaborator:
  - menubar state refresh with stale-cache fallback
  - tray menu template building
  - tray-triggered connection switching
- Removed tray menu presentation and switching behavior from `shell/DesktopMain.ts`, leaving `DesktopMain` focused on lifecycle wiring and process orchestration.
- Result:
  - `DesktopMain` no longer mixes lifecycle composition with tray menu rendering
  - the tray menu now has one obvious place to evolve without re-growing the main shell entrypoint

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 72: Pull settings-page flow state out of the app shell

- Added `renderer/app/settings/useFlow.ts` to own settings-surface flow state for:
  - desktop reset
  - quick-setup completion/dismissal
  - add-connection return-page routing
- Removed those flow handlers from `renderer/app/settings/App.tsx` so the app shell goes back to composition and wiring.
- Result:
  - `SettingsApp` no longer mixes page composition with reset and quick-setup flow bookkeeping
  - page-level flow state now has one local hook instead of growing ad hoc inside the shell component

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 73: Split switch and error policy out of DesktopSurface

- Added `state/ConnectionSwitcher.ts` so the desktop state surface no longer owns connection-switch follow-up behavior:
  - switch apply
  - current connection resolution
  - usage refresh for previous and new current connections
- Added `state/ErrorNormalizer.ts` so stale-schema reset guidance no longer lives inline inside `Surface.ts`.
- Kept `Surface.ts` as the session/query boundary, but removed command detail and error-policy detail from it.
- Result:
  - `DesktopSurface` is closer to a pure state/session entrypoint
  - switch follow-up and stale-schema error policy now each have one explicit owner

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 74: Remove stale desktop leftovers after the workflow split

- Deleted `createDefaultDesktopSurface()` from `state/Surface.ts` because nothing in the desktop app uses that old convenience entrypoint anymore.
- Removed `DesktopSurface.switchConnection()` and the now-unreachable `state/ConnectionSwitcher.ts` path:
  - production switching already goes through `electron/state/DesktopStateStore` -> `electron/connections/DesktopConnectionGateway`
  - the old surface-level command path was only being kept alive by tests
- Moved reused-connection continuation routing out of `renderer/app/settings/Dialogs.tsx`:
  - dialog composition no longer applies add-connection return targets directly
  - `useConnectionActions` now owns the reused-connection continue flow
- Updated desktop state tests to seed current connection through direct session setup instead of the removed surface command path.
- Result:
  - one dead desktop surface export removed
  - one stale parallel switch path removed
  - dialog layer no longer carries page-routing policy left over from earlier flow structure

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 70: Expose reset from the fatal desktop error shell

- Kept core schema migration behavior strict instead of adding duplicate-column compatibility for damaged local databases.
- Updated the settings app fatal error shell so users can still trigger desktop state reset even when:
  - `getSettingsState()`
  - `getHistoryState()`
  fail during initial load.
- Reused the existing `desktop:reset-state` IPC path, but surfaced it directly from the error shell instead of requiring the normal settings page and reset dialog to load first.
- Result:
  - a broken local database no longer traps users in a retry-only screen
  - users can self-recover without manually deleting the SQLite file

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 69: Fix renderer asset path regressions and browser-safe core imports

- Replaced repeated direct `nile-mark.svg` imports with one renderer-local shared module:
  - `renderer/shared/NileMark.ts`
- Updated the settings and quick-setup surfaces to use that shared asset module so workflow directory moves no longer break long relative asset paths.
- Fixed the renderer-side agent label helper to import from the browser-safe `@nile/core/models/agent/types` entry instead of the wider `@nile/core/models/agent` barrel.
- Result:
  - desktop renderer build no longer fails on missing `nile-mark.svg`
  - browser bundling no longer pulls `models/agent/Homes` and its `node:fs` dependency into the settings bundle

### Verification

- `npm run build -w @nile/desktop`
- `npm run test:desktop`
- `npm run typecheck`

## 2026-05-05

### Step 59: Re-group add-connection renderer code by workflow

- Added `architecture-target.md` at the repo root to define the human-oriented target structure for future migrations.
- Re-grouped desktop add-connection renderer code into `renderer/connections/add/` so the full add workflow closes inside one local directory:
  - `Page`
  - `Header`
  - `GatewayPreparation`
  - `PostPreparation`
  - `PresetCard`
  - `Types`
  - `useForm`
  - `useOnboardingState`
  - `usePageState`
- Kept truly shared connection files at `renderer/connections/`:
  - `ConnectionFormParts.tsx`
  - `AuthJsonPath.ts`
- Updated settings-surface imports to consume the new add-workflow paths directly.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 60: Re-group edit-connection renderer code by workflow

- Re-grouped the desktop edit-connection flow into `renderer/connections/edit/`:
  - `Page`
  - `useEditState`
  - `useGatewayState`
- Kept the connection list and shared form primitives outside the workflow directory:
  - `ConnectionsPage.tsx`
  - `ConnectionFormParts.tsx`
  - `AuthJsonPath.ts`
- Updated the connections list to enter the edit workflow through the new local path instead of sharing one flat `connections/` namespace for every page and hook.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 61: Re-group connection-detail renderer code by workflow

- Re-grouped the connection-detail page into `renderer/connections/detail/`:
  - `Page`
  - `ActionGroup`
- Kept truly shared connection display helpers outside the detail workflow:
  - `ConnectionQuotaSection.tsx` because the agent detail surface also uses it
  - `ProviderDisplay.tsx` because the table and toolbar both use it
- Updated the connections list to route detail rendering through the new workflow-local page path.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 62: Re-group connections-list renderer code by workflow

- Re-grouped the main saved-connections list into `renderer/connections/list/`:
  - `Page`
  - `Table`
- Kept `ConnectionsToolbar.tsx` at the `connections/` root because the agent detail surface also uses it.
- Updated settings-page routing so the connections surface enters through the new workflow-local list page path.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 63: Re-group connection dialogs under a local workflow cluster

- Moved connection-specific dialogs into `renderer/connections/dialogs/`:
  - `RepairUsage`
  - `Reused`
- Kept `SettingsDialogs.tsx` as the app-level orchestration surface, but stopped it from importing those dialog implementations from a flat `connections/` namespace.
- Updated `architecture-target.md` so the target desktop renderer structure now explicitly includes `connections/dialogs/`.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 64: Re-group settings page and dialogs by local workflow

- Moved the main settings surface into `renderer/settings/general/`:
  - `Page`
  - `Section`
  - `UpdateSection`
- Moved settings-owned dialogs into `renderer/settings/dialogs/`:
  - `Nile`
  - `ResetState`
- Updated the app shell to depend on those workflow-local settings paths instead of a flat `settings/` namespace.
- Updated `architecture-target.md` so the target renderer structure now explicitly includes:
  - `settings/general/`
  - `settings/dialogs/`

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 65: Re-group agent detail files by workflow

- Moved the agent detail flow into `renderer/agents/detail/`:
  - `Page`
  - `ConnectionsSection`
  - `HistorySection`
  - `HomeSection`
- Updated all agent detail type imports so the app shell, list view, and cards read `AgentDetailTab` from the new detail entry point.
- Updated `architecture-target.md` so the target renderer structure now explicitly includes `agents/detail/`.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 66: Re-group agent list files by workflow

- Moved agent list-only files into `renderer/agents/list/`:
  - `View`
  - `Card`
  - `Toolbar`
- Kept agent-wide shared primitives at the `agents/` root:
  - `AgentCardHeader.tsx`
  - `AgentIconStack.tsx`
  - `AgentIcons.ts`
- Updated the agent page to route list rendering through the new workflow-local list view path.
- Updated `architecture-target.md` so the target renderer structure now explicitly includes `agents/list/`.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 67: Re-group settings-surface app shell files

- Moved settings-surface app orchestration into `renderer/app/settings/`:
  - `App`
  - `Chrome`
  - `Dialogs`
  - `PageContent`
  - `SidebarNav`
  - `useData`
  - `usePreferences`
  - `useReleaseInfo`
  - `useConnectionActions`
  - `useNavigation`
  - `useSidebarState`
- Kept renderer app root for actual entry files and frame assets:
  - `settings.tsx`
  - `menubar.ts`
  - `settings.html`
  - `menubar.html`
  - `styles.css`
- Updated `architecture-target.md` so the target renderer structure now explicitly includes `app/settings/`.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 68: Re-group Electron main-process files by runtime responsibility

- Re-grouped `renderer`-clean main-process code under `src/electron/` by stable runtime boundary:
  - `ipc/`
  - `shell/`
  - `state/`
  - `connections/`
  - `updates/`
- Kept Electron entry and bridge root files at the `electron/` top level:
  - `main.ts`
  - `preload.ts`
  - `types.ts`
- Removed the stray `apps/desktop/src/electron/Untitled` file because it was dead workspace residue, not source code.
- Updated `architecture-target.md` so the target desktop structure now explicitly includes the Electron runtime grouping.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 58: Shrink SettingsApp orchestration

- Extracted desktop release-info polling into `useDesktopReleaseInfo`.
- Extracted settings connection command orchestration into `useSettingsConnectionActions`, including:
  - add/save prepared connection completion flow
  - import/use/remove/rollback/update wiring
  - connection-detail navigation handoff
- Reduced `SettingsApp.tsx` from 388 lines to 286 lines so the app shell is closer to navigation/layout composition and less of an orchestration bucket.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Desktop shared-support and auto-update helper split

- Split shared renderer formatting helpers out of `renderer/shared/Support.ts`:
  - `OpenClawIssueFormatter`
  - `TimeFormatter`
- Kept `Support.ts` focused on:
  - definition filtering/order helpers
  - connection/agent display helpers
  - history/sync label selection
- Split updater-library support helpers out of `AutoUpdateManager` into `AutoUpdateSupport`:
  - update-availability detection
  - update-electron-app logger adapter
  - release version extraction
  - fallback release status selection
- Reduced the remaining desktop support hotspots to:
  - `Support.ts` -> 170 lines
  - `AutoUpdateManager.ts` -> 263 lines

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Desktop add-connection page section split

- Split the large `AddConnectionPage` conditional render surface into focused section components:
  - `AddConnectionGatewayPreparation`
  - `AddConnectionPostPreparation`
- Kept `AddConnectionPage` focused on:
  - page-level orchestration
  - state hook wiring
  - method selector
  - top-level submit-mode branching
- Reduced the renderer hotspot sizes to:
  - `AddConnectionPage.tsx` -> 302 lines
  - `AddConnectionGatewayPreparation.tsx` -> 86 lines
  - `AddConnectionPostPreparation.tsx` -> 157 lines

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Desktop prepared-draft store split

- Split prepared connection draft lifecycle out of `DesktopConnectionManager` into `DesktopPreparedDraftStore`.
- Moved these draft-only responsibilities out of the command manager:
  - TTL expiry
  - capacity eviction
  - timeout scheduling
  - read/discard/clear lifecycle
- Kept `DesktopConnectionManager` focused on:
  - add/update command execution
  - onboarding description
  - credential request resolution
  - connection summary mapping
- Reduced the desktop hotspot sizes to:
  - `DesktopConnectionManager.ts` -> 304 lines
  - `DesktopPreparedDraftStore.ts` -> 85 lines

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 57: Split add-connection page shell and onboarding state machine

- Split renderer add-connection shared types into `connections/AddConnectionTypes.ts` so the page, settings content, and hooks no longer import those DTOs from the state hook file.
- Split `AddConnectionPage` into a thinner page shell plus focused presentational pieces:
  - `AddConnectionHeader`
  - `AddConnectionPresetCard`
- Reduced `AddConnectionPage.tsx` from 504 lines to 434 lines, bringing it back under the repo 500-line limit.
- Extracted gateway probing and onboarding capability resolution from `useAddConnectionPageState` into `useAddConnectionOnboardingState`.
- Reduced `useAddConnectionPageState.ts` from 410 lines to 246 lines so it now focuses on draft/auth-json/submit flow instead of carrying the full onboarding state machine.

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 55: Add explicit desktop data error state and retry UI

- Updated `useDesktopData()` so renderer IPC reads no longer surface as unhandled promise rejections.
- Added explicit `error` and `isLoading` state for desktop settings data reads.
- Added two UI paths in `SettingsApp`:
  - full-screen retry state when initial desktop state load fails
  - inline destructive alert with refresh action when background refresh fails but stale data is still renderable

### Verification

- `npm run typecheck`

### Agent detail model settings

- Added a first-class agent-specific model setting path to the desktop bridge:
  - core runtime now exposes `getAgentConnectionModel(...)` / `setAgentConnectionModel(...)`
  - desktop main/preload now exposes `desktop:update-agent-connection-model`
- Kept model ownership attached to `(agentId, connectionId)` instead of the shared connection record.
- Started surfacing that setting in desktop settings state:
  - `SettingsState.agents[].connections[]` now carries `agentModelId` for the active agent context
  - the global Connections page and menubar state stay unchanged
- Added a lightweight model editor to Agent detail → Connections:
  - new `Model` column on desktop
  - mobile cards also show/edit the same value
  - edit goes through a small dialog and supports clearing the setting
- Kept this out of connection add/edit flows so model selection is no longer required during shared connection creation.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`

### Agent-specific model settings

- Added a shared `agent_connection_settings` SQLite table for per-agent model choices instead of treating `openclawModelId` as a connection-owned source of truth.
- Wired core apply/current-state/import flows to read and persist model settings through the new agent/connection layer while keeping legacy access-field migration compatibility.
- Expanded shared-session connection capability reporting so OpenAI and Claude session families advertise OpenClaw as configurable without requiring a legacy connection-level model field up front.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/agent-settings/Settings.test.ts packages/core/src/models/connection/SavedConnections.test.ts packages/core/src/actions/live-setup/Import.test.ts packages/core/src/agents/openclaw/ImportCurrentConnection.test.ts packages/core/src/agents/openclaw/ApplySelection.test.ts packages/core/src/agents/openclaw/current-state/Detector.test.ts packages/core/src/agents/claude/RollbackLatestMutation.test.ts packages/core/src/agents/cursor/RollbackLatestMutation.test.ts packages/core/src/projection/Resolver.test.ts packages/core/src/models/connection/Catalog.test.ts`
- `npm run typecheck`

### Shared session connection capability

- Traced the `configurableAgents / enabledAgents` chain through `ConnectionAgentPolicy`, onboarding, and saved-connection summaries.
- Removed the `openclawModelId` gate from shared-connection capability detection so compatible OpenAI / Azure OpenAI / Anthropic connections now advertise `OpenClaw` as a configurable agent even when the saved connection does not yet persist an OpenClaw model.
- Updated connection catalog definitions so the desktop add/edit flows understand `OpenClaw` as a compatible agent for:
  - `openai`
  - `azure-openai`
  - `anthropic`
- Kept default enabled agents conservative (`Codex` / `Claude`) because the desktop connection UI still has no `openclawModelId` field, so capability exposure is now decoupled from immediate OpenClaw apply readiness.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/Catalog.test.ts packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`
- `npm run typecheck`

### Desktop architecture cleanup

- Split settings notification target routing out of `renderer/app/settings/App.tsx` into:
  - `renderer/app/settings/useNotificationTargetNavigation.ts`
  - `renderer/app/settings/Shell.tsx`
- Reduced `App.tsx` back under the repository file-size limit and removed duplicated notification target routing logic.
- Split desktop notification and alert state access out of `electron/state/DesktopStateStore.ts` into:
  - `electron/state/NotificationHistoryState.ts`
  - `electron/state/ConnectionAlerts.ts`
- Split Electron bridge contracts by domain:
  - `electron/notifications/contracts.ts`
  - `electron/connections/contracts.ts`
  - `electron/app/contracts.ts`
  - `electron/profiles/contracts.ts`
  - `electron/state/contracts.ts`
  - `electron/updates/contracts.ts`
  - `electron/Bridge.ts`
- Kept `electron/types.ts` as a thin compatibility re-export instead of a catch-all contract module.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts`

### Notification reset metadata

- Added optional `resetAt` metadata to desktop notification intents and persisted notification history rows.
- Usage-threshold and usage-renewed alerts now store the current quota reset time alongside the notification history entry.
- Added SQLite schema upgrade for `desktop_notification_history.reset_at`.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts`
- `npm run typecheck`

### Profile/notification follow-up hardening

- Added a SQLite schema upgrade path for `desktop_workspace_profile_assignments` so earlier SQLite-backed profile builds that lacked `home_path_kind` are upgraded in place instead of failing profile reads/writes.
- Moved Notifications page filtering down into SQLite queries:
  - `kind=alerts` and `connectionId` now filter before `LIMIT`, so connection-specific history no longer disappears behind the latest global 200 rows
  - `Mark all read` now operates on the server-filtered result set instead of a renderer-side slice
- Stopped the connection alert evaluator from retaining stale per-metric observations after a connection, metric, or enabled alert disappears.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts`
- `npm run typecheck`

### Profile/notification semantics follow-up

- Refined the legacy `desktop_workspace_profile_assignments` SQLite upgrade so old rows without `home_path_kind` are backfilled conservatively:
  - `home_path != null` becomes `value`
  - `home_path == null` with a `connection_id` becomes `unset`
  - only rows with both `home_path == null` and `connection_id == null` become explicit `null`
- Added a real “mark all read for current filter” path in notification history:
  - SQLite now updates all matching rows without the UI page limit
  - the Notifications page keeps row-level mark-read separate from bulk mark-all-read
- Restored deleted-connection history discoverability in the Notifications connection selector by merging current saved connections with labels present in the loaded history entries.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts`
- `npm run typecheck`

### Notification history follow-up

- Added a distinct notification-history connection query so the Notifications filter selector no longer depends on whatever happens to be in the current page slice.
- Changed `Mark all read` to a true filter-level operation in SQLite instead of reusing the row-level mark-read path with currently loaded entry ids.
- Kept row click / row action behavior on the single-entry mark-read path so table interactions still stay lightweight.
- Tightened the legacy profile-assignment schema upgrade again so ambiguous old rows preserve connection-only assignments as `unset` instead of silently becoming an explicit default-home reset.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/profiles/Store.test.ts`
- `npm run typecheck`

### Notification event split and alert label snapshots

- Added a dedicated renderer notification-history event so notification-only changes no longer piggyback on the full desktop state refresh path.
- Removed the extra state-change broadcast when opening the settings window from a macOS notification click; the history-change event now covers unread-state updates by itself.
- Persisted `metricLabel` alongside each saved connection alert and used that snapshot as the fallback display label when live usage metrics are temporarily unavailable.
- Kept alert editing workable during metric outages by:
  - preserving the saved metric label in the edit dialog selector
  - sorting and rendering saved alerts by the label snapshot instead of degrading back to canonical metric keys

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/alerts/Store.test.ts apps/desktop/src/electron/alerts/Overlay.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/state/NotificationMuteStore.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/state/UsageSummary.test.ts apps/desktop/src/state/Surface.test.ts`

### Desktop local config sqlite migration

- Migrated desktop-only local config off standalone JSON files and into the desktop SQLite database:
  - agent home overrides
  - notification mute preference
  - profile feature enablement
  - workspace profiles and assignments
  - connection alert rules
- Kept each existing store interface stable so the renderer and main-process call sites did not need a broad rewrite.
- Added one-time legacy JSON import for each store:
  - reads the old file on first access when the SQLite table is still empty
  - imports valid records into SQLite
  - removes the legacy JSON file after migration
- Kept store-specific legacy tolerance rules during migration:
  - mute + alerts degrade malformed legacy files to defaults
  - profile feature + agent homes still reject invalid top-level config shapes
- Preserved profile assignment tri-state home semantics in SQLite:
  - unset home override
  - explicit reset-to-default (`null`)
  - explicit custom path
- Left `desktop_notification_history` in SQLite and aligned the rest of desktop local state with it so desktop config/history now live in one storage system.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/AgentHomesStore.test.ts apps/desktop/src/electron/state/NotificationMuteStore.test.ts apps/desktop/src/electron/state/ProfileFeatureStore.test.ts apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts apps/desktop/src/electron/alerts/Store.test.ts apps/desktop/src/electron/alerts/Overlay.test.ts apps/desktop/src/electron/state/Reset.test.ts`

### Notifications mute selector

- Changed the global `Mute notifications` control in Settings from a switch to the same selector pattern used by other desktop feature toggles.
- Kept the underlying notification mute state and persistence unchanged; this is a UI consistency pass only.

### Verification

- `npm run typecheck`

### Notifications history table cleanup

- Reframed the notifications history `Type` column to show broad notification categories instead of alert subtypes.
- Removed the dedicated `Read` column and moved unread state to a dot in the notification cell.
- Made notification rows mark themselves read on click without navigating away; opening the related page stays on the explicit action button.
- Grouped notification filters on the left side of the toolbar and kept bulk actions on the right so filter controls read as one unit.
- Moved `Mark all read` and `Refresh` into the shared segmented button-group pattern used by other desktop detail actions.
- Added an unread dot to the top-right bell button whenever any notification history entry remains unread.
- Tightened the notifications toolbar layout so tabs, connection filter, clear-filters action, and the right-side button group stay in a single wrapped row on narrower widths.

### Verification

- `npm run typecheck`


### Global notification history

- Added a SQLite-backed desktop notification history store so every delivered macOS notification can be reviewed later without changing the existing JSON-backed alert configuration.
- Routed history through the shared desktop notification service:
  - delivered notifications are logged after successful macOS delivery
  - click-throughs mark the matching history entry as opened
  - history logging is best-effort and does not block notification delivery
- Added a global `Notifications` page behind the top-right bell entry instead of expanding connection detail into a second history surface.
- Kept connection detail focused on alert configuration and added a lightweight history entry there that deep-links into the global notifications page with `alerts + current connection` filters applied.
- The new history page supports:
  - `All` vs `Alerts` filtering
  - connection filtering
  - reopening the related page for a recorded notification
- Extended tray failure notifications and usage alert notifications with subject metadata so the history page can show concise, readable sources.
- Polished the page into a more standard shadcn-style data view:
  - one header + one bordered table card
  - toolbar filters live in the card header instead of a separate filter summary strip
  - connection detail uses a lightweight history action rather than embedding another tabbed history surface
- Refined the history table to the simpler product-facing shape:
  - `Notification`, `Time`, `Type`, `Read`, `Actions`
  - removed the extra `Source` column
  - added `Mark all read` in the toolbar
  - separated `read` from `opened` by persisting a dedicated `read_at` field instead of inferring read state from click-throughs

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`
- `npm run typecheck`

### Global notification mute

- Added a main-backed global `Mute notifications` setting that pauses all macOS notification delivery without changing any alert rule `enabled` state.
- Stored the mute flag separately from profile feature settings so alert configuration remains intact while notifications are muted.
- Wired the mute state into the shared desktop notification service rather than into individual alert evaluators, so all current and future notification sources respect the same global gate.
- Added a Settings toggle for notification mute and kept the default behavior unmuted.
- Included the new notification-mute file in desktop local-state reset so reset clears the global notification gate as well.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/NotificationMuteStore.test.ts apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/state/Reset.test.ts`
- `npm run typecheck`

### Connection renewed alerts

- Extended connection usage alerts to support a second alert type: `renewed`.
- Kept low-usage alerts as-is and upgraded the alert model to a discriminated union instead of overloading threshold rules.
- Updated the connection alert store to:
  - persist `renewed` alerts
  - reject duplicate renewed alerts per `connection + metric`
  - keep backward compatibility by reading older threshold-only alert rows as `low-percent`
- Updated the connection detail Alerts UI:
  - add/edit modal now lets the user choose between `Low usage` and `Renewed`
  - renewed alerts do not require a threshold input
  - alert table now shows alert type and a condition column instead of assuming every rule is threshold-based
- Extended the evaluator to send macOS notifications when a metric renews:
  - first preference is a changed `resetsAt` timestamp plus a recovering remaining percentage
  - fallback is a conservative large recovery from a lower percentage back to a high remaining percentage
  - avoided the brittle `remainingPercent === 100` shortcut

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/alerts/Store.test.ts apps/desktop/src/electron/alerts/Overlay.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run typecheck`

### Connection alert table simplification

- Removed the `Remaining` column from the connection detail Alerts table because it did not materially help rule management.
- Replaced the `On` / `Off` badge in the `Status` column with a shadcn-style inline toggle switch.
- Toggling a rule now saves immediately without opening the edit modal; edit is only needed for changing type, metric, or threshold.
- Added a shared renderer `ui/switch.tsx` component backed by `@radix-ui/react-switch`.

### Verification

- `npm run typecheck`

### Connection usage alerts

- Added a main-backed `desktop-connection-alerts.json` store for connection-level usage alerts.
- Extended desktop connection view state with:
  - `alertMetrics` derived from structured usage windows
  - persisted `alerts`
  - `activeAlertCount`
- Decorated settings-state connections through a dedicated alert overlay instead of pushing alert persistence down into shared/core usage code.
- Added connection alert IPC/bridge methods for create, update, and delete.
- Built the first real alert-management UI in connection detail:
  - `Quota left` now has an `Alerts` section directly underneath
  - alert rules render as a table
  - add/edit uses a modal
  - remove is inline
- Kept this first version intentionally scoped to low-remaining-percentage alerts only.
- Moved the Connections list `Alerts` count to the final column and kept the zero state blank.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/alerts/Store.test.ts apps/desktop/src/electron/alerts/Overlay.test.ts apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run typecheck`

### Connection alert evaluation and notification delivery

- Added a dedicated connection usage alert evaluator and attached it to the desktop refresh chain.
- Low-usage alerts now trigger from refreshed usage state instead of sitting as stored configuration only.
- Evaluation rules in this first version:
  - only enabled alerts participate
  - alerts trigger only when a metric crosses from at-or-above a threshold to below it
  - the first observation does not notify
  - when one metric crosses multiple thresholds in a single refresh, Nile sends only the most severe one
  - after recovery above a threshold, a later drop can notify again
- Triggered notifications reuse the shared macOS notification service and open the related connection detail when clicked.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/alerts/Store.test.ts apps/desktop/src/electron/alerts/Overlay.test.ts apps/desktop/src/electron/alerts/Evaluator.test.ts apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run typecheck`

### macOS notification foundation

- Added a dedicated desktop notification layer for macOS system notifications under `apps/desktop/src/electron/notifications/`:
  - `MacNotificationCenter` owns the Electron `Notification` integration
  - `DesktopNotificationService` owns dedupe/cooldown and click handling
  - notification payloads now carry stable `scope`, `kind`, and `target` fields so future connection/agent/profile reminders can reuse the same path
- Added a renderer-safe notification navigation contract:
  - main can now send `desktop:notification-target`
  - preload exposes `window.nileDesktopEvents.onNotificationTarget(...)`
  - settings app consumes those targets and opens the related page/detail without exposing renderer routing to main
- Wired the first real use into tray failures so the foundation is exercised end-to-end:
  - failed tray profile apply shows a macOS notification that opens the related profile page
  - failed tray connection switch shows a macOS notification that opens the related connections page

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run typecheck`

### Connections alert-count column

- Added an `activeAlertCount` field to desktop connection view state so connection list surfaces can show alert totals without depending on the future alert-rule storage shape.
- Updated the Connections list table and mobile cards to show a new `Alerts` column/field.
- The count stays blank when there are no active alerts, which matches the intended quiet default.
- Seeded the presenter and typed test fixtures with `activeAlertCount: 0` so the UI shape is ready for the upcoming connection-level usage alert rules.

### Verification

- `npm run typecheck`

### Profile current-state cleanup

- Switched tray profile state reads onto the lightweight settings snapshot path so opening the macOS menu no longer forces a full usage-refresh-grade settings read just to resolve the current profile.
- Tightened current profile detection to return one unique winner only:
  - more specific profile assignments beat looser subset matches
  - ties now resolve to no current profile instead of whichever profile happened to be listed first
- Included `desktop-profile-feature.json` in desktop local-state reset so `Reset local state` clears the profile feature gate alongside profiles and agent homes.
- Replaced profile detail save's split rename/assignment writes with a single atomic profile update so metadata and assignments cannot overwrite each other through concurrent file writes.
- Replaced create-profile's split create-then-update flow with a single create call, and held create->detail navigation on a pending profile id so the page no longer bounces back to the list while profile refresh is still catching up.
- Added a tray-menu fallback when the profile feature config file is invalid so menubar profile access degrades to the default enabled state instead of throwing during menu construction.
- Simplified profile detail editing:
  - emoji changes now auto-save immediately
  - connection changes now auto-save immediately
  - home-path edits still stay local until the user clicks `Save`
  - `Apply` / `Current` now sit outside the detail action group, leaving the grouped actions focused on `Save` and `Remove`

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/profiles/CurrentProfile.test.ts apps/desktop/src/electron/state/Reset.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts`
- `npm run typecheck`

### Menubar profile submenu

- Added a menubar `Profile` submenu between `Open Main Window` and the per-agent switchers.
- The submenu label now reflects the current matched workspace profile:
  - `emoji + name` when current state matches a saved profile
  - `Profile` when no saved profile currently matches
- Added direct profile apply actions in the menubar submenu and reused the same current-profile matching logic as the renderer sidebar.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run typecheck`

### Profile feature gate

- Added a desktop-local `useProfiles` feature flag backed by a main-process store instead of renderer-only `localStorage`.
- Added a new Settings section for `Use Profile` so the preference can be enabled or disabled from the desktop settings surface.
- Wired the flag into settings navigation and route fallback so turning it off hides the Profiles page and sidebar entry, and exits any open profile page.
- Wired the same flag into the tray menu so all profile-related menubar entries disappear when profile usage is disabled.
- Kept saved profile data intact when the flag is disabled; this only gates visibility and apply entry points.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/ProfileFeatureStore.test.ts apps/desktop/src/electron/shell/TrayMenu.test.ts`
- `npm run typecheck`

### Profile card simplification

- Simplified profile list cards to focus on account mode instead of full assignment detail.
- Removed assignment counts and default-home display from the list view.
- Moved `Current` into the title line, kept `More` in the top-right corner, and moved `Apply` to the bottom-right action area.
- Reduced the card body to an agent-to-connection summary, with custom homes and missing connections shown only as muted exception lines.

### Verification

- `npm run typecheck`

### Sidebar current profile label

- Added shared current-profile matching helpers for renderer profile surfaces.
- After a successful profile apply, the settings sidebar now replaces the generic `Profiles` nav item with the current profile's emoji and name.
- Kept the fallback behavior unchanged: if no profile matches current agent state, the sidebar still shows the default `Profiles` label with the workflow icon.

### Verification

- `npm run typecheck`

### Unique profile names

- Added workspace-profile name uniqueness checks in the desktop profile store so both create and rename reject duplicate names after trimming and case-folding.
- Added renderer-side duplicate-name validation for profile create and edit so the user sees an inline warning before saving, and the save action stays disabled while the name conflicts.
- Mapped duplicate-name store errors back to the same localized inline message in the renderer so race cases do not surface raw backend strings.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts`
- `npm run typecheck`

### Chinese i18n catch-up

- Filled the remaining `zh` overrides that were still falling back to English for:
  - provider label
  - connection search/filter/empty-state copy
  - connection edit sync confirmation copy
  - update-check transient status copy

### Verification

- ad hoc key diff: `zh missing: 0`

### Full i18n override completion

- Filled the remaining explicit translation overrides for `de`, `es`, `fr`, `it`, `ja`, `ko`, `th`, and `vi` so those catalogs no longer rely on English spread fallbacks for the recently added profile, connection-filter, OpenClaw issue, agent home, update-state, and related shared UI copy.
- Kept the existing `...EN_MESSAGES` fallback structure intact, but every current English key is now explicitly overridden in all shipped language catalogs.

### Verification

- ad hoc key diff:
  - `de missing: 0`
  - `es missing: 0`
  - `fr missing: 0`
  - `it missing: 0`
  - `ja missing: 0`
  - `ko missing: 0`
  - `th missing: 0`
  - `vi missing: 0`
  - `zh missing: 0`

### Empty default create name

- Changed the create-profile form so the new profile name starts empty instead of prefilled with `Nilo`.
- This avoids showing a duplicate-name error immediately when an existing profile already uses that name, and keeps the create flow consistent with explicit user input before save.

### Minimal profile apply and current marker

- Wired the existing desktop profile apply IPC into the settings UI so profiles can now be explicitly applied from both the list card and the detail page.
- Added a lightweight `Current` marker based on real-time state matching instead of storing a separate “active profile id”.
- The current-marker logic now reads the real current agent connection/home state without editor fallbacks and treats a profile as current when every saved assignment in that profile is satisfied by the live state.
- Reused a single in-page apply loading state across list and detail and surfaced apply failures through the existing destructive alert style.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts`
- `npm run typecheck`

### Profile emoji as card icon

- Stopped rendering profile emoji inline with the profile name.
- Profile list cards now use the saved emoji to replace the leading default icon, while titles and breadcrumbs stay text-only and continue to update live from the profile name.
- Removed the old profile label helper because profile display now separates icon treatment from name rendering.

### Verification

- `npm run typecheck`

### Emoji picker theme sync

- Removed the hardcoded dark theme from the profile emoji picker.
- The picker now follows Nile's resolved renderer theme by observing the document theme state, so fixed light, fixed dark, and system-driven changes all stay visually aligned with the rest of the app.

### Verification

- `npm run typecheck`

### Profile meta editor alignment

- Replaced the custom hardcoded profile emoji grid with `emoji-picker-react` so profile create/edit now uses a real picker while keeping the emoji trigger and name field as one input group.
- Moved the profile name and emoji editor above the agent assignment table in profile detail so edit matches the create-page layout.
- Removed the extra create-page helper sentence below the profile meta editor to keep the page focused on the actual form.
- Updated create and edit titles/breadcrumb labels to reflect the current in-progress profile name and emoji instead of staying static until save.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts`
- `npm run typecheck`

### Profile detail cleanup

- Removed the extra profile summary block from profile detail so the page no longer repeats the profile name and assignment count above the editor.
- Removed the standalone card wrapper around the profile name and emoji editor in both create and edit so that section sits directly in the page flow above the assignment table.

### Verification

- `npm run typecheck`

### Profile emoji and name editing

- Added persisted optional profile emoji metadata.
- Profile create now supports choosing an emoji and naming the profile before save.
- Profile detail now supports editing both emoji and name, and saves those changes together with assignment edits.
- Added a lightweight built-in emoji picker dialog so profile emoji selection does not require a third-party dependency.
- Updated profile titles/cards to render `emoji + name` when an emoji is present.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts`
- `npm run typecheck`

### Profile assignment table layout

- Replaced the repeated per-agent profile assignment cards with a single shared table layout.
- Removed the repeated descriptive copy from each agent row.
- The shared editor now renders assignments as `Agent | Connection | Home | Reset Default`, and both profile create and profile detail/edit reuse that same table module.

### Verification

- `npm run typecheck`

### Profile create page reuse

- Moved profile creation out of the list page into a dedicated create page.
- Extracted the profile assignment editor into a shared renderer module so create and detail/edit now reuse the same assignment cards, empty-state handling, and assignment normalization logic.
- Profile creation now starts from current state, lets the user adjust assignments before saving, then creates the profile and applies those edited assignments immediately.

### Verification

- `npm run typecheck`

### Profile remove dialog stability

- Fixed the profile detail remove dialog closing itself during background state refreshes.
- Root cause: profile detail was resetting local UI state on every profile/agent refresh, which also forced the remove dialog closed.
- Narrowed that reset path so it only runs when the selected profile changes, instead of on every background refresh tick.

### Verification

- `npm run typecheck`

### Remove confirmation dialogs

- Replaced the inline two-click remove confirmation with real modal confirmation dialogs.
- Added a shared confirm dialog component for destructive actions in detail pages.
- Connection detail remove now opens a confirmation dialog before deletion.
- Profile detail remove now opens the same style of confirmation dialog before deletion.
- Kept the grouped detail action buttons while moving the second confirmation step into the dialog.

### Verification

- `npm run typecheck`

### Detail action groups and remove confirmation

- Extracted a shared detail action group so profile detail and connection detail use the same segmented button treatment.
- Changed profile detail header actions to the grouped `Save` + `Remove` layout.
- Changed connection detail removal to a two-step inline confirmation flow.
- Changed profile detail removal to the same two-step inline confirmation flow.
- The first remove click now enters a `Confirm remove` state; only the second click executes deletion.

### Verification

- `npm run typecheck`

### Profile detail inline assignment editing

- Reworked the profile detail page so each agent assignment can be edited in place instead of using a separate apply action.
- Added direct per-agent editing for:
  - saved connection selection
  - home path override
- Connection changes now save immediately.
- Home path edits debounce briefly and then auto-save, with a small saving/status hint in the UI.
- Kept destructive profile removal inside the detail page and removed the detail-level apply control.
- Added desktop IPC/profile store support for updating profile assignments directly from the renderer.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts`

### Profile detail save flow adjustment

- Removed the profile detail auto-save behavior after review.
- Profile assignment edits now stay local until the user clicks the shared `Save` action in the detail header.
- Placed the shared `Save` action before `Remove`.
- Moved the home reset affordance next to the home input so users can quickly reset that field to the default path before saving.

### Verification

- `npm run typecheck`

### Profiles detail view and destructive action placement

- Added a dedicated profile detail screen under the existing Profiles page flow, with breadcrumb back navigation and assignment details.
- Changed profile cards so the top-right action now matches the agent list pattern:
  - `More` opens the detail screen
- Moved destructive profile removal out of the list card and into the detail screen.
- Kept profile creation available from the list-level header even after profiles already exist.

### Verification

- `npm run typecheck`

### Profiles page add and delete entry points

- Updated the desktop Profiles page so create-profile entry remains available even after profiles already exist, instead of only showing when the list is empty.
- Added per-profile action buttons for:
  - apply
  - delete
- Kept the reset-profile refresh fix intact while reusing the existing profile create/delete IPC flows.

### Verification

- `npm run typecheck`

### Reset refreshes workspace profiles immediately

- Fixed desktop reset flow so the settings renderer now refreshes workspace profiles explicitly after `desktop:reset-state`, instead of only relying on the asynchronous `state-changed` broadcast.
- This closes the local bug where reset could clear `desktop-profiles.json` on disk but leave stale profile cards visible until a later refresh.
- Added a focused renderer-flow regression test for the reset sequence.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/app/settings/useFlow.test.ts apps/desktop/src/electron/state/Reset.test.ts apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`

### Desktop reset clears local profile state

- Kept shared core `StateReset` scoped to workspace database/history/keychain cleanup so CLI semantics stay unchanged.
- Added a desktop-local reset wrapper that now also removes:
  - `desktop-profiles.json`
  - `desktop-agent-homes.json`
- Reset now also clears in-memory desktop-only runtime state by:
  - resetting the live `agentHomes` overrides back to the startup/default map
  - clearing prepared add-connection drafts still held by the desktop process
- Updated desktop reset copy to match the actual behavior in English and Chinese.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/state/Reset.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`
- `npm run typecheck`
- `npm run test:desktop`

### Desktop quick-setup and shared-text cleanup

- Renamed the `renderer/quick-setup/` files to short local names so that workflow now reads as one coherent cluster instead of repeating `QuickSetup*` in every file:
  - `Page`
  - `Guide`
  - `AgentCard`
  - `DetectedSetup`
- Removed the catch-all `renderer/shared/Support.ts` bucket and split it into focused shared files:
  - `DesktopData`
  - `Definitions`
  - `AgentSelection`
  - `DisplayText`
- Updated renderer imports so state aliases, definition helpers, agent-selection helpers, and display formatting no longer travel through one mixed helper module.

### Verification

- `npm run typecheck`
 
### Sanitize sensitive fixture literals

- Replaced residual real-looking test fixture identifiers with generic placeholders in desktop/core tests and build notes.
- Cleared the local `apps/desktop/.env.release` values so the workspace no longer retains notarization secrets under the project tree.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts packages/core/src/agents/codex/current-state/Detector.test.ts packages/core/src/models/connection/SavedConnections.test.ts packages/core/src/services/credential/KeychainCredentialStore.test.ts packages/core/src/models/connection/Labeler.test.ts`
- `npm run test:desktop`

### Step 54: Split workspace watching out of DesktopMain

- Extracted `DesktopWorkspaceWatcher` so file-watch lifecycle, relevance filtering, debounce, and ignore windows no longer live inside `DesktopMain`.
- Rewired `DesktopMain` to delegate workspace watch start/stop and refresh suppression to the new watcher.
- Reduced `DesktopMain.ts` from 511 lines to 463 lines, bringing it back under the repo's 500-line limit.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 53: Stop swallowing desktop refresh failures

- Extracted `DesktopStateRefresher` so desktop refresh policy is testable outside `DesktopMain`.
- Replaced the `Promise.allSettled()`-based refresh path with strict `Promise.all(...)` orchestration for full desktop refreshes.
- Kept the standalone menubar-usage refresh tolerant for startup/background use, but stopped that tolerance from leaking into the main `refreshDesktopState()` path.
- Added focused tests covering:
  - renderer notification only after successful strict refresh
  - no renderer notification on failed menubar state refresh
  - no renderer notification on failed usage refresh during strict refresh
  - tolerant standalone usage refresh remaining non-fatal

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 52: Bound prepared desktop drafts and clear abandoned secrets

- Added TTL-backed prepared draft expiry in `DesktopConnectionManager` so onboarding drafts do not keep credentials in Electron main-process memory indefinitely.
- Added an explicit prepared-draft capacity limit so repeated draft creation cannot grow the cache without bound.
- Added `clearPreparedConnectionDrafts()` and wired it into desktop window dismiss and app quit so abandoned drafts are scrubbed when the desktop surface is closed.
- Added focused regression tests for:
  - explicit draft discard
  - ttl expiry
  - capacity eviction
  - window-dismiss style bulk cleanup

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 51: Remove leftover renderer single-file directory

- Moved `renderer/lib/cn.ts` into `renderer/ui/cn.ts` so the classless utility lives beside the UI primitives that consume it.
- Removed the now-empty `renderer/lib/` source directory instead of carrying a one-file directory shell.
- Repointed renderer UI imports to the new local path.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`
- `git diff --check -- . ':(exclude)error.log'`

### Step 50: Split desktop draft workflows from session command gateway

- Added `DesktopConnectionGateway` for direct session commands that do not own desktop-specific draft/onboarding rules:
  - import current connection
  - remove connection
  - bind Cursor usage
  - auto-bind all missing Cursor usage sessions
- Kept `DesktopConnectionManager` focused on:
  - add/update connection flows
  - onboarding capability detection
  - prepared draft lifecycle
- Rewired `DesktopStateStore` to depend on both:
  - `DesktopConnectionManager` for draft-aware workflows
  - `DesktopConnectionGateway` for plain session commands
- Updated the desktop binding regression test to assert against the new gateway instead of the draft manager.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 49: Split desktop IPC and presentation responsibilities

- Split `DesktopIpcController.register()` into state, connection, update, and app route groups so each IPC route class receives only the dependencies it needs.
- Split desktop bridge typing into state, update, connection, and app bridge capabilities while preserving the existing `window.nileDesktop.*` renderer API.
- Extracted shared desktop connection credential input fields to remove repeated auth/session fields across add/update/onboarding IPC payload types.
- Extracted `DesktopConnectionPresenter` from `DesktopSurface` for connection DTO projection, selected-agent display, live/current connection resolution, and agent label formatting.
- Extracted `DesktopUsageCache` from `DesktopSurface` for usage TTL, refresh batching, and read-failure fallback behavior.
- Removed the pure connection-definition forwarding method from `DesktopConnectionManager`; IPC routes now read the shared catalog directly.
- Removed the unused single-connection desktop auto-bind forwarding method; desktop only uses explicit bind and background auto-bind-all.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 48: Harden desktop IPC boundaries and state-cache invalidation

- Added a dedicated `DesktopIpcInputValidator` for Electron main-process IPC inputs.
- Moved desktop IPC registration into `DesktopIpcController` so `DesktopMain` stays focused on app composition and Electron lifecycle.
- Moved macOS menu and About panel setup into `DesktopApplicationMenu`, bringing `DesktopMain` back under the 500-line source-file limit.
- Routed connection onboarding and draft IPC directly to `DesktopConnectionManager` instead of passing through `DesktopStateStore`, keeping the state store focused on cached state and mutations that invalidate it.
- Routed static connection definitions directly to `DesktopConnectionManager` and removed the unnecessary `DesktopStateStore` cache entry for catalog data.
- Changed desktop mutation IPC handlers to accept `unknown` at the boundary and validate before calling state/application services.
- Covered the high-risk IPC inputs:
  - add/update connection payloads
  - prepared connection draft save/discard payloads
  - selected agent IDs
  - connection IDs
  - Cursor usage binding tokens
  - agent-home update paths
- Tightened external-link handling so desktop only opens HTTPS URLs from renderer-triggered flows.
- Tightened provider catalog official links to require HTTPS at load time.
- Wired desktop reset through the `CredentialStore` already owned by `DesktopMain`, avoiding accidental reset against a different credential backend.
- Fixed `DesktopStateStore` cache invalidation with per-cache versioning so stale in-flight refreshes cannot mark newly invalidated state as clean.
- Added focused regression tests for:
  - IPC payload validation
  - provider HTTPS enforcement
  - stale in-flight state refresh invalidation

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 47: Make desktop release notes explicit and versioned

- Replaced GitHub's generated release-note fallback with a repository-owned source of truth under `release-notes/`.
- The desktop release workflow now requires a matching `release-notes/<tag>.md` file before it will package or publish a desktop release.
- GitHub Release creation and reruns both now use that file as the release body, so the published notes stay stable and reviewable instead of drifting across manual reruns.
- Added:
  - `release-notes/README.md` to define the convention
  - `release-notes/TEMPLATE.md` as the drafting starting point for each new version
- Extended the `nile-desktop-release` skill so desktop release work now includes release-note drafting and validation as a first-class part of the flow.

### Verification

- `git diff --check -- . ':(exclude)error.log'`

### Step 46: Add local pre-push verification for release-safe pushes

- Added `husky` at the repo root and installed a `pre-push` hook.
- The hook now runs `npm run verify:pre-push`, which checks:
  - `npm run typecheck`
  - `npm test`
  - `npm run desktop:build`
- This specifically protects the desktop release path by catching local regressions before tags or pushes reach GitHub Actions.
- While validating the hook, it reproduced the same failure captured in `error.log`:
  - `packages/core/src/services/credential/KeychainCredentialStore.test.ts`
  - the test expectation had not been updated after the writer call shape started including `type: "write"`
- Updated that stale assertion so local pre-push verification and CI agree again.

### Verification

- `npm run prepare`
- `npm run verify:pre-push`

### Step 45: Add a settings entry for desktop version and manual update checks

- Added a dedicated updates section to desktop settings so users can:
  - see the current Nile desktop version
  - trigger a manual update check from settings
- Refined the settings presentation away from a large alert-driven block into a compact control row:
  - current version shown as the primary value
  - refresh control kept as a small inline action
  - once a newer build is downloaded, the row expands to `current -> next` and exposes an explicit `Update` button
- Exposed release metadata and manual update-check IPC from the Electron main process through preload.
- Extended the auto-update manager to report release availability and to trigger non-blocking manual checks:
  - packaged `macOS` and `Windows` builds can start a background check on demand
  - development builds and unsupported platforms show an inline unavailable state instead of a broken action
  - transient updater startup/check failures still degrade to non-blocking results and warning logs
- Disabled the library's default update-downloaded prompt so desktop settings owns the install action explicitly.
- Kept all new settings copy routed through the desktop translation catalog.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/AutoUpdateManager.test.ts`
- `npm run test:desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Step 44: Enable packaged desktop auto-updates from public GitHub Releases

- Added a dedicated `AutoUpdateManager` in the Electron main process and wired it into desktop startup after `app.whenReady()`.
- The packaged app now enables `update-electron-app` against the public `vestin-io/Nile` GitHub repository:
  - only in packaged builds
  - only on Electron-supported auto-update platforms (`macOS` and `Windows`)
  - with explicit logging around startup and failure paths
- Added focused tests for the updater manager so packaged, unpackaged, unsupported-platform, and startup-failure behavior stays covered.
- Tightened the desktop release workflow and operating docs to require `v<semver>` tags only.
- Root cause:
  - Electron's public update service expects releases whose tags are SemVer-compatible
  - this repository's desktop release flow had been using `desktop-v*` tags
  - those tags are suitable for GitHub releases but are not compatible with the public in-app update feed Nile now uses
- Documented the remaining channel behavior:
  - stable `v<semver>` releases can auto-update in-app
  - GitHub prereleases stay download-only because Electron's public update service ignores prerelease releases
- Follow-up hardening:
  - auto-update initialization now runs on a background task after startup instead of inline with the main startup path
  - upstream updater fetch failures such as repository access loss are downgraded to non-blocking warnings so Nile keeps launching normally

### Verification

- `./apps/desktop/node_modules/.bin/vitest run apps/desktop/src/electron/AutoUpdateManager.test.ts`
- `npm run test:desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

## 2026-05-04

### Step 43: Unpack the desktop keychain helper so reset works in packaged apps

- Fixed packaged desktop builds failing keychain-backed actions such as local state reset.
- Root cause:
  - desktop build copies `KeychainGenericPasswordHelper` into `dist/electron/`
  - electron-builder was packing that native executable into `app.asar`
  - packaged runtime then tried to spawn the helper from the asar virtual filesystem
  - macOS cannot execute the helper from inside asar, so reset failed while removing Nile-managed keychain credentials
- Added an `asarUnpack` rule for `dist/electron/KeychainGenericPasswordHelper` so packaged apps keep the helper outside the archive.
- Updated helper path resolution to prefer `app.asar.unpacked` candidates before in-archive paths, while preserving the existing repo-local and dev build lookup flow.
- Added a focused test for packaged asar helper path ordering.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/services/credential/GenericPasswordWriter.test.ts`
- `npm run typecheck`
- `npm run build:app --prefix apps/desktop`

### Step 42: Keep quick-setup save buttons pending until Nile confirms the import

- Fixed the desktop quick-setup and agent-card import button transition so it no longer falls back to `Save to Nile` between the loading spinner and the final saved checkmark.
- Root cause:
  - the renderer button only tracked a local `isSaving` flag
  - that flag cleared as soon as the import IPC returned
  - desktop state confirmation arrived slightly later through the renderer refresh path
  - the gap briefly re-rendered the idle button before the saved state landed
- Updated the detected-setup action state to stay in a pending-confirmation phase until the card is actually confirmed saved or the local setup no longer needs an import action.
- Followed through by refreshing desktop settings immediately after `importCurrentConnection(...)` resolves so both quick setup and the Agents page converge on the confirmed state faster and more deterministically.
- Added a focused renderer-state test for the pending-confirmation helper.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/quick-setup/SaveState.test.ts`
- `npm run typecheck`

### Step 41: Probe real agent homes before assuming hidden dot-directories

- Updated core agent-home defaults to prefer real existing install roots before falling back to hardcoded dot-directories.
- Added common macOS fallback candidates so Nile can find local agent state on machines that do not store Codex or other agent files under `~/.codex`, `~/.claude`, and similar legacy paths.
- Current default probing order:
  - Codex: `~/Library/Application Support/Codex`, then `~/.codex`
  - Cursor: `~/.cursor`, then `~/Library/Application Support/Cursor`
  - Claude: `~/.claude`, then `~/Library/Application Support/Claude`
  - OpenClaw: `~/.openclaw`, then `~/Library/Application Support/OpenClaw`
- Tightened file-read error handling for Codex and Claude state files:
  - missing files still read as "not configured"
  - permission-denied and other read failures now surface with explicit file-path context instead of collapsing into a generic missing-state result
- Follow-up fix:
  - directory existence alone was too loose for Codex and Claude because app support folders can exist without containing Nile's target state files
  - default home probing now keys off the presence of real marker files such as `auth.json`, `config.toml`, `settings.json`, and `.credentials.json`
  - this restores Codex detection to `~/.codex` on machines where `~/Library/Application Support/Codex` exists only as app shell data

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/agent/Homes.test.ts`
- `npm run typecheck`

### Step 37: Keep agent icons colorful across themes

- Switched desktop agent icons from monochrome `currentColor` SVG variants to the library's color SVG variants:
  - Codex
  - Cursor
  - Claude Code
  - OpenClaw
- Removed the theme-specific `agent-tone-*` color classes from the agent card header and icon stack.
- This keeps the agent brand marks visually consistent across light and dark themes instead of turning them black/white in light mode.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `git diff --check`

### Step 38: Brand the dev macOS host icon

- Fixed desktop dev mode still showing the Electron app icon for the app bundle and the macOS About panel.
- Root cause:
  - the dev launcher already copied `Electron.app` into a temporary Nile host
  - but it only rewrote the bundle name and identifier
  - the copied host still kept Electron's bundled `electron.icns`
- Updated `DesktopLauncher` to replace the copied host icon resource with `apps/desktop/build/icons/icon.icns` when present.
- Added a focused launcher test to verify the copied dev host icon gets overwritten with the Nile icon asset.
- Followed up on a dev/runtime mismatch:
  - this machine's `iconutil` is currently failing and leaving `build/icons/icon.icns` stale
  - the packaged build configuration already points at `build/icons/icon.png`
  - desktop runtime surfaces on macOS now use `icon.png` too, so the dock/window/About icon matches the actual build output even when `icon.icns` is behind

### Verification

- `./apps/desktop/node_modules/.bin/vitest run apps/desktop/src/DesktopLauncher.test.ts`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`

### Step 39: Fix repeated Codex agent icon rendering in connection tables

- Fixed the connection table's Codex agent icon disappearing on larger layouts.
- Root cause:
  - the colored Codex and OpenClaw SVG variants include gradient `<defs>` with fixed ids
  - desktop renders the same inline SVG multiple times on a page
  - duplicate gradient ids collide in the DOM, so only the white base path survives and the colored mark disappears
- Updated agent icon rendering to namespace inline SVG ids per rendered instance.
- Wired unique instance ids through both the agent card header and the agent icon stack so repeated inline icons stay visually intact.

### Verification

- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `git diff --check`

### Step 40: Increase Codex icon size in agent stacks

- Increased the Codex icon size in shared agent icon stacks so it reads more clearly in connection tables and other compact list views.
- Kept the larger sizing specific to Codex to avoid throwing off the visual balance of the other agent marks.
- Matched that adjustment in the Agents page header cards so Codex reads slightly larger there as well without changing the card shell size.

### Verification

- `npm run build --prefix apps/desktop`
- `npm run typecheck`

### Step 35: Tighten keychain writes and prepared desktop draft lifecycle

- Replaced the prompt-suppression workaround that pushed secrets into `security -w <secret>` argv with a native macOS Keychain write helper built from Swift during `packages/core` build.
- The new helper writes generic-password items through the Security framework and receives the secret over stdin:
  - no misleading terminal password prompt in desktop dev flows
  - no API keys, session tokens, or rollback snapshots exposed through child-process argv
- Updated the shared credential, secure snapshot, and Cursor credential stores to use the explicit helper-backed generic-password write API instead of generic `-w` placeholder argument rewriting.
- Split the macOS write path out of `SecurityCli` into a dedicated `GenericPasswordWriter` so responsibilities are explicit:
  - `SecurityCli` now only wraps direct `security` command execution for read/delete operations
  - `GenericPasswordWriter` owns helper resolution and stdin-backed generic-password writes
- Added focused coverage for the helper-backed write path and kept the keychain payload format single and canonical.
- Added an explicit desktop prepared-draft discard path so session credentials prepared for add-connection flows do not stay resident in main-process memory after the user backs out without saving.
- Fixed `auth.json` default path follow-up behavior:
  - add-connection no longer gets stuck on the initial default before settings finish loading
  - edit-connection no longer resets the whole form when the default Codex home changes
  - both surfaces now only replace the path when the user is still on the previous default
- Removed the root TypeScript package alias indirection and let repo-local apps resolve `@nile/core` and `@nile/host-local` through their actual symlinked package dependencies again.
- Updated the root desktop test script back to the simple root-based vitest entry once package resolution was stable again.

### Verification

- `npm run build:core`
- `./node_modules/.bin/vitest run packages/core/src/services/credential/SecurityCli.test.ts packages/core/src/services/credential/GenericPasswordWriter.test.ts packages/core/src/services/credential/SecretCodec.test.ts packages/core/src/services/credential/KeychainCredentialStore.test.ts`
- `./node_modules/.bin/vitest run apps/desktop/src/electron/DesktopConnectionManager.test.ts apps/desktop/src/renderer/connections/AuthJsonPath.test.ts`
- `npm run test:desktop`
- `npm run typecheck`
- `npm run start -- --help`
- `git diff --check`

### Step 36: Prefer matched live saved connections in desktop state

- Fixed desktop agent/current-connection state so a saved live Codex connection takes precedence over a stale Nile selection record.
- New effective-current behavior:
  - if Codex live state matches a saved connection, desktop shows that saved live connection as current
  - if the live state is a brand-new unsaved setup, desktop keeps the previous detected/new setup behavior
- Preserved `appliedAt` for the normal synced case where saved selection and live connection still point at the same saved record.
- Added a desktop regression test for the concrete drift scenario:
  - two saved OpenAI session connections
  - Nile selection still points at the old account
  - Codex live auth has been switched outside Nile to another saved account
  - desktop now surfaces the saved live account as current

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/DesktopSurface.test.ts -t "prefers the matched live saved connection over the stale selected connection"`
- `npm run test:desktop`
- `npm run typecheck`

### Step 34: Refresh README product previews and surface order

- Updated `README.md` to make the product surfaces more public-facing and easier to understand at a glance.
- Added the preview images from `assets/preview/` directly into the README with short user-facing explanations.
- Reordered the surface walkthrough to match the intended product emphasis:
  - desktop app first
  - menubar second
  - CLI third
- Kept the CLI command examples under the CLI preview so the terminal surface still has a practical entry point for users.

### Verification

- `git diff --check`

### Step 33: Fix repo-local core path aliases for runtime

- Fixed the root TypeScript path aliases for `@nile/core` so repo-local apps no longer resolve package imports through generated `.d.ts` files at runtime.
- Root cause:
  - `tsconfig.json` mapped `@nile/core` and its subpaths to `packages/core/dist/*.d.ts`
  - `tsx` uses those path aliases when running `apps/cli/src/main.ts`
  - Node then tried to load declaration files as runtime modules and failed on declaration-only imports like `./Types`
- Updated the aliases to point at `packages/core/src` instead, which keeps in-repo runtime execution on executable TypeScript source while still allowing `packages/core` to publish built `dist` output externally.
- Followed through on the next runtime failure exposed by that fix:
  - `packages/core/src/agents/openclaw/Json5.ts` was importing `json5` as a named ESM export
  - under the repo-local `tsx` execution path, `json5` resolves through its default export object instead
  - switched the parser call to `json5.parse(...)` so `npm run start` can execute the source tree cleanly
- Fixed the final CLI shutdown crash in repo-local `npm run start`:
  - `apps/cli/src/main.ts` was calling `process.exit(...)` immediately after writing help/output
  - the default asynchronous `pino` destination in `NileLogger` had not finished initializing yet
  - switching to `process.exitCode = ...` lets Node exit naturally after stream cleanup

### Verification

- `npm run typecheck`
- `npm run start -- --help`

### Step 32: Make prepared-session success state explicit

- Reworked the prepared OpenAI session banner on the add-connection page into a stronger success callout.
- Shifted the message from a passive "session ready" note to an explicit next-step instruction:
  - authentication succeeded
  - review the label and enabled capability
  - click Save connection to add it to Nile
- Added a small action badge keyed off the existing localized save action so the intended next click is visually obvious.
- Updated the prepared-session copy across all current desktop locales to keep the new action-oriented meaning consistent.

### Verification

- `npm run typecheck`
- `git diff --check`

### Step 31: Lock add-connection structure after session preparation

- Locked the structural add-connection controls once an OpenAI or Claude session has been prepared but not yet saved.
- In the prepared-session state, users can still:
  - save the connection
  - cancel/back out
  - confirm enabled-agent capability selection
- But they can no longer switch the underlying connection structure mid-draft:
  - provider preset combobox
  - connection method cards
  - auth.json file chooser
- This prevents invalidating a prepared desktop session draft by clicking into a different provider or auth mode before saving.

### Verification

- `npm run typecheck`
- `git diff --check`

### Step 30: Unified keychain format after desktop reset

- Dropped the temporary compatibility decode branch for malformed keychain payloads.
- Kept a single credential payload format:
  - `__nile_keychain_v1__:` + base64 JSON payload
- This matches the decision to reset local desktop state instead of carrying long-lived compatibility code for a short-lived broken write format.
- The keychain write path remains non-prompting in desktop dev flows, but reads are now back to a single canonical format only.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/services/credential/SecretCodec.test.ts packages/core/src/services/credential/SecurityCli.test.ts packages/core/src/services/credential/KeychainCredentialStore.test.ts`
- `npm run typecheck`

### Step 29: Quota regression recovery after keychain write change

- Fixed the desktop quota regression introduced by the temporary non-interactive keychain write change.
- Root cause:
  - the previous `security` write path stored new payloads in a format that `find-generic-password -w` no longer round-tripped back into valid JSON credentials
  - desktop usage reads then failed with `Stored credential payload is not valid JSON`
  - the renderer already collapses non-Cursor quota errors to `null`, so the visible symptom looked like quota disappearing completely
- Restored keychain writes to direct `-w <secret>` argument passing so new credentials stay readable without reintroducing the old terminal prompt flow.
- Added targeted `SecuritySecretCodec` coverage for the canonical prefixed payload format while the temporary compatibility branch was in place.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/services/credential/SecretCodec.test.ts packages/core/src/services/credential/SecurityCli.test.ts packages/core/src/services/credential/KeychainCredentialStore.test.ts packages/core/src/agents/codex/CodexSessionLogin.test.ts packages/core/src/agents/codex/current-state/CurrentCredentialReader.test.ts`
- `npm run typecheck`

### Step 28: Desktop keychain prompt suppression

- Reworked the shared `SecurityCli` secret-write path so Nile no longer asks macOS `security` to prompt for password data when writing keychain items.
- Replaced prompt-based `-w` placeholder writes with non-interactive hex payload writes via `-X`, which removes the confusing:
  - `password data for new item:`
  - `retype password for new item:`
  output from desktop dev terminals.
- Applied the change to all current Nile keychain write paths:
  - saved connection credentials
  - secure mutation-history snapshots
  - Cursor credential projection writes
- Tightened the Codex/Claude login helper spawn typings so the new desktop login tests and repo-wide typecheck stay strict-clean.
- Added targeted `SecurityCli` unit coverage to verify secret writes are rewritten to non-interactive hex payload arguments.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/services/credential/SecurityCli.test.ts packages/core/src/services/credential/KeychainCredentialStore.test.ts packages/core/src/agents/codex/CodexSessionLogin.test.ts packages/core/src/agents/codex/current-state/CurrentCredentialReader.test.ts`
- `npm run typecheck`

### Step 27: Desktop auth.json import path and error handling fix

- Fixed the desktop OpenAI `Import auth.json` flow to derive its default file path from the current configured Codex home instead of always hardcoding `~/.codex/auth.json`.
- Added a small renderer helper to map the desktop agent-home state into the concrete auth snapshot path:
  - custom Codex homes now resolve to `<codex-home>/auth.json`
  - machines still using the default home keep `~/.codex/auth.json`
- Wired that derived path into both connection creation and connection edit flows, so a machine with a nonstandard Codex home no longer silently points at the wrong file.
- Added user-visible error handling for add/edit OpenAI session flows:
  - auth import failures now render inline in the form
  - sign-in / save failures no longer look like a dead click with only a renderer console rejection
- Normalized the desktop file picker default path handling so Electron open dialogs expand leading `~` before opening.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/connections/AuthJsonPath.test.ts apps/desktop/src/electron/DesktopConnectionManager.test.ts`
- `./node_modules/.bin/vitest run packages/core/src/agents/codex/CodexSessionLogin.test.ts packages/core/src/agents/codex/current-state/CurrentCredentialReader.test.ts`
- `git diff --check`

### Step 26: Desktop Login PATH Fix And Public README Refresh

- Fixed desktop sign-in flows for Codex and Claude so spawned CLI login commands now inherit the login-shell `PATH` captured by the desktop app environment.
- Added a user-facing error for missing CLIs:
  - Codex: "Codex CLI was not found in PATH..."
  - Claude: "Claude CLI was not found in PATH..."
- Updated `apps/desktop/src/electron/DesktopConnectionManager.ts` to instantiate shared login helpers with the desktop environment instead of raw process environment.
- Added targeted unit coverage for `CodexSessionLogin`:
  - verifies login-shell `PATH` reaches the spawned command
  - verifies missing CLI errors are translated into actionable user-facing text
- Rewrote `README.md` toward a public product overview:
  - clearer user-facing positioning
  - current capabilities and limits
  - simpler user workflow framing
  - development details pushed lower

### Verification

- `npm run test:core`

### Step 25: Release Upload Bash Compatibility Fix

- Fixed the final desktop release workflow failure after successful build and notarization.
- Replaced the `mapfile`-based artifact collection in `.github/workflows/desktop-release.yml` with a portable `while read -d ''` loop.
- GitHub's macOS runner shell reached the upload step with Bash compatibility that did not provide `mapfile`, causing `desktop-v0.1.3` to fail only during GitHub Release asset upload.

### Verification

- Inspected failing `desktop-v0.1.3` GitHub Actions log in `error.log`.
- Confirmed both `arm64` and `x64` notarization succeeded before the upload-step shell failure.

### Step 24: Release CI Electron-Builder Repository Metadata Fix

- Fixed the remaining desktop release CI crash after successful signing and notarization.
- Added explicit repository metadata to `apps/desktop/package.json` so `electron-builder` can resolve GitHub publish context when `GH_TOKEN` is present during the release workflow.
- This avoids the `TypeError: Cannot read properties of null (reading 'channel')` failure from `app-builder-lib` update-info generation.

### Verification

- Inspected failing `desktop-v0.1.2` GitHub Actions log in `error.log`.
- Confirmed the crash occurred after both `arm64` and `x64` notarization completed.

### Step 23: Release CI CLI Cursor Source Expectation Fix

- Fixed the remaining desktop release CI failure in `apps/cli/src/NileCli.test.ts`.
- The test case seeds a Chromium Chrome `Profile 1` browser cookie store, so the correct auto-bind summary source is `Chrome (Profile 1)`, not the older generic `Cursor (Local session)` label.
- Updated the assertion to match the actual presenter output emitted by the Chromium session probe path.

### Verification

- `npm run test:cli`

### Step 22: Release CI Host-Local Dependency Fix

- Fixed GitHub release CI failure in `test:host-local` by declaring the missing `@nile/core` dependency in `packages/host-local/package.json`.
- This import already existed in `packages/host-local/src/cursor/SecurityCli.ts`, but the package manifest relied on a local leftover symlink instead of an explicit dependency declaration.
- The failure only appeared in clean CI because `packages/host-local/package-lock.json` previously contained no dependencies.

### Verification

- `npm install --prefix packages/host-local`
- `npm run test:host-local`

### Step 21: Repo-Local Release And Review Skills

- Added repo-local Codex skills under `.codex/skills/` for repeated Nile operational tasks:
  - `nile-desktop-release`
  - `nile-review`
- Captured the current desktop release operating rules in the release skill:
  - tag gating against dirty worktrees
  - accepted GitHub secret names
  - local signed build flow
  - expected notarized artifact outputs
- Captured Nile-specific review priorities in the review skill:
  - regression-first findings
  - release-readiness checks
  - workflow and docs consistency checks

### Verification

- Read both generated skill files in place.
- Confirmed release instructions match the current workflow and docs.

### Step 20: Release Workflow Secret Compatibility

- Updated `.github/workflows/desktop-release.yml` so the desktop release pipeline now accepts either:
  - canonical `NILE_DESKTOP_*` GitHub secrets
  - existing short-name secrets matching `apps/desktop/.env.release`
- Added a required `release_tag` input for `workflow_dispatch` so manually triggered desktop releases derive the same version format as tag-triggered runs.
- Updated release creation to generate GitHub Release notes automatically when creating a new release entry.
- Expanded `docs/desktop-release.md` with:
  - a secret-name mapping table
  - the recommended tag-driven publish flow
  - expected uploaded release artifacts
  - manual workflow dispatch usage
- Updated `README.md` to point readers at the full desktop release operating guide.
- Added desktop package `description` and `author` metadata to remove packaging warnings during release builds.

### Verification

- `npm run build:app --prefix apps/desktop`
- Confirmed local signed packaging used `Developer ID Application: QIANG JI (6N2P2T69SK)`.
- Confirmed notarization completed successfully for both `arm64` and `x64` desktop artifacts.

### Step 19: Desktop Package Size Reduction

- Removed the dev-only macOS Electron host bundle from packaged app contents:
  - moved `DesktopLauncher` host staging from `apps/desktop/dist/host` to `apps/desktop/.runtime/host`
  - updated the desktop build step to delete any stale `dist/host` output before bundling
- Tightened desktop packaging inputs in `apps/desktop/package.json`:
  - replaced broad `dist/**/*` inclusion with `dist/electron/**/*` and `dist/renderer/**/*`
  - excluded `*.map` files from packaged contents
  - kept only `en-US` and `zh-CN` Electron locales
- Split release builds into separate `arm64` and `x64` macOS artifacts instead of a default `universal` bundle, and documented the change in `docs/desktop-release.md`.
- Added a dedicated release cleanup step before desktop packaging so stale artifacts from older arch configurations do not remain under `apps/desktop/release/`.
- Moved desktop build-only packages out of runtime dependencies:
  - `@types/react`
  - `@types/react-dom`
  - `autoprefixer`
  - `postcss`
  - `tailwindcss`
- Added a release-only desktop build mode that disables sourcemaps and enables minification before packaging.
- Completed the runtime dependency cleanup by moving the remaining desktop libraries out of packaged runtime dependencies:
  - `@lobehub/icons-static-svg`
  - `@nile/core`
  - `@nile/host-local`
  - `@radix-ui/*`
  - `class-variance-authority`
  - `clsx`
  - `lucide-react`
  - `react`
  - `react-dom`
  - `tailwind-merge`
- Updated the desktop build step to clear `apps/desktop/dist/` before each build so stale outputs such as legacy `main.js` / `preload.js` no longer leak into release packages.
- Verified the main size drop after the packaging changes:
  - previous unpacked universal app: about `744M`
  - first-pass unpacked arm64 app: about `237M`
  - final unpacked arm64 app: about `214M`
  - previous packaged app.asar: about `303M`
  - first-pass packaged app.asar: about `23M`
  - final packaged app.asar: about `2.3M`
  - new unsigned artifacts:
    - `Nile-0.0.0-arm64.dmg`: about `96M`
    - `Nile-0.0.0-arm64-mac.zip`: about `99M`
    - `Nile-0.0.0.dmg` (`x64`): about `96M`
    - `Nile-0.0.0-mac.zip` (`x64`): about `97M`

### Verification

- `npm install --package-lock-only` (in `apps/desktop`)
- `npm run build:app:dir` (in `apps/desktop`)
- `npm run build:app:unsigned` (in `apps/desktop`)
- `npm run typecheck`
- Confirmed `release/mac-arm64/Nile.app/Contents/Resources/app.asar` no longer contains `dist/host` or any `*.map` entries.

### Step 18: Release Verification Hardening

- Tightened `.github/workflows/desktop-release.yml` so tagged desktop releases now run `npm test` instead of only `npm run test:desktop` before packaging and upload.
- Added `docs/desktop-release.md` to document:
  - release workflow inputs
  - required GitHub secrets
  - local signed and unsigned desktop build flows
  - how GitHub Releases are created and populated
- Updated `README.md` so public project status now matches the implemented desktop packaging pipeline instead of claiming release packaging is still missing.
- Corrected CLI reset reporting so it no longer claims credentials are always kept in keychain after reset.
- Refined shared reset semantics so `credentialsRemoved` only reports `true` when Nile-managed credential or secure-snapshot references were actually present in the workspace database.

### Verification

- `npm run typecheck`
- `npm test`

### Step 19: Keep Desktop Reset Working When Keychain Delete Fails

- Updated shared local-state reset so desktop reset no longer aborts when a Nile-managed keychain credential cannot be deleted due to an unexpected keychain command failure.
- Reset still clears the local SQLite database and history directory, which keeps the user-visible "Reset local state" action functional even when macOS keychain cleanup is incomplete.
- Added a focused regression test covering command-failure credential removal during reset.

### Verification

- `npx vitest run packages/core/src/application/local/StateReset.test.ts`
- `npm run typecheck` (currently blocked locally by Swift toolchain / macOS SDK mismatch while building the keychain helper)

### Step 20: Fix macOS keychain existence checks for saved usage connections

- Root-caused a machine-specific "no usage, no error" desktop symptom for the saved `primary@example.com` OpenAI session connection.
- Verified the saved access row was present in `~/.nile-switcher/switcher.sqlite`, but its backing credential had been marked `write_failed` with:
  - `Failed to has credential access:primary-example-com: security exited with code 1`
- Traced that failure to the native Swift keychain helper: `read-generic-password` existence checks were calling `SecItemCopyMatching` without any return flag when `includeSecret` was false.
- Added `kSecReturnAttributes = true` for non-secret existence checks so `KeychainCredentialStore.has(...)` can perform a valid metadata lookup instead of failing with a generic keychain command error.
- Identified a separate desktop UX gap: usage read failures are currently swallowed by `DesktopUsageCache` and degrade to `null` usage state in the renderer.

### Verification

- Directly reproduced the broken local behavior with:
  - `node --import tsx ... session.getConnectionUsage("primary-example-com")`
  - result before fix: `AccessRegistryConsistencyError: Credential for access primary-example-com is not synchronized (write_failed)`
- Full helper rebuild remains blocked locally by the Swift toolchain / macOS SDK mismatch in this shell environment.

### Step 16: Desktop Release Pipeline

- Added a GitHub Actions workflow at `.github/workflows/desktop-release.yml` that:
  - triggers on `v*` and `desktop-v*` tags
  - validates signing and notarization secrets before build
  - stamps the desktop app version from the git tag
  - runs `npm run typecheck` and `npm run test:desktop`
  - builds signed macOS desktop release artifacts
  - uploads the generated `dmg` and `zip` files to the matching GitHub Release
- Reworked desktop packaging so release builds now target universal macOS output (`dmg` + `zip`) instead of a permanently unsigned local-only package.
- Added explicit macOS entitlements for hardened runtime Electron packaging under:
  - `apps/desktop/build/entitlements.mac.plist`
  - `apps/desktop/build/entitlements.mac.inherit.plist`
- Added `build:app:unsigned` so local packaging can still intentionally skip signing when a Developer ID identity is not available.
- Moved `sharp` to desktop `devDependencies` because it is only used by the icon-generation build script and should not be treated as a packaged runtime dependency.
- Added `apps/desktop/.env.release.example` plus matching `.gitignore` entries so signed local packaging can load the same signing/notarization variables without committing secrets or generated release artifacts.

### Step 17: Desktop App Icon Color Regression Fix

- Fixed desktop app icon generation so embedded Nile mark coloring handles both source SVG stroke forms:
  - `stroke="#000"`
  - `stroke="currentColor"`
- Updated macOS packaging icon input to `build/icons/icon.png` so local packaging does not depend on stale `icon.icns` fallback when `iconutil` fails.
- Regenerated `apps/desktop/build/icons/icon.png` and confirmed the icon keeps the intended white wave mark over the blue background.

### Verification

- `npm run icons --prefix apps/desktop`
- `npm run build:app:dir --prefix apps/desktop`
- Confirmed packaged icon at `apps/desktop/release/mac-arm64/Nile.app/Contents/Resources/icon.icns` renders as white wave mark.

### Step 15: Desktop macOS Packaging Scripts

- Updated `apps/desktop/package.json` to support desktop app packaging with `electron-builder`.
- Added desktop app packaging scripts:
  - `build:app`
  - `build:app:dir`
- Added desktop packaging config under `build`:
  - app id: `dev.nile.desktop`
  - product name: `Nile`
  - output directory: `release`
  - packaged files include desktop `dist`, icon assets under `build/icons`, and `package.json`
  - macOS category/icon settings plus unsigned local build behavior (`identity: null`)
- Set desktop package `main` to `dist/electron/main.cjs` and mirrored that in `build.extraMetadata.main`.
- Added `electron-builder` as a desktop dev dependency and moved `electron` from `dependencies` to `devDependencies` to satisfy electron-builder packaging requirements.

### Verification

- `npm run build:app:dir --prefix apps/desktop`
- Confirmed unpacked app output at `apps/desktop/release/mac-arm64/Nile.app`

## 2026-05-03

### Step 13: Provider Catalog Page

- Added a new desktop sidebar navigation item for `Providers`, positioned alongside the existing settings-shell pages.
- Introduced a locally maintained renderer catalog file at `apps/desktop/src/renderer/providers.json` so provider metadata now lives in one editable JSON source instead of being hardcoded in page code.
- Added a typed `ProviderCatalog` loader with explicit validation for:
  - provider
  - provider key
  - official link
  - description
- Added a new `ProvidersPage` that renders the catalog in a simple table and opens official links through an explicit desktop bridge instead of navigating the Electron settings window away from Nile.
- Added a focused renderer test covering local provider catalog loading and URL validation.
- Moved provider-localized fields into the same JSON file under per-language `translations`, so provider name and description can be maintained in one provider-owned translation source instead of being split across multiple files.
- Reframed the `Providers` page description away from internal catalog wording and toward the real user task: comparing providers, understanding fit, and opening official docs before choosing one.
- Reused the same provider catalog inside `Add connection` and connection edit flows, so matching presets can now show an inline `About` card with official link and provider summary beside the form.

### Step 14: Core Review Hardening

- Hardened OpenClaw apply behavior so API keys are no longer written in plaintext to `openclaw.json`:
  - OpenClaw now requires env-backed API-key credentials.
  - OpenClaw config now writes `${ENV_KEY}` references instead of raw secrets.
- Removed OpenClaw snapshot TOCTOU risk by reading with `try/catch` directly instead of `existsSync` pre-check.
- Reduced database hot-path overhead by caching prepared SQLite statements in `SqliteDatabase`.
- Removed mutation-history list N+1 query behavior by batch-loading file rows for listed mutations.
- Expanded Cursor keychain missing-entry detection to include `item not found` and `errSecItemNotFound` patterns.
- Removed hardcoded agent-id string checks in saved-connection compatibility logic by switching to agent constants.
- Moved connection default-enabled agent policy ownership fully into shared connection policy logic.
- Reduced credential-store duplication by re-exporting host-local Cursor `SecurityCli` from shared core service.
- Refined core naming to follow local-directory naming rules by renaming broad-prefix files in:
  - `models/connection`
  - `models/agent`
  - `models/selection`
  - `services/credential`
- Removed single-file service directories by lifting:
  - `services/environment/EnvironmentSource.ts` -> `services/EnvironmentSource.ts`
  - `services/logging/NileLogger.ts` -> `services/NileLogger.ts`
  - and aligned `@nile/core` exports + tsconfig path aliases to the new locations.
- Added persisted API-key metadata (`api_key_source`, `env_key`) in access rows to avoid keychain reads on saved-connection list paths for new/updated rows, with fallback for legacy rows.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Desktop command-chain cleanup

- Deleted `DesktopIpcController` and registered IPC route groups directly from `DesktopMain`, so route dependencies stay scoped to their own capability group instead of flowing through one wide controller options bag.
- Kept desktop query and mutation concerns more separate:
  - `DesktopSurface` remains the query-facing state reader
  - `DesktopConnectionGateway` now owns more command-side session mutations such as switch/import-detected/rollback/bind/remove/import-current
- Added shared mutation helpers in `DesktopStateStore`:
  - `runMutation`
  - `runAsyncMutation`
- This removed repeated dirty-marking boilerplate from:
  - switch
  - rollback
  - add
  - update
  - save prepared connection
  - import detected setups
  - import current connection
  - remove
  - bind
  - reset
- Moved renderer `cn` helper into `renderer/ui/cn.ts` and removed the single-file `renderer/lib/` directory.
- Broke `SettingsState` into reusable section DTO types while keeping the existing renderer payload shape stable.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

## 2026-04-29

### Step 3: Settings Shell

- Reworked `apps/desktop/src/renderer/settings.html` into a shell with left navigation and page scaffolds for `Connections`, `Current Agent`, `History`, and `Advanced`.
- Refactored `apps/desktop/src/renderer/settings.ts` into a renderer controller that drives page selection, preserves add/import/remove/switch flows under `Connections`, and reuses current settings state in `Current Agent`.
- Restyled `apps/desktop/src/renderer/styles.css` for the desktop settings shell while keeping existing menubar classes intact.

### Step 4: Menubar-First Desktop

- Simplified the tray menu to a native two-level structure:
  - `Open Main Window`
  - one submenu per supported agent
  - `Quit`
- Each agent submenu now lists only compatible saved connections, keeps the current one at the top, and shows it checked.
- Updated the desktop bridge and surface so switching is explicit by `agentId + connectionId`, matching the multi-agent tray structure.
- Kept the main window focused on the new shell while leaving `History` and `Advanced` as staged pages instead of overloading the tray menu.

### Step 5: History Page Wiring

- Added desktop history IPC and surface methods so the renderer can read recent Nile mutation history without opening its own core session graph.
- Reworked the `History` page from scaffold-only to a usable first pass:
  - latest rollback availability
  - recent mutation list
  - `Rollback latest Codex change`
- Kept rollback scope aligned with current core behavior by targeting Codex only.

### Step 6: Usage In Tray And Settings

- Extended `DesktopSurface` to read connection-scoped usage through shared core and project a small desktop-facing summary instead of leaking provider-specific quota payloads into Electron.
- Updated the native tray menu so each agent submenu can show one disabled usage line for the current connection, using the tightest remaining window (`5h` vs `weekly` for Codex/OpenAI session).
- Added the same usage summary to desktop settings connection rows so the main window and tray stay consistent without introducing a separate desktop-only usage model.

### Step 7: Desktop Icon Chain

- Added `apps/desktop/generate-icons.ts` so desktop-specific icon outputs can be regenerated from the shared `assets/icons/nile-mark.svg` source.
- Generated and checked in:
  - `apps/desktop/build/icons/nileTemplate.png`
  - `apps/desktop/build/icons/nileTemplate@2x.png`
  - `apps/desktop/build/icons/icon.icns`
- Updated Electron runtime wiring so the tray uses the template PNG outputs while the app/window icon path resolves to `icon.icns`.
- Updated the desktop `build` script to regenerate icon assets before bundling renderer and main-process code.

### Step 8: First-Run Import Flow

- Added a desktop first-run onboarding state that only appears when there are no saved connections yet.
- Wired the main window to scan local setups automatically and branch into:
  - single import recommendation
  - multi-select import
  - empty-state guidance
- Kept the new flow on top of the shared core `scan-local` actions instead of adding desktop-only detection logic.
- Added desktop IPC and surface support for importing selected detected setups, then returning the user to the normal settings view once saved connections exist.

### Step 9: Finish Settings Gaps And Build Path

- Promoted `Current Agent` from a Codex-only view to a real multi-agent page with agent tabs, per-agent quick actions, and per-agent compatible connection lists.
- Added a reusable `Detected local setups` section under `Connections` so scan/import stays available after first-run instead of disappearing once onboarding is done.
- Replaced the old `Advanced` placeholders with concrete local diagnostics:
  - database path
  - agent homes
  - supported agents
  - saved connection count
  - importable setup count
- Kept renderer control files under the repository limits by splitting detected-setup, current-agent, and saved-connection rendering into focused view classes.
- Fixed `apps/desktop/build.ts` so desktop build verification resolves `apps/desktop/src/...` instead of the broken `apps/src/...` path.

### Step 10: Multi-Agent Rollback

- Extended shared rollback support beyond Codex so Claude and Cursor can both restore their last Nile-managed local state:
  - Claude rollback now restores `settings.json` and `.credentials.json`
  - Cursor rollback now restores both config files and tracked keychain credential state
- Added focused rollback tests for the new Claude and Cursor paths alongside the existing Codex coverage.
- Exposed rollback capability back into desktop state so `Current Agent` can enable rollback per agent instead of hard-coding Codex.
- Reworked the desktop `History` page into an agent-scoped view with tabs, per-agent rollback availability, and agent-filtered mutation history instead of a single Codex-only rollback button.

### Step 11: Desktop UX Redesign Skeleton

- Reordered the main window navigation around user tasks instead of internal capability groups:
  - `Home`
  - `Agents`
  - `Connections`
  - `History`
  - `Settings`
- Added a real `Home` page so the main window no longer drops straight into a management-heavy connections screen.
- Introduced renderer-level agent icons and tone treatment for:
  - Home agent cards
  - Agents tab strip
  - History tab strip
- Reworked the sidebar framing so `Settings` is a lower-priority entry instead of a peer to the main operational tabs.
- Shifted the window copy from “Main Window” toward a more product-facing “Control Surface” framing.
- Kept the existing connection management and agent diagnosis functionality intact while moving the default user path toward:
  - overview first
  - diagnose second
  - inventory management third

### Verification

- `npm run typecheck`
- `npm run test:desktop`
- `npm run desktop:build`

### Step 12: Real Agent Icons And Stable App Icon Rasterization

- Replaced the placeholder renderer agent icons with real brand SVGs sourced from `@lobehub/icons-static-svg`:
  - Codex
  - Cursor
  - Claude Code
- Switched desktop icon generation away from the broken local ImageMagick/QuickLook rasterization path that was producing blank PNG outputs from `assets/icons/nile-mark.svg`.
- Rebuilt the desktop icon pipeline around `sharp` so `icon.png`, `nileTemplate.png`, and `nileTemplate@2x.png` are generated from the shared SVG with a predictable transparent background.
- Aligned the menubar icon with the new app icon treatment by switching the tray image from the old monochrome template asset to the rounded `icon.png` brand mark and resizing it for menu bar display.
- Reverted the tray back to the standard macOS template-image path after validating that branded app icons are not the right menubar treatment on macOS.
- Added a dedicated tray rasterization path so the template icon keeps the larger wave proportion without inheriting the black rounded app background.
- Set the runtime desktop app name explicitly to `Nile` so dev-mode launches no longer appear as `Electron` in the macOS app menu.
- Corrected the remaining macOS app-name leak by changing desktop launch flows to start from a generated `Nile.app` host bundle instead of the stock `Electron.app` binary.
- Kept the existing `app.setName("Nile")` and menu labels, but moved the real fix into a reusable desktop launcher so both `desktop:dev` and `desktop:start` use the same host-bundle override.
- Rebuilt the desktop settings renderer around `React` plus shadcn-style open-code components instead of the previous hand-built DOM controller and page-specific string templates.
- Collapsed the desktop settings surface into two responsive pages: `Agents` for current runtime state plus explicit switching, and `Connections` for saved connection inventory, compatibility, usage, import, and creation flows.
- Added `supportedAgents`, `selectedByAgents`, and per-agent current usage into desktop view state so the new renderer can describe connection compatibility and active selections without recomputing provider rules in the renderer.
- Switched desktop CSS generation to a Tailwind-backed build step so the new renderer can use responsive utility classes while keeping the warm light Nile visual theme.
- Reworked the settings shell into a proper desktop frame:
  - one full-width title bar above the app body
  - a collapsible icon rail instead of fully hiding the sidebar
  - a stable macOS traffic-light safe area that no longer collides with scrolled or collapsed sidebar content
- Removed the extra shell-level content card so the `Agents` and `Connections` pages render directly on the inset surface instead of being wrapped by a second large container.
- Fixed the shell height chain so the app root is a real `flex-col` frame; the sidebar, inset surface, and divider now stretch to the full window height instead of stopping at content height.
- Kept navigation reachable at narrow widths by rendering the sidebar at all breakpoints and collapsing it into an icon rail instead of hiding it under `md`.
- Expanded the `Connections` page import actions so users can import the current local setup for any supported agent instead of only Codex.
- Added a viewport-aware sidebar guard so crossing the `960px` threshold auto-collapses into the icon rail when narrow and auto-expands again when wide.
- Added a desktop `Settings` page to the left navigation with persisted interface preferences for:
  - language: English / Chinese
  - theme: system / light / dark
- Switched desktop theming onto the shadcn-recommended token model by keeping semantic CSS variables in `:root`, overriding them under `.dark`, and resolving `system` through `prefers-color-scheme`.
- Moved the sidebar shell onto the dedicated `sidebar-*` token set so light and dark mode apply consistently across the app frame instead of only the main content surface.
- Replaced the remaining hand-styled desktop settings dropdowns with the official shadcn `Select` component pattern and added a local `apps/desktop/AGENTS.md` rule to prefer shadcn component implementations over bespoke styled controls.
- Continued the renderer cleanup by replacing custom separators and native checkboxes with shadcn open-code `Separator` and `Checkbox` components, and tightened the local desktop UI rules to allow Tailwind only for composition/layout glue rather than bespoke control styling.
- Refactored the desktop sidebar from a plain styled wrapper into a controlled sidebar primitive with:
  - `SidebarProvider` state
  - `useSidebar`
  - `SidebarTrigger`
  - `SidebarGroup` / `SidebarGroupContent`
  - icon-collapse behavior driven by sidebar state instead of page-level conditional markup
- Continued the page-level cleanup by replacing remaining hand-built alert and metric blocks with shadcn-style `Alert` and `Card` composition in `AgentPage`, and removed the last obvious hard-coded `Current` badge copy from the connections table.
- Further tightened `AgentPage` by reducing the top-level agent selector from a nested metric-card grid into a denser section list row pattern, which removes another layer of bespoke visual blocks while preserving the same state summary.
- Extended the desktop translation cleanup into shell and menubar surfaces by routing the sidebar toggle label, menubar headings, action buttons, and empty-state copy through the shared renderer i18n catalog instead of hardcoded English strings.
- Closed the remaining desktop front-end review gaps by:
  - making the menubar react to preference changes instead of only reading language/theme at bootstrap
  - routing menubar auth mode display through the shared `authModeLabel` helper
  - removing the last hardcoded sidebar trigger accessibility label from the sidebar primitive
- Added proactive usage refresh on connection switches by refreshing both the previously selected connection and the newly selected connection inside `DesktopSurface.switchConnection()`, so the menubar cache and the next settings refresh pick up updated usage immediately after an explicit switch.
- Introduced a minimal `DesktopStateStore` in the Electron main process so desktop state reads and mutations now flow through one cache-and-invalidation layer above `DesktopSurface` and `DesktopConnectionManager`, without changing visible renderer behavior yet.
- Moved the tray open path onto cached menubar state from `DesktopStateStore`, so `popUpContextMenu()` no longer waits for a fresh `DesktopSurface.getMenubarState()` call before the menu appears; background refresh now happens after popup instead of on the critical click path.
- Stopped the settings renderer from doing its own post-mutation full refresh after switch/import/add/remove/rollback actions; those flows now wait for the desktop action and then rely on the existing main-process `desktop:state-changed` push to reload state, reducing duplicated request/response loops in the renderer.
- Reworked the `Agents` page from the old selector-plus-detail split into one fixed-order agent list, where each row now shows the current connection, current usage, compatible connection count, inline switching actions, and recent per-agent switch history sourced directly from desktop settings state.
- Tightened that `Agents` redesign into a simpler information architecture: the default agent page is now a minimal list, and each agent opens dedicated `History`, `Switch`, and `Usage` subpages instead of trying to show all detail inline on the root list.
- Split the heavier React renderer files back under the repo limits by extracting:
  - agent list toolbar and agent card rendering
  - saved connections table rendering
  - add-connection form state
  - desktop state refresh and responsive sidebar state
  - sidebar navigation rendering
- Reworked the root `Agents` cards again around a denser summary layout:
  - top row now shows icon, agent name, connection count, and a `More Details` link
  - main row now shows an inline current-connection dropdown for direct switching
  - usage now renders plan label plus per-window progress bars instead of a single text summary
- Expanded desktop usage summaries to keep all available quota windows and the plan label, so the renderer can show `5h` and `weekly` usage at the same time on agent cards.
- Refreshed the generated desktop app icon treatment to use a Mail-style blue gradient background with a subtle top highlight while keeping the shared Nile wave mark and the existing monochrome tray-template outputs.
- Simplified the desktop Settings reset action copy by shortening the destructive button label to `Reset` / `重置` and removing the extra post-reset explanatory note under the button.
- Cleaned up the shared Cursor usage probe boundary by:
  - routing `packages/host-local` through explicit `@nile/core` export paths instead of direct `core/src` imports
  - adding a narrow `@nile/core/usage/cursor` public entry for the shared identity helper
  - moving the Chromium/state-db/source-probe tests out of `apps/desktop/src/electron` and into `packages/host-local/src/cursor`
  - adding `test:host-local` and including `packages/host-local` in the default vitest include list
- Tightened desktop Cursor usage state handling so `null` now only means `not loaded yet`, while Cursor-specific `unavailable/error/unsupported` results are preserved as explicit desktop usage states instead of being collapsed away before the renderer can act on them.
- Renamed the desktop-facing `Usage` copy to quota-oriented wording so the UI consistently describes remaining allowance instead of sounding like historical consumption:
  - short labels now use `Quota left`
  - agent detail pages use `quota` / `remaining quota`
  - Cursor repair flows now talk about quota sync rather than `usage`
  - tray labels now show `Quota · ...`
- Replaced the agent-list toolbar pencil icon with a sorting icon so the order-edit button reads as reorder/sort instead of generic edit.
- Fixed desktop refresh semantics and external state visibility:
  - added a real renderer-side `refreshSettings` IPC that invalidates desktop caches before the settings UI re-reads state
  - changed settings refresh flows to fetch fresh settings/history/connection-definition state instead of reusing warm cache entries
  - added a desktop main-process watcher on the shared `~/.nile-switcher/switcher.sqlite` workspace files so CLI-written connection changes invalidate desktop cache and surface without a restart
- Added visible refresh-button feedback across the desktop settings surface by introducing a shared renderer `RefreshButton` that disables during work and spins the icon until the async refresh completes.
- Removed the nested card treatment from the Agents-list `Quota left` block so it reads as part of the agent card instead of a second card inside it.
- Reframed quick-setup copy around saving local setups into Nile instead of vague confirmation so first-run and drift-import scenarios use the same clearer language:
  - `Looks good` -> `Save to Nile`
  - `Confirmed` -> `Saved in Nile`
  - the page description now explains that saving makes setups switchable and trackable
- Simplified the quick-setup saved state badge to a green check-only pill, while keeping the `Saved in Nile` label in accessibility/title metadata instead of visible copy.
- Refined quick-setup guidance so the page header now explains that Nile is reviewing detected local setups, while only `new` setup cards show a small inline hint explaining why saving into Nile matters.
- Upgraded the quick-setup `new setup` explanation from muted helper text to a proper inline `Alert`, and added a `New setup` badge so unsaved local setups stand out without relying on button text alone.
- Reframed quick-setup cards into two layers so the agent is the outer context and the detected setup becomes its own bordered region:
  - `New setup` now belongs to the setup region instead of the agent heading
  - the save rationale and `Save to Nile` action now sit together on the right as one action cluster
- Moved the quick-setup save rationale out of the setup panel itself so the inner bordered region stays focused on setup data, while the right-side action cluster carries the explanation and save CTA.
- Dropped the inner setup-card treatment from quick setup so the left-side setup content reads as plain content again, and strengthened the unsaved-state marker into a colored `New Setup Found` badge.
- Removed the separate unsaved-state explainer panel from quick setup and folded that affordance into the `Save to Nile` CTA itself:
  - the save button now carries a save icon by default
  - clicking it switches the icon into an animated saving spinner until the async action completes
- Unified the desktop agent/setup expression across Quick setup and Agents:
  - `QuickSetupAgentCard` now builds on shared `AgentCardHeader` and `DetectedSetupSection`
  - the Agents list receives detected local setups and can show the same `Save to Nile` affordance inside each agent card
  - when an agent has no saved current connection but Nile has detected a local setup, the card now suppresses the empty quota block and surfaces the detected setup section instead
- Added a dynamic quick-setup guide banner above the agent cards so the page now explains the current onboarding state in friendlier product language:
  - unsaved local setups now explain why saving matters for quota tracking, switching back later, and avoiding auth-drift loss
  - invalid local setups now prompt the user to finish signing in or repair local state first
  - fully saved and fully empty states now get their own lighter summary guidance instead of reusing the same static page copy
- Aligned the quick-setup `unsaved` guide banner with the `New Setup Found` badge by moving both onto the same amber warning palette instead of mixing blue and amber on the same state.
- Simplified drift handling in the root Agents cards so a newly detected local setup now takes over the primary card content:
  - the saved-connection dropdown and quota block are hidden while the unsaved local setup is being surfaced
  - any existing saved selection is reduced to a lightweight `Saved in Nile: ...` note instead of competing as a second “current” block
- Added an explicit zero-connection onboarding mode to the desktop shell:
  - when there are no saved connections yet, the sidebar now hides `Agents` and `Connections`
  - `Quick setup` stays reachable until the first connection is saved, so the user never lands in a shell with only `Settings`
  - once saved connections exist again, the normal `Quick setup` dismissal and full navigation surface return
- Changed `Quick setup` dismissal into a hide-from-sidebar behavior instead of fully removing access:
  - after `Done`, the page now returns to `Agents` when saved connections exist
- Added custom `auth.json` path support to the desktop `Import auth.json` flow:
  - the Add connection form now shows an editable `auth.json path` field only for the `Import auth.json` method
  - the default remains `~/.codex/auth.json`, but users can point Nile at any other Codex auth snapshot on disk
  - Codex auth-path reads now expand a leading `~/` before loading the file, so the default path and user-edited home-relative paths both work
  - the desktop bridge and connection manager now pass the custom path through to the shared local credential resolver
  - added focused tests for custom-path reads in shared Codex credential loading and desktop add-connection flows
- Simplified the `Connections` inventory view by removing the text `Selected by` column and replacing it with a narrow agent-logo column before `Name`:
  - desktop tables now show selected agents as brand icons in a compact leading column
  - mobile cards now show the same selected-agent icons inline with the connection name
  - removed the unused `Selected by` UI copy from desktop i18n
- Reworked the desktop `Import auth.json` path input into a real file-picker flow:
  - the OpenAI current-session import path now renders as a read-only path field plus `Choose file`
  - clicking it opens the native macOS file chooser, filtered to JSON files
  - the chosen file path is returned through a new preload/main-process IPC instead of asking users to type paths by hand
- Reframed the `Connections` inventory around detail subpages instead of row-level destructive actions:
  - the table now replaces the old `Actions` controls with a single `More Details` entry point
  - each connection opens a dedicated subpage with an in-page breadcrumb header
  - repair-quota and remove-connection actions now live inside the detail page instead of the list
  - the detail view is section-based and avoids the previous full-page card wrapper
- Unified add-connection completion routing around the page the user came from:
  - quick setup entries return to `Quick setup`
  - agent-page entries return to `Agents`
  - connections-page entries now open the created or reused connection directly in its detail subpage
  - this routing no longer depends on whether the result was newly created or reused
- Hardened duplicate detection for OpenAI session connections:
  - confirmed the live `~/.codex/auth.json` carries a stable OpenAI `account_id` and should normally reuse the existing saved OpenAI session connection
  - extended OpenAI session identity resolution to fall back to the JWT `sub` claim before weaker display/email labels
  - upgraded connection reuse matching so OpenAI sessions can still reuse existing saved connections when identity keys are missing or stale by comparing session credential material (`accountId`, then `refreshToken`, then `idToken`)
  - added focused coverage for reusing an existing OpenAI session access via matching refresh token

### Verification

- `npx vitest run packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/agents/codex/current-state/CurrentCredentialReader.test.ts apps/desktop/src/electron/DesktopConnectionManager.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
  - the sidebar still hides `Quick setup` once dismissed
  - the Agents toolbar now shows a `Quick setup` entry beside the sort/refresh controls so users can reopen it on demand
- Reinstated a temporary sidebar `Quick setup` entry while that page is open, so reopening it from the Agents toolbar no longer leaves the user on a page with no matching nav item.
- Tightened the reopen behavior so using the Agents-toolbar `Quick setup` entry now clears the dismissed flag; once reopened, the sidebar item stays visible again until the user explicitly clicks `Done`.
- Fixed the desktop renderer build after the agent model barrel started exporting Node-only home-resolution helpers:
  - added explicit `@nile/core/models/agent/types` and `.../homes` package export paths
  - moved desktop renderer imports onto the browser-safe `agent/types` path so esbuild no longer tries to bundle `node:os` / `node:path` into the settings surface
- Normalized add-connection auth-method ordering so session-based sign-in options now render ahead of API-key methods, including making Claude default to `Sign in with Claude` before `Use API key` just like the OpenAI flow.
- Stopped agent-scoped add-connection entrypoints from narrowing saved connections down to a single agent:
  - connections opened from an agent flow now still preserve all detected/supported enabled agents
  - the add-connection form now shows true multi-agent capability instead of replacing it with just the entry agent
  - the entry agent context remains only as a post-save switch target and lightweight page hint, not as a capability limiter
- Made gateway capability feedback visible in both add-connection layouts, so even single-capability forms now show the same explicit `Detected support: ...` probe result instead of silently collapsing to a bare final capability value.
- Simplified the Connections surface by hiding empty `Selected by` values instead of rendering `Nobody`, both in the mobile card layout and the desktop table.
- Removed the manual `Label` field from the add-connection flow so new connections now always start with Nile’s automatic naming; users can rename later instead of making that a required creation-time decision.
- Reworked connection detail quota presentation so saved connections now show full window-by-window quota meters instead of a single summary string:
  - desktop usage summaries now keep each window’s `resetsAt` timestamp through the renderer boundary
  - connection detail pages now render one progress bar per usage window and show the next renewal time under each window when available
  - agent cards were switched to the same shared quota meter component so quota visuals stay consistent across the settings surface
- Added a shadcn-style renderer `Progress` primitive so quota meters no longer hand-roll bar markup inline.
- Fixed gateway capability detection in the add-connection form:
  - the gateway/API-key flow was repeatedly writing the same enabled-agent array back into form state after each onboarding probe
  - because the probe effect depended on that array, the identical write retriggered the probe and kept the UI stuck in `Detecting supported agents…`
  - enabled-agent updates are now a no-op when the selection did not actually change, so probe results can settle and render normally
- Simplified connection detail page status semantics:
  - removed the lower `Used by` section so active-usage status is no longer duplicated in two places
  - removed the endpoint badge from the title row because endpoint already appears in the detail fields
  - replaced the generic `Current` badge with per-agent `... in use` badges so the header now tells users exactly which agent is actively using the connection
- Reduced jargon in the connection detail identity fields:
  - official OpenAI session connections no longer repeat `Endpoint: OpenAI`, since that field adds no new information in the default OpenAI-session case
  - added an inline help tooltip for `OpenAI session` explaining that Nile is using the signed-in OpenAI account session rather than an API key
- Replaced the non-working native title hint in connection detail with the official shadcn/Radix tooltip stack:
  - installed `@radix-ui/react-tooltip`
  - added a shared renderer `ui/tooltip.tsx`
  - moved the connection-detail auth help onto the new tooltip so it renders reliably inside Electron instead of relying on the system `title` hint
- Moved the Connections-table agent icon hover hint off the old native `title` attribute and onto the shared Radix tooltip as well, so `Currently used by ...` now actually renders in the inventory list.
- Tightened the small-window Connections inventory layout:
  - removed the extra outer page card so mobile/narrow widths no longer show a large wrapper card around individual connection cards
  - moved each mobile card’s `More` link into the top-right corner beside the connection title instead of leaving it detached at the bottom
  - kept the bordered table container only on large screens, where it still helps the tabular layout read as a single surface
- Filled the titlebar’s empty trailing slot with a Nile logo home button:
  - repurposed the right-aligned logo-only header button into a `Nile` entry dialog instead of a simple home shortcut
  - the dialog now exposes `About Nile`, `Support`, and `GitHub issues` entry points
  - `Support` opens `mailto:info@vestin.io` and `GitHub issues` opens `https://github.com/vestin-io/Nile/issues` through explicit task-oriented Electron IPC calls rather than a generic external-link bridge
- Tightened connection detail actions:
  - the `Refresh` button now uses the same default size as `Remove`
  - delete is now hidden whenever a connection is actively selected by any agent
  - the renderer also guards the remove handler so in-use connections cannot be deleted through stale UI state
- Added a real connection edit flow instead of a placeholder button:
  - surfaced `update` support from core saved-connections storage through `NileSession`, the desktop connection manager, state store, preload bridge, and renderer
  - expanded saved-connection summaries to carry `endpointId`, `enabledAgents`, and `configurableAgents`, which lets the desktop edit page render the true per-connection capability set without guessing from UI context
  - the edit page now supports changing the connection label and enabled agents only; endpoint/auth remain read-only
  - if an agent is currently using the connection, that agent is kept enabled both in the UI and in the persistence layer so editing cannot orphan a live selection
  - grouped `Edit`, `Refresh`, and `Remove` into one shared header action group in connection detail; wide layouts show text-only buttons, narrow layouts collapse them to icons only
- Reworked connection editing from a shallow label patch into a real auth-aware update flow:
  - added a core `ConnectionUpdater` that can update credentials, endpoint URLs, and enabled-agent capability in one path while preserving live agent selections and cleaning up or reusing endpoints correctly
  - extended `AccessRegistry.update(...)` so a saved connection can move to a different endpoint, which is required for gateway and Azure edits
  - threaded richer update inputs through runtime-local, Electron main/preload/state-store, and renderer so edit can now submit auth-specific updates instead of just renaming a connection
  - saved-connection summaries and desktop connection state now carry `endpointUrl`, which lets edit preload the existing gateway/Azure endpoint instead of guessing from labels
- Started sharing add/edit renderer structure instead of keeping two unrelated forms:
  - extracted shared connection form parts for method selection and capability/agent editing
  - `Add connection` now uses the shared method picker and capability block instead of owning its own duplicate card logic
  - `Edit connection` now reuses the same method-selection language and auth-specific sections:
    - OpenAI session: `Sign in with OpenAI` or `Import auth.json`
    - API key connections: update API key directly
    - Gateway / Azure OpenAI: update endpoint URL and API key
    - Gateway: re-detect supported agents from the current endpoint + API key preview path, and only expose `Enable for agents` there
  - Cursor connections remain name-only edits for now because there is no add-flow preset or stable credential refresh path to share yet

### Verification

- `npx vitest run apps/desktop/src/UsageSummary.test.ts apps/desktop/src/DesktopSurface.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npx vitest run packages/core/src/models/connection/ConnectionUpdater.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npx vitest run apps/desktop/src/electron/DesktopStateStore.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npx vitest run apps/desktop/src/renderer/useAddConnectionForm.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Claude auth-source cleanup

- Fixed Claude settings apply so Nile removes conflicting Claude-owned auth helpers when taking over authentication:
  - `apiKeyHelper`
  - `ANTHROPIC_FOUNDRY_API_KEY`
  - `ANTHROPIC_FOUNDRY_RESOURCE`
  - `CLAUDE_CODE_USE_FOUNDRY`
- This prevents Claude Code from seeing multiple active auth sources at once when Nile applies:
  - a gateway/API-key Claude connection via `ANTHROPIC_AUTH_TOKEN`
  - a direct Anthropic API-key connection via `ANTHROPIC_API_KEY`
  - a Claude session connection
- Added regression coverage for both API-key and session apply paths so these conflicting auth-source keys are removed instead of preserved.

### Verification

- `npx vitest run packages/core/src/agents/claude/SettingsStore.test.ts packages/core/src/agents/claude/current-state/Reader.test.ts`
- `npm run typecheck`

### Claude auth conflict cleanup

- Fixed Claude apply so Nile clears `apiKeyHelper` from `~/.claude/settings.json` whenever it applies either:
  - an API-key-backed Claude connection
  - a Claude session connection
- This prevents Claude Code auth conflicts where `apiKeyHelper` competes with:
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_AUTH_TOKEN`
- Added regression coverage for:
  - API-key apply removing `apiKeyHelper`
  - session apply removing `apiKeyHelper`
  - Claude current-state reader expectations after the newer `api_key` credential shape change

### Verification

- `npx vitest run packages/core/src/agents/claude/SettingsStore.test.ts packages/core/src/agents/claude/current-state/Reader.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### API key source modes

- Added two API-key source modes across desktop add/edit flows:
  - `Paste API key`
  - `Use existing env key`
- `api_key` credentials now distinguish:
  - direct secrets stored in Nile
  - env-key references stored as the variable name only
- Local credential resolution now supports both:
  - `resolve(...)` stores the env-key reference without materializing the secret
  - `resolveProbeCredential(...)` reads the real env value only when gateway/Azure probing needs it
- Connection create/update flows now separate:
  - persisted credential
  - probe credential for endpoint detection and gateway capability refresh
- Codex apply now respects env-key-backed API-key connections:
  - writes the custom `env_key` into `config.toml`
  - does not write the real secret into `auth.json`
  - avoids overriding a user-managed `OPENAI_API_KEY` slot for env-key mode
- Desktop connection summaries now carry API-key source metadata so edit flows can reopen in the correct mode.
- Current-state matching/import reuse for Codex API-key setups now also recognizes saved env-key-backed connections by env key name.

### Verification

- `npm run typecheck`
- `npx vitest run packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/models/connection/ConnectionCreator.test.ts packages/core/src/agents/codex/apply/ApplySelection.test.ts`
- `npm run build --prefix apps/desktop`
- `npx vitest run packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/electron/DesktopStateStore.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop renderer component and state boundary cleanup

- Split desktop renderer shell concerns so `SettingsApp` no longer owns preference persistence, theme synchronization, and page/selection routing directly:
  - added `useDesktopPreferences`
  - added `useSettingsNavigation`
- Reduced the two main oversized renderer files back under the repository limit:
  - `apps/desktop/src/renderer/SettingsApp.tsx` -> 434 lines
  - `apps/desktop/src/renderer/AddConnectionPage.tsx` -> 384 lines
- Moved add-connection async orchestration out of page JSX into `useAddConnectionPageState`, so the page component is now mostly layout plus field composition instead of mixed view/state/effect logic.
- Removed the dead `reset` export from `useAddConnectionForm` after confirming the renderer no longer consumes it.
- Rechecked Tailwind usage outside renderer components and found no direct style usage outside component/UI files; the only non-component hit is the shared `lib/cn.ts` merge helper.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Claude gateway model cleanup

- Updated the Claude settings writer so applying a non-official API-key gateway clears sticky Claude model selections that can force incompatible upstream model groups on the next request.
- Gateway API-key apply now removes:
  - top-level `model`
  - `ANTHROPIC_DEFAULT_*_MODEL` env overrides
- Preserved unrelated user env/settings entries while still keeping Nile-managed Anthropic auth/base-url fields authoritative.
- Added a Claude settings-store regression test covering the gateway case where an old `claude-opus-4-6` selection and `ANTHROPIC_DEFAULT_SONNET_MODEL` would otherwise survive a gateway switch.

### Verification

- `npm run test:core -- --run packages/core/src/agents/claude/SettingsStore.test.ts`
- `npm run typecheck`

### OpenClaw missing-config issue wording

- Fixed the OpenClaw local-state path so a missing `~/.openclaw/openclaw.json` no longer surfaces as the misleading schema error:
  - `OpenClaw config does not define agents.defaults.model.primary`
- `OpenClaw` now reports an explicit missing-config issue with the resolved config path when the local file does not exist.
- Added renderer translation coverage so desktop surfaces show:
  - `未找到 OpenClaw 本地配置文件：...`
  instead of implying the user already has a readable config with a missing field.

### Verification

- `npm run test:core -- --run packages/core/src/agents/openclaw/current-state/Detector.test.ts`
- `npm run test:desktop -- --run apps/desktop/src/renderer/shared/Support.test.ts`
- `npm run typecheck`

### Desktop gateway edit-page probe state fix

- Fixed the gateway edit-page support summary so a successful manual `Detect again` result is no longer cleared on the next render when no inline API key override is present.
- Stopped the edit-page gateway summary from showing the empty-state detection copy before any probe has actually been run.
- Kept the existing saved-credential probe path intact; the change is limited to renderer state ownership for:
  - whether a probe has happened
  - whether detected agents should still be shown after a successful manual probe

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop -- --run apps/desktop/src/electron/DesktopConnectionManager.test.ts`

### Gateway configurable agents expansion

- Updated the core gateway preset so `configurableAgents` now maps to the full supported agent set instead of the previous `codex/claude` subset.
- Kept gateway onboarding detection semantics narrower:
  - `suggestedAgents` still reflects what probe detection can currently confirm
  - `configurableAgents` now reflects the product rule that gateway is a general-purpose connection surface
- Updated saved-connection summaries so existing gateway connections also expose the full supported agent set during edit flows instead of being narrowed back down by persisted protocol hints.
- Added regression coverage for:
  - gateway preset definitions exposing the full supported agent list
  - saved gateway connections reporting the full configurable agent set

### Verification

- `npm run test:core -- --run packages/core/src/models/connection/ConnectionCatalog.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### CLI agent selection policy convergence

- Removed the CLI-local `supportsOpenClaw(...)` branch from `ConnectionCommands`.
- Extended `ConnectionAgentPolicy` with CLI-facing selection helpers so prompt-time and validation-time agent availability now come from the shared connection policy layer:
  - `readSelectableAgents(...)`
  - `supportsAgent(...)`
- Updated CLI interactive selection and explicit `--agents/--openclaw-model-id` validation to ask the shared policy instead of maintaining a second copy of gateway/openai/anthropic eligibility rules.

### Verification

- `npm run test:cli -- --run apps/cli/src/NileCli.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Connection agent policy extraction

- Added a shared `ConnectionAgentPolicy` in core so connection agent availability is no longer sourced from ad hoc per-call constants.
- Moved catalog agent defaults behind the policy:
  - `ConnectionCatalog` now stores only preset metadata plus `suggestEnabledAgents`
  - `configurableAgents` and `defaultEnabledAgents` are derived when definitions are read
- Moved onboarding agent availability behind the same policy:
  - `ConnectionOnboardingPolicy` now asks `ConnectionAgentPolicy` for `configurableAgents` and fallback defaults
  - protocol detection still only affects `suggestedAgents`
- Moved saved-connection capability summaries behind the same policy:
  - `SavedConnections` now delegates configurable-agent computation to `ConnectionAgentPolicy`
  - saved gateway connections now stay aligned with the product rule that gateway is configurable for every supported agent
- Exported the shared policy from the connection model index so follow-on call sites can continue converging on one source of truth.

### Verification

- `npm run test:core -- --run packages/core/src/models/connection/ConnectionCatalog.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop connection edit capability refresh

- Added an explicit desktop IPC path for re-detecting capability on an existing saved connection:
  - `desktop:describe-saved-connection-onboarding`
  - the probe reuses the currently saved credential when the user has not entered a replacement key
  - env-key backed credentials are resolved to probe credentials before detection
- Updated the edit-connection flow so gateway connections can be re-detected from the edit page without forcing the user to re-save first.
- Added a `重新检测` / `Detect again` action to the edit page footer for gateway connections.
- Updated edit-page capability state to consume refreshed onboarding `configurableAgents` instead of only the saved connection snapshot, so the visible agent list can follow the latest probe result.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Gateway curl guidance

- Replaced the misleading add-connection `Raw response` tab with a concrete `curl` tab.
- The gateway capability panel now generates shell-ready commands from the user’s current endpoint and key input, matching the actual probe routes Nile checks:
  - OpenAI `responses`
  - OpenAI `chat/completions`
  - OpenAI `models`
  - Anthropic bearer `messages`
  - Anthropic `x-api-key` `messages`
- For direct API keys the generated script embeds the current typed key; for env-key mode it references the user’s chosen env var, so the output stays runnable without inventing fake placeholders.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Gateway probe inspection

- Expanded the add-connection capability panel so detection now exposes two extra inspection actions:
  - a persistent `Detect again` action after gateway capability has already been resolved
  - a shadcn `Tabs` view that keeps both the human summary and the raw onboarding response visible to the user
- The capability field now stores the last onboarding payload from detection and renders it as formatted JSON in a dedicated `Raw response` tab.
- Gateway probe failures also retain a structured payload in that same inspector area, so users can compare the visible warning with the raw error object from the latest probe attempt.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop packaged helper architecture alignment

- Kept desktop packaging on the existing `dist/electron/KeychainGenericPasswordHelper` handoff, but changed the shared core build so the copied helper is now a universal macOS binary instead of a host-arch-only artifact.
- Lowered the bundled helper deployment target to `macOS 12.0` so packaged desktop builds continue to work on supported Monterey machines instead of dying in `dyld` with newer Foundation symbol requirements.
- This removes the packaged-app failure mode where:
  - the app bundle is `x64`
  - but the bundled keychain helper is `arm64`
  - causing macOS to reject helper startup with `Bad CPU type in executable`
- Desktop now also benefits from clearer credential-sync diagnostics because helper startup failures preserve the low-level process error message instead of flattening to `security exited with code 1`.

### Verification

- `npm run desktop:build`
- `file packages/core/dist/services/credential/KeychainGenericPasswordHelper`

### Desktop state-surface regrouping

- Moved the desktop state-surface cluster out of `apps/desktop/src/` root into `apps/desktop/src/state/`:
  - `Surface`
  - `Types`
  - `ConnectionPresenter`
  - `UsageCache`
  - `UsageSummary`
  - `HistoryQuery`
  - `MenubarQuery`
  - `SettingsQuery`
- Moved the matching state-surface tests with that cluster:
  - `Surface.test.ts`
  - `UsageSummary.test.ts`
- Kept `DesktopLauncher.test.ts` at `src/` root because it verifies the top-level app launcher, not the desktop state surface.
- Updated renderer and Electron imports to point at the new `state/` home so `src/` root no longer acts as a mixed bucket for state, presentation, and shell concerns.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Desktop connection-edit support split

- Split gateway capability probing and trust/agent reconciliation out of `useConnectionEditState` into `useGatewaySupportState`.
- Kept `useConnectionEditState` focused on:
  - editable field state
  - auth update intent
  - auth.json picker lifecycle
  - submit payload assembly and confirmation
- Reduced the edit-state hotspot sizes to:
  - `useConnectionEditState.ts` -> 308 lines
  - `useGatewaySupportState.ts` -> 167 lines

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Desktop main-process shell split

- Split Electron shell concerns out of `DesktopMain` into `DesktopShell`:
  - settings window lifecycle
  - tray creation and refresh
  - open-file dialog
  - external link / GitHub / support-email helpers
  - app icon and package-version lookup
- Kept `DesktopMain` focused on composition, lifecycle wiring, and IPC route registration.
- Reduced the remaining main-process hotspot sizes to:
  - `DesktopMain.ts` -> 307 lines
  - `DesktopShell.ts` -> 175 lines

### Verification

- `npm run test:desktop`
- `npm run typecheck`
- `git diff --check -- . ':(exclude)error.log'`

## 2026-05-05

### Step 56: Split desktop i18n resources and settings composition

- Replaced the monolithic renderer translation table with per-language resource modules under `renderer/shared/i18n/`.
- Added a shared catalog validator so every supported language must match the English keyset exactly at runtime/test time.
- Tightened translator fallback behavior: missing keys no longer silently fall back to English copy.
- Normalized persisted theme preferences so invalid stored theme values now resolve to `system` consistently.
- Split `SettingsApp` into smaller orchestration slices:
  - `SettingsChrome`
  - `SettingsPageContent`
  - `SettingsDialogs`
- Added focused renderer tests for:
  - translation catalog completeness
  - theme fallback normalization

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Desktop state-surface and preload boundary cleanup

- Split `DesktopSurface` query responsibilities into focused classes:
  - `MenubarStateQuery`
  - `SettingsStateQuery`
  - `HistoryStateQuery`
- Reduced `DesktopSurface` itself to session orchestration plus a small number of explicit commands:
  - `switchConnection`
  - `rollbackLatestMutation`
  - `importDetectedSetups`
  - cached menubar usage refresh
- Reshaped the preload bridge from one flat API bag into grouped renderer-safe capability objects:
  - `window.nileDesktop.state`
  - `window.nileDesktop.connections`
  - `window.nileDesktop.updates`
  - `window.nileDesktop.app`
- Updated renderer callers to use the grouped bridge so future Electron capabilities land in a narrower, more task-oriented preload surface.
- Tightened `DesktopConnection.authMode` from a loose `string` to `AuthMode | "unknown"` so renderer DTOs align better with core domain types.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Desktop effective-current selection alignment

- Kept desktop connection rows aligned with the effective current connection when Codex live state matches a saved connection:
  - agent cards and settings lists now clear stale `selectedByAgents` display state for the active agent
  - the matched live saved connection is shown as both current and selected in desktop lists
- Added a regression test covering the real two-connection OpenAI session case:
  - stale saved selection points at one account
  - live Codex state matches another saved account
  - desktop now shows the live saved account as current, selected, and uses that account's quota snapshot
- Kept this as a display-state correction only; status reads still do not mutate persisted agent selection.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/DesktopSurface.test.ts`
- `npm run test:desktop`
- `npm run typecheck`
- `git diff --check`

### Desktop keychain helper bundling fix

- Fixed desktop `import-current-connection` / save-to-Nile failures caused by the keychain helper path resolver running inside the bundled Electron CJS main process.
- `GenericPasswordWriter` now resolves its runtime directory in both contexts:
  - direct ESM package execution via `import.meta.url`
  - bundled CJS desktop execution via `__filename`
- Updated desktop build packaging to copy the native `KeychainGenericPasswordHelper` binary from `packages/core/dist/services/credential` into `apps/desktop/dist/electron`, so the bundled Electron main process always has a local sibling helper to execute.

### Verification

- `npm run build --prefix apps/desktop`
- `./node_modules/.bin/vitest run packages/core/src/services/credential/GenericPasswordWriter.test.ts apps/desktop/src/DesktopSurface.test.ts`
- `npm run typecheck`

### Desktop About panel metadata fix

- Fixed the macOS system `About Nile` panel to use Nile-owned metadata instead of Electron defaults.
- Desktop main now configures the About panel explicitly on macOS with:
  - application name `Nile`
  - version read from `apps/desktop/package.json`
  - a `Development build` fallback label when the package version is still the unreleased `0.0.0`
  - the packaged Nile app icon path
- Switched desktop app icon resolution on macOS to prefer `build/icons/icon.icns`, which also feeds the About panel and dock icon path consistently.

### Verification

- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `git diff --check`

### Security hygiene hardening

- Marked Claude `settings.json` mutation-history snapshots as sensitive so Claude API key/token values are no longer written to plaintext history snapshot files.
- Sanitized repository fixtures and test constants that previously used realistic-looking personal identifiers and long token literals:
  - replaced personal email strings with generic `@example.com` fixtures
  - replaced internal gateway host fixtures with `gateway.example.test`
  - replaced long Cursor session JWT fixtures with synthetic structurally valid token strings
- Kept runtime behavior unchanged while reducing accidental secret-scanner noise and local privacy leakage from fixtures.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Dead code cleanup and runtime-local wiring fix

- Removed unused dead file `packages/core/src/runtime-local/History.ts` (`SessionHistory` had no inbound references and was not exported).
- Fixed `NileSession` -> `SessionAgents` construction by passing the required mutation-history accessor callback, restoring strict typecheck consistency after the runtime-local split.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Connections toolbar props compatibility fix

- Fixed a renderer crash in `ConnectionsToolbar` caused by old call sites passing no provider-filter props after the toolbar API expansion.
- Made provider/search props optional with safe defaults so `providers.map(...)` never reads from `undefined`.
- Added `showSearchAndFilter` to support toolbar reuse in agent detail connections where only add/refresh actions are needed.
- Updated `AgentConnectionsSection` to use `showSearchAndFilter={false}` explicitly.

### Verification

- `npm run test:desktop`

### Edit connection provider summary simplification

- Simplified provider info in `ConnectionEditPage` to match the `Add connection` information density.
- Replaced the verbose provider-about card with the same `ProviderSummary` block used in `AddConnectionPage` (summary + official-site text action only).
- Removed the now-unused `ProviderAboutCard` component file to avoid dead renderer code.

### Verification

- `npm run test:desktop`

### Connections toolbar single-row and control sizing

- Kept the `ConnectionsToolbar` controls on one row by removing wrap behavior and letting only the search field flex/shrink while provider filter and action buttons stay fixed-width.
- Unified top-bar control heights to `h-11` for:
  - search input
  - provider filter trigger
  - add connection button
  - refresh button
- Aligned toolbar control styling so the search input and action buttons use matching rounded corners and icon sizing with the provider selector.

### Verification

- `npm run test:desktop`

### Desktop connection edit form stability

- Fixed connection-name edits being overwritten while typing in `ConnectionEditPage`.
- Root cause: `useConnectionEditState` reset local form state on every `connection` object identity change; background desktop state refreshes (`desktop:state-changed`) frequently provide a new object even when the selected connection is unchanged.
- Changed form reset trigger to only run when `connection.id` changes, so user-entered edits persist during background refreshes.

### Verification

- `npm run test:desktop`

### Menubar switch state freshness

- Fixed stale tray checkbox state after connection switching from menubar.
- Changed tray popup flow to refresh menubar state before building and showing the tray menu, instead of showing cached state first and refreshing in the background.
- This removes the "open once more to see correct checkmark" behavior after a switch.

### Verification

- `npm run test:desktop`

### Connections provider filter UX alignment

- Updated Connections table provider rendering to plain text labels (no provider icons inside table cells).
- Switched the provider filter control to reuse the Add Connection combobox pattern:
  - provider icon in options
  - built-in provider search field in dropdown
  - no second-line description in options
- Kept provider filtering semantics unchanged (`endpointFamily`) while aligning visual style with Add Connection.

### Verification

- `npm run test:desktop`

### Connections table provider-first display

- Replaced the Connections table `Auth` column with `Provider`.
- Added provider badges (icon + name) for table rows and mobile cards.
- Changed Connections toolbar filter from auth-mode to provider, with provider icons in the dropdown.
- Kept search behavior intact while shifting filter semantics to `endpointFamily`.

### Verification

- `npm run test:desktop`

### Connection update sync confirmation

- Added an edit-flow confirmation when a saved connection is currently selected by agents and the submitted changes affect runtime behavior (endpoint/auth/enabled agents).
- Added `syncSelectedAgents` to desktop update payloads so renderer intent can be passed through Electron to the connection manager.
- Implemented optional post-update reapply: when `syncSelectedAgents` is true, desktop re-runs `useConnection` for each selected agent on that connection.
- Added test coverage in `DesktopConnectionManager.test.ts` to verify selected agents are re-applied when the sync flag is enabled.

### Verification

- `npm run test:desktop`

### Connections table search and filter

- Added connection search in the desktop Connections toolbar.
- Added auth-mode filtering in the same toolbar (all modes + detected modes in current list).
- Added no-match empty state for filtered results and a one-click "Clear filters" action.
- Kept table/card rendering unchanged by applying filtering in `ConnectionsPage` and passing filtered rows to `ConnectionTable`.

### Verification

- `npm run test:desktop`

### Gateway probe false-positive fix

- Tightened `GatewayProbe` so OpenAI compatibility is no longer inferred from route existence alone.
- Gateway OpenAI support now requires:
  - `/models` to return a usable probe model id
  - `/responses` and `/chat/completions` to succeed semantically before each wire API is marked supported
- Probe model selection now iterates through preferred and fallback OpenAI models instead of assuming the first preferred model is representative.
- This avoids false negatives on gateways where:
  - `gpt-5.4` fails
  - but `gpt-5.3-codex` succeeds on `chat/completions`
- This prevents gateways that expose OpenAI-shaped routes but reject real Codex requests from being auto-suggested for Codex.
- Added targeted coverage in `GatewayProbe.test.ts` for:
  - semantic OpenAI probe failure returning no detected support
  - partial OpenAI support preserving only the passing wire API
  - preferred-model failure with fallback-model success preserving `chat` support

### Verification

- `npm run test:core -- --run packages/core/src/models/connection/GatewayProbe.test.ts packages/core/src/models/connection/ConnectionCreator.test.ts`
- `npm run typecheck`

### Claude gateway beta compatibility

- Confirmed the Claude gateway apply path was still failing after a clean re-apply because Claude Code was sending experimental beta fields and headers that `gateway.example.test` rejects with `invalid beta flag`.
- Updated `ClaudeSettingsStore.applyApiKey(...)` so any non-official `ANTHROPIC_BASE_URL` now also writes:
  - `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`
- Updated the same apply path to pin a Claude exact model ID for third-party gateways when Claude's local `cache/gateway-models.json` has a matching model list for the target base URL.
  - preferred family order: `sonnet` -> `opus` -> `haiku`
  - higher semantic versions win within a family
  - if the current `settings.json` model is already present in the gateway cache, it is preserved instead of being overwritten
- Treated that env var as a managed gateway compatibility setting:
  - it is removed when switching back to official Anthropic/session-based setups
  - it is not preserved across later applies unless the target is still a third-party Anthropic gateway
- Extended Claude settings tests to cover:
  - bearer gateway apply writing the beta-disable env
  - sticky gateway model cleanup still retaining the beta-disable env
  - preferred exact-model pinning from the gateway model cache
  - preserving an already-selected cached gateway model
  - official Anthropic apply dropping any stale gateway beta-disable env

### Verification

- `npm run test:core -- --run packages/core/src/agents/claude/SettingsStore.test.ts`
- `npm run typecheck`

### Desktop renderer live-issue and quota fallback cleanup

- Kept OpenClaw current-state errors in core as raw diagnostics, but translated the known renderer-facing live-issue strings in `renderer/shared/Support.ts` before they are shown in the agent connections alert.
- Added desktop translation catalog entries for the current OpenClaw config failures so Chinese users no longer see the raw English `agents.defaults.model.primary` error in the UI.
- Removed the agent-card quota loading spinner fallback for saved connections with no supported quota source; those cards now render the same `Unknown`/`未知` fallback as the rest of the desktop surface instead of looking like quota is still loading forever.
- Added a focused renderer shared test covering:
  - unknown usage fallback text
  - OpenClaw live-issue translation mapping

### Verification

- `npm run test:desktop -- --run apps/desktop/src/renderer/shared/Support.test.ts apps/desktop/src/UsageSummary.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop capability-section gateway scoping

- Scoped capability detection copy to gateway-only flows in the desktop renderer.
- Non-gateway connection forms still show the enabled/configurable agent list, but they no longer render detection-state copy such as:
  - `Detecting supported agents…`
  - `Detected support: ...`
  - `No compatible agents detected yet.`
- Kept gateway add/edit flows unchanged so capability probing remains visible only where Nile actually performs protocol detection.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop renderer capability de-logicification

- Removed the last `codex`-specific `env_key` gate from the renderer by adding `supportsEnvKey` to shared connection definitions, derived from `ConnectionAgentPolicy` instead of inferred from checkbox lists in `ConnectionFormParts`.
- Added a focused core test for `ConnectionAgentPolicy.supportsEnvKeySource(...)` so API-key env-var support now has one shared rule source for desktop and future surfaces.
- Moved add-page and agent-page connection-definition filtering out of `SettingsApp` and into shared renderer data/support helpers:
  - `useDesktopData.canConfigureAgent(...)`
  - `useDesktopData.readDefinitionsForAgent(...)`
- Collapsed page-local display decisions into hook outputs so `AddConnectionPage` and `ConnectionEditPage` no longer decide their own fallback enabled-agent list inline; they now render `displayedEnabledAgents` from state hooks.
- Centralized preset search keyword shaping in shared support so the add-connection combobox no longer reaches directly into capability arrays from page code.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:core -- --run packages/core/src/models/connection/ConnectionAgentPolicy.test.ts packages/core/src/models/connection/ConnectionCatalog.test.ts`

### Desktop gateway live-state matching fix

- Fixed a false-positive desktop onboarding case where an already saved gateway connection could still show up as `发现新配置` on the agent page.
- Root cause:
  the live-state matcher required endpoint protocols to match exactly, so a saved multi-protocol gateway record (`openai + anthropic`) did not match a Codex live state that can only report the OpenAI side.
- Added subset-compatible endpoint matching for live-state/import detection:
  - exact endpoint matches still win first
  - if no exact match exists, a saved endpoint can now satisfy a live-state candidate when it has the same root/profile and contains the candidate protocol shape as a subset
- Kept this relaxation scoped to import/live-state matching only; connection creation/update endpoint identity rules were not broadened.
- Added regression coverage for:
  - Codex detector matching a saved gateway endpoint that has extra Anthropic protocol metadata
  - Desktop settings state keeping such a gateway out of `detectedSetups.importableCount` and reporting Codex as `synced`

### Verification

- `npm run test:core -- --run packages/core/src/agents/codex/current-state/Detector.test.ts packages/core/src/models/connection/ConnectionCatalog.test.ts packages/core/src/models/connection/ConnectionAgentPolicy.test.ts`
- `npm run test:desktop -- --run apps/desktop/src/DesktopSurface.test.ts`
- `npm run typecheck`

### Desktop connection capability panel rollback

- Reverted the add-connection capability surface from the experimental tabs/curl view back to the simpler single panel:
  - detected support text
  - agent checkbox list
- Removed the temporary curl-generation UI and its translation strings from `ConnectionFormParts` and the desktop i18n table.
- Changed add-connection state to track `configurableAgents` from onboarding results instead of only reading the preset definition:
  - initialize from the selected preset definition
  - expand from `describeConnectionOnboarding(...).configurableAgents` when probing returns more
  - preserve already selected agents when the refreshed configurable set still allows them
- Kept the renderer-side list generic so future backend onboarding expansions can surface newly supported agents without another renderer-only UI change.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop agent icon color restoration

- Restored brand tinting for desktop agent logos by defining the missing renderer `agent-tone-*` classes that the agent card header was already wired to use.
- Extended the same tone treatment to the compact agent icon stack in connection views so the renderer no longer mixes colored agent cards with monochrome list icons.
- Kept the current SVG source assets and used color tinting through `currentColor`, which preserves the existing icon pipeline while making Codex, Cursor, Claude, and OpenClaw visually distinct again.

### Verification

- `npm run build --prefix apps/desktop`

### Gateway add-flow stabilization

- Fixed the add-connection renderer loop that could spam `Maximum update depth exceeded` during capability detection:
  - `useAddConnectionForm` now returns stable setter callbacks instead of recreating them every render
  - the add-page onboarding probe now catches rejected probe requests instead of leaving an unhandled promise path behind
- Stopped failed gateway capability detection from hard-blocking connection creation:
  - the add page now surfaces a non-blocking warning when gateway probing fails
  - users can still continue saving the gateway and manually manage enabled agents
  - the footer now offers both `Add connection` and a retryable `Detect capability` action after a failed probe
- Added an explicit core fallback path for user-approved gateway saves after failed detection:
  - desktop add-connection input now carries an `allowUndetectedGateway` flag only after the user has already seen the failed probe state
  - `ConnectionEndpointBuilder` still probes by default, but when fallback is explicitly allowed it synthesizes a generic gateway protocol from the manually enabled agents instead of throwing
  - this keeps normal validation strict while unblocking the manual-save path the user requested
- Added regression coverage for both layers:
  - core `ConnectionCreator` test for fallback gateway creation
  - desktop connection manager test for saving a gateway when probing returns no detectable protocols

### Verification

- `npm run typecheck`
- `npm run test:desktop -- --run apps/desktop/src/electron/DesktopConnectionManager.test.ts apps/desktop/src/renderer/connections/useAddConnectionForm.test.ts`
- `npm run test:core -- --run packages/core/src/models/connection/ConnectionCreator.test.ts`
- `npm run build --prefix apps/desktop`

### Gateway probe de-duplication

- Stopped the add-connection renderer from re-running `describeConnectionOnboarding(...)` immediately after a successful gateway `Detect capability` click.
- Gateway capability detection now has a single probe entrypoint:
  - manual `prepareGateway()` for the gateway/API-key flow
  - effect-driven auto-probing remains only for non-gateway presets that ever opt into suggested-agent probing
- This removes the duplicate post-success loading pass where the UI already showed detected agents but briefly flipped back to `正在检测支持的 Agent...`.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop add-connection provider summary cleanup

- Moved the provider explainer out of its own large card and into the existing `Choose AI provider` block on the add-connection page.
- Reduced the inline provider details there to just:
  - localized provider summary
  - official site link and action
- Removed the extra add-page-only provider chrome (`About {provider}`, icon header, duplicated provider name) so the selection step stays compact.
- Fixed Chinese desktop `providers` navigation/page copy that was still falling back to English labels like `Providers` / `Provider`.
- Removed the visible official-site URL from the inline provider summary so the add page now keeps only the `Open site` action button.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Desktop renderer directory reorganization

- Reorganized `src/renderer` around feature and shell boundaries instead of keeping nearly all renderer files flat under one directory.
- Introduced clear renderer directory groups:
  - `app/` for entrypoints, shell wiring, and app-level hooks
  - `agents/`
  - `connections/`
  - `quick-setup/`
  - `settings/`
  - `providers/`
  - `shared/`
  - existing `ui/` and `lib/`
- Moved renderer files into those groups and updated relative imports so feature-local files now sit beside their closest collaborators instead of relying on a flat filename namespace.
- Updated desktop build/config entry references to match the new source layout:
  - `build.ts`
  - `components.json`
- Kept `globals.d.ts` and `json.d.ts` at the renderer root as ambient declarations rather than forcing them into an artificial single-purpose directory.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer selector and text-action primitives

- Added a shared `ui/choice-card.tsx` primitive for selectable bordered option cards and moved `ConnectionMethodSelector` onto it, so method selection no longer uses page-local raw button styling.
- Added a shared `ui/text-button.tsx` primitive for text-only ghost actions and replaced repeated hand-tuned text-button styling in:
  - `ConnectionTable`
  - `AgentCard`
- This keeps the renderer closer to the desktop AGENTS rule of preferring shared shadcn/open-code controls over page-local control styling, while preserving the existing product copy and interaction behavior.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Agent home path overrides in agent detail

- Added a desktop-side `AgentHomesStore` so per-agent home path overrides are persisted next to the desktop SQLite state and merged into the shared agent home map on startup.
- Exposed a new `updateAgentHome` preload bridge and wired the agent detail page to show an `Agent home` section where users can save a custom local path or reset that agent back to its default home.
- Kept the renderer logic thin by reusing `settingsState.advanced.agentHomes` as the source of truth for the displayed path and letting the main process persist the override and trigger a full desktop refresh after each save.
- Moved `Agent home` into its own detail-page tab and reduced the content to the current path input plus `Save` / `Reset to default path` actions so the page no longer duplicates the same path information in multiple blocks.
- Restored normal spacing between the agent detail tabs and the selected tab content after the new `Agent home` tab initially rendered flush against the content card.

### Verification

- `npm run test:desktop -- --run apps/desktop/src/electron/AgentHomesStore.test.ts apps/desktop/src/renderer/shared/Support.test.ts`
- `npm run test:core -- --run packages/core/src/agents/openclaw/current-state/Detector.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Codex gateway direct-key apply fix

- Stopped projecting `env_key` into Codex configs for direct OpenAI-compatible API keys, so gateway and Azure/OpenAI direct-key applies now rely on `auth.json` instead of forcing Codex CLI to find `OPENAI_API_KEY` in the shell environment.
- Kept explicit env-backed credentials unchanged: if the saved connection really uses an existing env var, Nile still writes that env key into the Codex provider block.
- Added focused regression coverage for:
  - Codex gateway direct-key apply
  - Azure direct-key apply
  - Codex projection preserving explicit env-key credentials

### Verification

- `npm run test:core -- --run packages/core/src/agents/codex/apply/ApplySelection.test.ts packages/core/src/projection/Resolver.test.ts`
- `npm run typecheck`

### Desktop renderer usage-panel convergence

- Added a shared `UsagePanel` renderer component so usage/quota presentation no longer has parallel implementations in:
  - `ConnectionQuotaSection`
  - `AgentCard`
- Kept the shared panel flexible enough for the current desktop surfaces:
  - framed vs unframed usage blocks
  - loading state
  - optional plan label
  - optional renewal timestamp display
  - window count limits
- Switched `ConnectionTable` detail-entry controls from raw styled `<button>` elements to the shared `ui/button` primitive with ghost styling, keeping those table interactions on the same shadcn/open-code path as the rest of the renderer.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer shared display primitives

- Added a shared `ui/field.tsx` display primitive for the repeated renderer pattern of:
  - uppercase muted label
  - simple text or inline content value
- Replaced page-local field render helpers with the shared primitive in:
  - `ConnectionTable`
  - `AgentConnectionsSection`
  - `ConnectionDetailPage`
- Replaced the custom connection-in-use pill markup in `ConnectionDetailPage` with the shared `ui/badge` component.
- Reworked `NileDialog` info sections onto `ui/card` primitives so the dialog content uses the same open-code surface building blocks as the rest of the renderer instead of hand-rolled bordered sections.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer shadcn convergence

- Reworked `SettingsPage` around a focused `SettingsSection` component so the settings surface now reuses one consistent section/list layout instead of repeating page-local section markup three times.
- Replaced the raw connections empty-state box in `ConnectionsPage` with the existing open-code `ui/empty` primitives plus a standard shadcn-style `Button`, keeping the page on the shared renderer component path instead of bespoke empty-state markup.
- Kept the settings surface aligned with the desktop AGENTS guidance:
  - section/list treatment over decorative cards
  - shadcn/open-code controls for interaction primitives
  - page components biased toward composition rather than ad hoc visual structure

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer detail-page cleanup

- Split `ConnectionEditPage` state orchestration into `useConnectionEditState` so edit-page rendering no longer owns:
  - gateway support probing
  - auth-json picker lifecycle
  - auth payload assembly
  - submit in-flight state
- Split `AgentDetailPage` into focused section components:
  - `AgentConnectionsSection`
  - `AgentHistorySection`
- Moved agent connection switch/highlight state down from the whole detail page into the connections section, keeping that transient UI state beside the list that actually uses it.
- Reduced remaining renderer hotspots:
  - `apps/desktop/src/renderer/ConnectionEditPage.tsx` -> 254 lines
  - `apps/desktop/src/renderer/AgentDetailPage.tsx` -> 96 lines
- Rechecked renderer Tailwind usage outside component files and again found no direct style usage outside component/UI files; `lib/cn.ts` remains the only non-component utility hit.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop release Electron runtime pin

- Fixed the macOS release workflow failure where electron-builder could not infer the Electron version from a workspace install plus floating `electron` dependency range.
- Pinned the desktop Electron dependency to `36.9.5` and added the same version to the electron-builder `electronVersion` config so release packaging is deterministic in CI.

### Verification

- `npm install --package-lock-only`
- `npm install --package-lock-only --prefix apps/desktop`
- `npm run build:app:unsigned --prefix apps/desktop`

### Profile Mode MVP

- Added manual Workspace Profile support for desktop:
  - save the current multi-agent connection/home setup as a named profile
  - apply a profile to update agent home paths and selected connections in one explicit action
  - rename and delete profiles without deleting connections or agent state
- Kept profile storage desktop-local in `desktop-profiles.json` next to existing desktop-local state.
- Kept Profile Mode separate from endpoint profiles and future Local Gateway routing:
  - profiles reference saved `connectionId` values only
  - profile apply reuses existing agent home and connection switch mutation paths
  - profile apply updates home paths before switching connections so target config writes land in the selected home path
- Added conditional UI exposure: the sidebar only shows Profiles when at least two agents have usable saved connections.

### Verification

- `npm run test:desktop -- --run apps/desktop/src/electron/profiles/Store.test.ts apps/desktop/src/electron/profiles/Manager.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Gateway endpoint protocol merge

- Fixed endpoint reuse for gateways that are discovered through different agent paths but point at the same backend URL.
- `ConnectionCreator` now treats matching `rootUrl + profile` as the endpoint identity and merges protocol capabilities instead of creating a second endpoint when one side reports only OpenAI and another reports only Anthropic.
- `ConnectionUpdater` uses the same identity merge when an edited connection moves to an existing endpoint, so shared connections can reuse and enrich the existing endpoint record.
- Added protocol-aware merge helpers on `EndpointShape` so merged endpoints retain existing protocol metadata while adding newly detected wire APIs/auth schemes.
- Kept saved connection agent summaries capability-filtered so stale persisted `enabledAgents` entries do not advertise an agent the endpoint cannot currently support.
- Added renderer error surfacing for failed connection switches so validation errors such as unsupported Claude/Gateway protocol choices are visible instead of only landing in Electron logs.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npm run typecheck`

### Desktop gateway detected-agent selection

- Fixed the add-connection gateway form so detected default agents replace the initial preset default when the user has not manually edited the checkbox list.
- Added a form-level manual-edit flag for enabled agents:
  - automatic defaults from detection/session preparation do not mark the selection as manually edited
  - user checkbox changes do mark it as manually edited
  - later detection respects a manual selection instead of re-adding unchecked agents
- Added a regression test for the pure selection resolver covering detected defaults and manual preservation.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/connections/add/useForm.test.ts`
- `npm run typecheck`

### Quick setup gateway endpoint merge

- Fixed the current-state import path used by quick setup so it now uses the same `rootUrl + profile` endpoint identity merge as connection create/edit.
- Claude current-state import still reads only the Anthropic capability from Claude local settings, but importing that detected setup now enriches an existing same-URL gateway endpoint instead of creating a separate `claude` endpoint.
- Added a regression test that seeds an OpenAI-only gateway endpoint, imports a Claude Anthropic view of the same URL, and verifies the final endpoint contains both protocols with the Claude access attached to the existing endpoint.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npm run typecheck`

### Shared connection upsert path

- Introduced a shared core `ConnectionUpsert` class for endpoint/access persistence:
  - endpoint reuse is based on `rootUrl + profile`
  - endpoint protocol capabilities are merged instead of replaced
  - access reuse is based on endpoint, auth mode, credential identity, and OpenClaw model identity
  - enabled agents can be either replaced for explicit create/edit flows or merged for observed current-state imports
- Moved `ConnectionCreator` onto the shared upsert path so Add connection no longer owns separate endpoint/access reuse logic.
- Moved `CurrentStateImportSupport` onto the same upsert path so quick setup/import current setup uses the same merge/reuse rules while still staying observed-only for capability detection.
- Kept `ConnectionUpdater` on its specialized update path because editing existing connections has extra shared-endpoint movement rules, but it now shares the same endpoint identity/merge primitives.
- Added coverage for the sequential quick setup case where a Codex gateway access already exists and importing Claude with the same key reuses that access, merges endpoint protocols, and enables both agents.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts`
- `npm run typecheck`

### Gateway add latency reduction

- Confirmed the gateway add form could spend a long time in `Adding...` because saving a gateway connection re-ran the same capability probe that the user had just run with `Detect again`.
- Added a short process-local cache to the default `GatewayProbe`, keyed by normalized endpoint URL and a hash of the API key, so detect-then-save can reuse the recent probe result without storing the raw key.
- Parallelized independent gateway probe work:
  - OpenAI and Anthropic protocol checks now run together.
  - OpenAI responses/chat semantic probes now run together after model discovery.
- Removed the extra `/models` route existence check from OpenAI support detection because Nile only persists OpenAI support when a real wire API probe succeeds.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/GatewayProbe.test.ts packages/core/src/models/connection/Creator.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts`
- `npm run typecheck`

### Alerts and notifications hardening

- Added a stable usage metric key alongside the existing display label so connection alerts no longer bind directly to provider-facing usage copy.
- Canonicalized usage metric keys on both summary generation and alert persistence, which keeps saved alerts matching through casing and minor label-shape changes while still rendering friendly labels in the UI.
- Hardened the connection alert store hot path:
  - added an in-memory cache so settings-state decoration no longer re-reads and reparses the alerts JSON on every refresh
  - degraded malformed alert config files to an empty alert set instead of breaking the entire settings state
  - cleared the in-memory alert cache during desktop local-state reset
- Fixed the connection detail Alerts section to keep rendering saved rules even when live usage metrics are temporarily unavailable, while still disabling new alert creation until metrics return.
- Split the unread bell-dot path away from full notification-history loading:
  - added a lightweight unread-history query in the notification history store and state bridge
  - switched the titlebar bell indicator to that boolean path instead of keeping the full history list subscribed all the time
  - limited the full notification-history hook to the Notifications page
- Made notification-history read changes propagate immediately to the renderer:
  - row-level mark-read now notifies the renderer
  - macOS notification show/click events also emit a renderer update so the bell dot clears promptly after a system-notification click
- Hardened notification mute reads so malformed mute config falls back to unmuted instead of breaking notification delivery.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/UsageSummary.test.ts apps/desktop/src/electron/alerts/Store.test.ts apps/desktop/src/electron/alerts/Overlay.test.ts apps/desktop/src/electron/notifications/History.test.ts apps/desktop/src/electron/notifications/Service.test.ts apps/desktop/src/electron/state/NotificationMuteStore.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Add connection stays non-applying

- Removed the implicit `switchConnection(...)` call after saving a connection from an agent-scoped add-connection page.
- The agent context still filters/adds copy for relevant connection types, but saving now only creates or reuses the connection; selecting it for an agent remains an explicit user action.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts packages/core/src/actions/live-setup/Import.test.ts`

### Claude gateway current-state labels

- Confirmed current local Codex and Claude configs both point to `llmfk.dpdns.org` and use the same key fingerprint.
- Updated Claude current-state import labels for non-official Anthropic base URLs to use the same gateway-oriented naming as Codex:
  - endpoint label: `Gateway (host)`
  - access label: `Gateway (host) API Key`
- Kept official Anthropic Claude configs labeled as `Claude` / `Claude API Key`.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts packages/core/src/agents/claude/current-state/Reader.test.ts packages/core/src/actions/live-setup/Import.test.ts`

### Connection save refresh latency

- Found that successful add/save connection flows waited for `refreshSettings()` before leaving the add page.
- That path invalidates all desktop state and waits for menubar state plus usage refresh, while the save IPC already schedules a main-process refresh and renderer notification.
- Added a lightweight renderer `reload()` path backed by a settings-state snapshot IPC that skips usage refresh and only uses cached usage values.
- Changed add/save completion to use the lightweight reload so the `Adding...` button is not blocked by menubar usage refresh after the connection has already been persisted.
- Kept manual Refresh on the full refresh path because that action is explicitly asking to refresh external state.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts`
- `npm run typecheck`

### Unified connection usage cells

- Extracted the connection quota-left table cell into a shared renderer component.
- Reused the same quota text, dotted underline, and quota tooltip in both:
  - the global Connections table
  - the Agent detail Connections table
- Applied the same shared cell in the responsive card variants so small viewports do not drift visually.
- Stopped quota tooltip clicks from bubbling into the parent row/card open action.

### Verification

- `npm run typecheck`

### Managed env promotion hardening

- Made desktop managed `NILE_*` env-key promotion safer and less misleading:
  - env-backed direct API-key promotion now updates connection metadata first and rolls it back if the environment-store write fails
  - single-connection imports roll back newly created connections if managed env promotion fails
  - batch detected-setup imports mark the affected item as failed and remove newly created connections if promotion fails
- Hardened desktop env resolution to fall back to the plain process environment when the keychain-backed environment store throws instead of treating that as fatal.
- Removed synthetic quick-setup progress phases:
  - `Save to Nile` now shows a single truthful saving state instead of timer-driven “checking support” / “preparing env” phases
- Added a shared renderer helper for connection apply requirements and moved quick-setup / agent model flows to consume that instead of hand-rolling OpenClaw requirement checks in multiple places.
- Renamed the action directories to clarify scope:
  - `packages/core/src/actions/current-state` -> `packages/core/src/actions/live-setup`
  - `packages/core/src/actions/local-state` -> `packages/core/src/actions/local-setup`

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/environment/Source.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/renderer/quick-setup/SaveState.test.ts`
- `npm run typecheck`

### Quick setup state consistency cleanup

- Made quick-setup confirmation depend on the onboarding scan result only instead of mixing:
  - scan item state
  - current saved selection state
  - sync state
- Removed the agent-card `Saved in Nile: ...` helper text from the local-setup panel because it mixed current saved selection semantics into detected-setup messaging.
- Narrowed matched `Save to Nile` endpoint refresh so it only merges newly detected protocol capabilities and no longer overwrites general endpoint metadata like label/root URL/profile.
- Removed the now-dead `agents.savedInNile` translation key from all desktop locale files.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts`
- `npm run typecheck`

### Live setup rollback and requirement cleanup

- Added a matched-import rollback snapshot for desktop `Save to Nile` flows:
  - reused imports now snapshot selection, per-agent model choice, credential, and endpoint protocol state before import
  - if managed `NILE_*` env-key promotion fails, desktop restores that snapshot instead of leaving partial reused-import side effects behind
  - batch detected-setup imports now restore reused items on the same failure path instead of only cleaning up newly created connections
- Removed duplicate local live detection during quick-setup scanning by letting `ScanLocalSetups` reuse the already-read detection when asking `Status` for the same agent.
- Refactored connection apply requirements into a small policy registry:
  - kept the current OpenClaw rules
  - stopped encoding them directly inside a generic reader method body
  - preserved the existing boolean helpers while also exposing the concrete requirement list for future growth

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts packages/core/src/models/connection/Requirements.test.ts packages/core/src/actions/local-setup/Status.test.ts`
- `npm run typecheck`

### Reconciliation and alert store simplification

- Simplified connection apply requirements to a single source of truth:
  - removed duplicated `needsModelSelection` / `needsEnvBackedApiKey` booleans from the core DTO
  - renderer now derives those checks from the concrete `requirements[]` list through a shared helper
- Reduced agent-list local-setup drift by making the detected-setup section depend only on the onboarding scan item instead of mixing onboarding state with current-selection state.
- Split the desktop connection alert store into smaller responsibilities:
  - `Store.ts` now owns SQLite orchestration and caching
  - `Codec.ts` owns alert normalization, sorting, duplicate validation, and row/legacy decoding
  - `Legacy.ts` owns legacy JSON migration into SQLite

### Verification

- `./node_modules/.bin/vitest run packages/core/src/models/connection/Requirements.test.ts apps/desktop/src/electron/alerts/Store.test.ts`
- `npm run typecheck`

### Model catalog and connection presenter cleanup

- Reduced duplicated model-catalog UI logic across quick setup and agent model editing:
  - added a shared connection-model selection view helper
  - reused the same catalog fetch, default-selection, preview, and ordered-option logic in both dialogs
- Split desktop connection presentation responsibilities:
  - `state/connection/List.ts` now owns list/item assembly
  - `state/connection/Status.ts` now owns current/live connection resolution
  - `ConnectionPresenter.ts` is now a thin coordinator instead of a mixed policy + DTO assembler
- Split desktop connection import orchestration out of the gateway:
  - `electron/connections/Imports.ts` now owns managed-env-aware single/batch import orchestration and rollback
  - `DesktopConnectionGateway.ts` now stays focused on session wiring and public desktop actions

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/live-setup/Import.test.ts packages/core/src/models/connection/Requirements.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Agent switch flow cleanup

- Extracted the shared agent connection switch/model-save orchestration into:
  - `renderer/agents/useConnectionSwitchFlow.ts`
- Reused that flow in both:
  - `renderer/agents/detail/ConnectionsSection.tsx`
  - `renderer/agents/list/Card.tsx`
- Centralized the repeated behaviors:
  - open model dialog when selected-model is required
  - block apply when env-backed API key is still required
  - save `(agent, connection) -> modelId`
  - continue switching after model save when appropriate
  - optionally highlight the just-activated connection in detail view
- This also reduced `ConnectionsSection.tsx` from a state-heavy orchestration file to a small composition wrapper.

### Verification

- `npm run typecheck`

### Desktop release Windows packaging

- Extended desktop packaging so the checked-in scripts now run cross-platform instead of assuming POSIX shell env assignment:
  - `build:release` now uses a CLI flag instead of inline env assignment
  - app packaging now goes through `apps/desktop/package-app.ts`, which applies the macOS unsigned override only where it belongs
- Added Windows packaging output to the desktop app config:
  - `electron-builder` now emits an `x64` NSIS installer on Windows
  - Windows artifacts use an explicit `-win32-x64` filename shape
- Split the desktop release workflow into coordinated jobs:
  - one Ubuntu validation job for tag/version/release-notes/typecheck/test gates
  - one GitHub Release creation/update job
  - one macOS packaging/upload job
  - one Windows packaging/upload job that uses the unsigned packaging path
- Updated desktop release docs and the local release env example so Windows local packaging is documented alongside the existing macOS flow.

#### Key findings

- This pass adds Windows release output, but it does not add a second Windows architecture yet. The workflow currently emits `x64` only.
- Windows release packaging intentionally uses the unsigned packaging path in this batch. The pipeline now produces Windows installers without requiring Windows signing setup, but SmartScreen/signing hardening remains a separate follow-up if needed.
- I left `.vestin/state/features.json` unchanged because `surfaces/desktop-release-pipeline` was already tracked as built; this is an expansion of the existing release feature, not a newly introduced feature state.

### Verification

- `npm run build:release --prefix apps/desktop`
- `npm run build:app:unsigned --prefix apps/desktop`

### Windows tray popup follow-up

- Flattened the Windows tray popup header so it now uses a single top bar:
  - list view shows `Nile` on the left and `Open app` on the right
  - detail view shows the back affordance (`< Agent`) on the left and `Open app` on the right
- Kept the body to the two-step structure only:
  - first level lists configured agents with current connection and quota
  - second level lists connections for the selected agent
- Fixed a popup regression introduced during the header cleanup:
  - `menubar.ts` still referenced `refreshButton` after the DOM button was removed
  - that runtime error stopped the tray renderer before any agent rows were painted
- Simplified the detail header again:
  - removed the repeated current-connection subtitle
  - switched the back affordance text to a breadcrumb-style `Agents > {Agent}`

#### Key findings

- The blank popup was not a data/state issue. It was a renderer initialization crash caused by a stale event binding after removing the refresh control.
- This regression slipped through because the last visual cleanup was not rebuilt before manual verification. The build now catches that exact class of leftover reference again.

### Verification

- `npm run build -w @nile/desktop`
