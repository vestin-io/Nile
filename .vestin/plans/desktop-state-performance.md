# Desktop State And Performance Plan

## Goal

Make the desktop surface feel instant without moving business rules out of shared core.

The main target is:

- tray menu opens from cached state instead of click-time recomputation
- settings window reads and updates cached desktop state instead of full refresh loops
- heavy state detection and usage refresh become explicit background refresh work

## Current Status

Most of this plan is now implemented.

The current desktop structure that owns this behavior is:

- `apps/desktop/src/electron/shell/`
- `apps/desktop/src/electron/state/`
- `apps/desktop/src/electron/connections/`
- `apps/desktop/src/state/`
- `apps/desktop/src/renderer/app/settings/`

The research findings below capture the original request-oriented baseline that motivated the refactor.
They remain useful as design context, but they do not describe the current grouped file layout.

## Why This Is Needed

The current desktop surface is correct but request-oriented.

That matches CLI behavior, but it is the wrong execution model for a long-lived Electron app:

- tray click currently waits for state recomputation before showing the menu
- settings actions trigger full renderer refreshes that rebuild broad desktop state
- live-state detection, SQLite reads, local file reads, and keychain reads are repeated across surfaces
- freshness policy is implicit and scattered instead of centrally managed

## Research Findings

### Tray click path is blocking

Current flow:

1. tray click enters `DesktopMain.popTrayMenu()`
2. `popTrayMenu()` awaits `buildTrayTemplate()`
3. `buildTrayTemplate()` calls `DesktopSurface.getMenubarState()`
4. `getMenubarState()` opens a fresh `NileSession`
5. `buildMenubarAgents()` calls `session.getAgentStatus()` for every supported agent

Result:

- the menu cannot open until the full state read completes

Relevant files:

- `apps/desktop/src/electron/shell/DesktopMain.ts`
- `apps/desktop/src/state/Surface.ts`
- `packages/core/src/actions/local-state/Status.ts`

### Agent status detection is synchronous and can be expensive

`Status.get(agentId)` calls `detectAgentSelection()` on the agent adapter.

Each adapter opens a detector per call and reads local state synchronously.

This is especially expensive for Cursor because it reads macOS keychain values through synchronous `security` subprocess calls.

Relevant files:

- `packages/core/src/runtime-local/NileSession.ts`
- `packages/core/src/agents/cursor/stores/CursorCredentialStore.ts`
- `packages/core/src/services/credential/SecurityCli.ts`

### Settings currently uses full refresh loops

The settings surface originally:

- calls `getSettingsState()` and `listConnectionDefinitions()` on startup
- listens for `desktop:state-changed`
- re-runs the same full refresh after each desktop action

This keeps behavior simple, but it couples renderer responsiveness to full state rebuilds.

Relevant files:

- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/electron/preload.ts`
- `apps/desktop/src/electron/shell/DesktopMain.ts`

### Usage caching exists, but only as a partial optimization

There is already a dedicated usage cache path in the desktop state layer, and connection switching proactively refreshes the previous and new current connection usage.

This is useful, but it is still not a full desktop state model:

- usage cache is separate from the rest of desktop state
- status and inventory still rebuild on demand
- freshness and invalidation rules are not centralized

## Architectural Decision

Add a desktop-only main-process state layer above `NileSession`.

`packages/core` stays responsible for:

- saved connection inventory
- compatibility rules
- live-state detection
- apply/import/remove/rollback operations
- usage retrieval

`apps/desktop` gains a long-lived state store responsible for:

- cached desktop snapshots
- dirty tracking
- background refresh scheduling
- in-flight deduplication
- pushing snapshot updates to tray/settings renderers

## Recommended Shape

### New main-process component

Add one class in `apps/desktop/src/electron/state/`:

- `DesktopStateStore`

This class should be process-lifetime, owned by `shell/DesktopMain`.

It should stay deliberately small.
Do not introduce a state framework, generic cache abstraction, or many slice classes in the first pass.

### Minimal cached values

The first version of `DesktopStateStore` should only cache the latest completed values for:

- `menubarState`
- `settingsState`
- `historyState`
- `connectionDefinitions`

### Minimal dirty tracking

Use a few coarse invalidation flags first:

- `menubarDirty`
- `settingsDirty`
- `historyDirty`
- `definitionsDirty`

If later measurement proves this is too coarse, only then split into finer-grained dirty keys.

### Minimal refresh policy

The first version only needs:

- one cached value per state type
- one in-flight promise per state type
- explicit refresh methods

Examples:

- `getMenubarState()`
- `getSettingsState()`
- `getHistoryState()`
- `listConnectionDefinitions()`
- `refreshMenubarState()`
- `refreshSettingsState()`
- `refreshHistoryState()`
- `refreshConnectionDefinitions()`

Mutation helpers can stay small and action-specific, for example:

- `invalidateAfterSwitch()`
- `invalidateAfterConnectionMutation()`
- `invalidateAfterRollback()`

## Control Flow Plan

### Tray open

Target flow:

1. tray click reads cached `menubarState`
2. menu opens immediately from cache
3. background refresh starts if relevant slices are dirty or stale
4. refreshed state is stored for the next open

Do not await refresh before `popUpContextMenu()`.

### Settings window open

Target flow:

1. renderer requests current cached settings state
2. window renders immediately
3. main process starts targeted background refresh for stale slices
4. renderer receives pushed updates and re-renders from the refreshed state

### Switch connection

Target flow:

1. call shared core apply flow
2. patch cached state optimistically where safe:
   - current selection for affected agent
3. mark dependent slices dirty:
   - affected agent status
   - old connection usage
   - new connection usage
   - history
4. kick targeted background refresh
5. push updated cached states

### Add / remove / import connection

Target flow:

1. run shared core mutation
2. mark inventory dirty
3. mark impacted agent statuses dirty
4. mark impacted usage entries dirty
5. recompute cached states after targeted refresh

### Rollback

Target flow:

1. run shared core rollback
2. mark affected agent status dirty
3. mark history dirty
4. mark relevant usage dirty if the current connection changed
5. refresh and push

## Renderer Contract Changes

Keep renderer code thin.

Recommended IPC direction:

- `desktop:get-settings-state`
- `desktop:get-menubar-state`
- `desktop:get-history-state`
- `desktop:subscribe-state` remains event-based through preload

The renderer should not decide what to recompute.
It should only:

- read the latest snapshot
- perform explicit actions
- react to pushed snapshot updates

## What Should Stay Out Of Core

Do not move these concerns into `packages/core`:

- freshness windows
- cache invalidation
- background polling
- tray-open performance policy
- renderer subscription semantics

Those are desktop runtime concerns, not shared business rules.

## What Core May Still Need Later

If desktop caching alone is not enough, the next core optimizations should be small and explicit:

1. lighter status reads for tray scenarios
2. compatibility reads without reopening multiple registries
3. reduced repeated local detection work for agents with expensive credential reads

These are optional follow-on optimizations.
They should only happen after the desktop state layer is in place and measured.

## Phased Implementation Plan

### Phase 1: Introduce the minimal state store without changing UI behavior

Goal:

- centralize snapshot ownership in main process

Scope:

- add `DesktopStateStore`
- move latest-value caches and invalidation into it
- keep existing IPC names temporarily
- keep renderers behaviorally unchanged

Done when:

- `DesktopMain` reads desktop state through the store instead of directly through `DesktopSurface`
- no user-visible workflow changes yet

### Phase 2: Make tray open from cache

Goal:

- remove click-time state recomputation from the tray path

Scope:

- cache `menubarSnapshot`
- build tray menu from cached snapshot
- trigger refresh after open instead of before open

Done when:

- tray open path no longer awaits `NileSession` work

### Phase 3: Move settings to snapshot + push updates

Goal:

- stop full renderer refresh loops after every action

Scope:

- renderer requests cached snapshot
- desktop actions update dirty slices and push refreshed snapshots
- replace broad `refresh()` calls with snapshot subscription updates

Done when:

- `SettingsApp` does not call full `getSettingsState()` after every action

### Phase 4: Split expensive refreshes only if the coarse store is not enough

Goal:

- make refresh logic more targeted only where measurement shows it matters

Scope:

- finer invalidation keys where needed
- stale/dirty policies for the proven hotspots
- in-flight dedupe

Done when:

- connection switching avoids unrelated refresh work
- inventory edits avoid unrelated refresh work when the extra complexity is justified

### Phase 5: Measure and only then optimize core hotspots

Goal:

- reduce the remaining heavyweight source reads only when proven necessary

Scope:

- optional core-level status/read optimizations
- optional agent-specific detector caching experiments

Done when:

- performance work is backed by timing evidence, not guesswork

## Risks

### Risk: stale data bugs

If invalidation rules are incomplete, tray and settings can drift from real local state.

Mitigation:

- keep source-of-truth reads in one desktop store
- use explicit invalidation per action
- add tests that assert post-action snapshots

### Risk: event ordering bugs

Renderer updates may race with background refreshes.

Mitigation:

- version snapshots
- dedupe in-flight refreshes
- emit updates only from the store, not from many call sites

### Risk: desktop store becomes a second business layer

If too much logic moves into the store, desktop will fork behavior from CLI.

Mitigation:

- keep the store read-model-focused
- call shared core for all business rules and mutations

### Risk: optimistic patching hides source failures

Optimistic local patching can temporarily show state that the source refresh later rejects.

Mitigation:

- only patch fields that are direct consequences of a successful mutation
- schedule immediate source refresh after mutations

## Verification Strategy

### Automated

- unit tests for slice invalidation rules
- unit tests for targeted refresh behavior
- unit tests for tray snapshot building from cache
- desktop tests for switch/import/remove/rollback snapshot updates

### Manual

- measure tray-open latency before and after Phase 2
- verify settings window feels responsive during repeated switching
- verify state converges correctly after external local config changes

## Recommendation

Do this in the order above.

The most important decision is not a micro-optimization.
It is introducing a desktop-owned state layer so tray and settings stop treating every interaction as a fresh request/response computation.
