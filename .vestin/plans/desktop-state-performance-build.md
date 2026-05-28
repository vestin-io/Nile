# Desktop State Performance Build Log

## 2026-05-28

### Step 1: Confirm The Switch Slowdown Source

- Traced the desktop switch flow through `DesktopIpcStateRoutes`, `DesktopStateRefresher`, `DesktopStateStore`, and `DesktopSurface`.
- Confirmed that one connection switch was followed by multiple full-state refresh passes instead of a single targeted refresh.
- Verified from local logs that the repeated work was dominated by repeated all-agent `detectAgentSelection()` calls, especially the Cursor detector.

### Step 2: Collapse Post-Switch Refreshes Into One Shared Desktop Read

- Added a combined desktop refresh path in `DesktopSurface.refreshDesktopState()` that reuses one `NileSession`, one state read context, and one status snapshot for:
  - current-connection usage refresh
  - status entry state
  - settings state
- Updated `DesktopStateStore` and `DesktopStateRefresher` to use the combined refresh instead of separately calling:
  - `refreshStatusEntryState()`
  - `refreshStatusEntryUsage()`
  - `getSettingsState({ refreshUsage: false })`
- Kept standalone status-entry usage refresh behavior intact for background refreshes that are not part of the main switch path.

### Step 3: Remove Redundant Alert Evaluation Reads

- Changed desktop alert evaluation during the combined refresh path to use the already refreshed settings snapshot instead of opening another settings read.
- Preserved the previous alert semantics for standalone usage refreshes by continuing to evaluate against `getSettingsState({ refreshUsage: false })`.

### Step 4: Add Automatic Log Size Control

- Added a bounded desktop log destination in `NileLogger` so the active `app.log` stays capped at 10 MB during runtime instead of growing without bound.
- Kept startup pruning semantics in the same destination so an oversized pre-existing `app.log` is truncated before new writes resume.
- Added cleanup for stale sibling log files matching `app.log.*` so old rotated artifacts do not accumulate alongside the active file.
- Manually truncated the current local `~/.nile-switcher/logs/app.log` after the code change because the file had already grown to more than 700 MB.

### Step 5: Verification

- Verified with:
  - `./node_modules/.bin/vitest run apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/state/Surface.test.ts packages/core/src/services/NileLogger.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

### Step 6: Collapse Model Save Into One Light Refresh

- Investigated the agent model save flow and confirmed it was doing:
  - update saved model metadata
  - full desktop refresh
  - current-connection reapply
  - another full desktop refresh
  - renderer-triggered settings refresh
- Reworked the desktop update-model IPC path so saving a model now:
  - updates the saved model
  - optionally reapplies the current connection in the same gateway session when the edited connection is active
  - triggers one renderer notification refresh without quota reads
- Removed the renderer-side follow-up `switchConnection()` and `refresh()` calls for model saves because the main-process mutation now owns the full save path.

### Step 7: Verification

- Verified with:
  - `./node_modules/.bin/vitest run apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/state/Surface.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

### Step 8: Add Automatic Quota Refresh On The Shared Desktop Refresh Path

- Added `DesktopUsageAutoRefresh` under `apps/desktop/src/electron/shell/` so quota updates are scheduled by the main process instead of by renderer-local polling.
- Reused `DesktopUsageCache.readCacheTtlMs()` as the only cadence source:
  - a startup warm-up refresh after `1.5s`
  - periodic refreshes every cache TTL after that
- Routed both startup and periodic refreshes through `refreshDesktopState(...)` with:
  - `refreshStatusEntryUsage: true`
  - `refreshSettingsUsage: false`
  - `notifyRenderer: true`
- Kept the auto-refresh loop serial so a slow quota read cannot pile up overlapping refreshes.
- Extended the status-entry usage refresh path with an optional `force` flag so periodic refreshes can skip a redundant remote read when another path already warmed the usage cache recently.

### Step 9: Verification

- Verified with:
  - `./node_modules/.bin/vitest run apps/desktop/src/electron/shell/UsageAutoRefresh.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/state/UsageCache.test.ts apps/desktop/src/state/Surface.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

### Step 10: Narrow Automatic Quota Refresh To Cached Current Connections

- Reviewed the first automatic quota refresh implementation and found that it still:
  - sent renderer `state-changed` notifications even when the usage cache stayed fresh
  - rebuilt the full desktop read context, including all-agent status detection, on every periodic refresh
- Reworked the automatic quota path so periodic refresh now:
  - refreshes only cached current-connection ids
  - patches the cached status-entry and settings snapshots in place
  - notifies the renderer only when a usage value actually changes
- Kept a startup fallback path that can still do one full refresh when no cached desktop state is available yet.
- Split the cached-usage mutation logic into `CachedUsageRefresher` and `UsageStatePatcher` so `DesktopStateStore.ts` stays below the repository's 500-line limit.

### Step 11: Verification

- Verified with:
  - `./node_modules/.bin/vitest run apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/electron/shell/UsageAutoRefresh.test.ts apps/desktop/src/state/UsageCache.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

### Step 12: Remove Desktop Legacy Wrappers

- Removed the unused synchronous agent-model update path:
  - `DesktopConnectionGateway.updateAgentConnectionModel(...)`
  - `DesktopStateStore.updateAgentConnectionModel(...)`
- Removed the unused standalone desktop refresher wrapper around status-entry usage refresh:
  - `DesktopStateRefresher.refreshStatusEntryUsage(...)`
  - `DesktopStateStore.refreshStatusEntryUsage(...)`
- Deleted the corresponding tests and stubs that only existed to keep those dead code paths compiling.
- Kept `Surface.refreshStatusEntryUsage(...)` because the menubar still uses it for the initial on-demand quota warm-up when no cached usage is present.

### Step 13: Verification

- Verified with:
  - `./node_modules/.bin/vitest run apps/desktop/src/electron/state/DesktopStateStore.test.ts apps/desktop/src/electron/state/DesktopStateRefresher.test.ts apps/desktop/src/electron/shell/UsageAutoRefresh.test.ts apps/desktop/src/state/UsageCache.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

#### Key findings

- The main latency source was repeated full-agent detection after each switch, not the apply itself.
- Caching the refreshed settings snapshot as resolved avoids an immediate second settings scan after switch, at the cost of keeping connection-usage freshness aligned with the pre-existing behavior rather than forcing a full all-connections usage refresh every time.
- Logger bounding currently truncates and restarts the active log instead of preserving historical archives. This meets the 10 MB cap and cleanup requirement, but it intentionally favors bounded disk usage over local log retention.
- Agent model saves were additionally penalized by quota reads for unrelated current connections, especially Gemini CLI sessions. The new save path skips quota refresh entirely and only refreshes structural state needed for the UI.
- Automatic quota refresh now reuses the main-process state cache and renderer `state-changed` flow instead of introducing a second polling mechanism, and the periodic path no longer rebuilds full all-agent desktop state on every interval.
- The remaining `Surface.refreshStatusEntryUsage(...)` method is not legacy; it is still part of the live menubar warm-up path and should not be removed with the deleted desktop wrapper methods.
