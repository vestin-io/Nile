# Target Architecture

Scope: current `nile` repository after the cleanup and slimming passes.

Goal: define a stable, human-oriented structure that keeps features easy to find before we do any broader directory migration.

## Principles

- Keep the top-level workspace split: `apps/` for surfaces, `packages/` for shared implementation.
- Group app code by user workflow before grouping it by implementation style.
- Keep shared files in shared locations only when they are truly shared across workflows.
- Prefer short local file names inside a feature directory, while keeping exported symbol names explicit.
- Avoid new generic buckets such as `Support`, `Manager`, `Helper`, or `Utils`.

## Target Top Level

```text
apps/
  cli/
  desktop/
packages/
  core/
  host-local/
docs/
scripts/
```

This top-level shape is already correct and should stay stable.

## Target `apps/desktop`

```text
src/
  state/
  electron/
    ipc/
    shell/
    state/
    connections/
    updates/
  renderer/
    app/
      settings/
    agents/
      detail/
      list/
    connections/
      add/
      dialogs/
      edit/
      detail/
      list/
    providers/
    quick-setup/
      Page.tsx
      Guide.tsx
      AgentCard.tsx
      DetectedSetup.tsx
    settings/
      dialogs/
      general/
    shared/
    ui/
```

Notes:

- Keep desktop state-surface files under `src/state/`:
  - `Surface`
  - `Types`
  - `UsageSummary`
  - focused state queries/presenters/cache
- Keep the `electron/` vs `renderer/` split.
- Under `electron/`, group main-process code by runtime responsibility:
  - `ipc/`
  - `shell/`
  - `state/`
  - `connections/`
  - `updates/`
- Under `renderer/connections/`, organize by workflow:
  - `add/`
  - `dialogs/`
  - `edit/`
  - `detail/`
  - `list/`
- Under `renderer/settings/`, organize by local settings workflows:
  - `general/`
  - `dialogs/`
- Keep `renderer/quick-setup/` as one small workflow cluster with short local file names:
  - `Page`
  - `Guide`
  - `AgentCard`
  - `DetectedSetup`
- Under `renderer/agents/`, keep shared primitives at the root and group workflow-specific files under:
  - `list/`
  - `detail/`
- Under `renderer/app/`, keep entry files at the root and group settings-surface orchestration under:
  - `settings/`
- Keep `ConnectionFormParts.tsx` and `AuthJsonPath.ts` in `renderer/connections/` because they are shared by more than one connection workflow.

## Target `apps/cli`

```text
src/
  commands/
  presenters/
  connections/
    add/
    manage/
  history/
  usage/
```

The CLI can stay a little flatter than desktop, but new work should prefer user-task clusters over broad command buckets.

## Target `packages/core`

```text
src/
  agents/
  models/
  actions/
  services/
```

This package does not need a disruptive rename right now. The main rule is:

- new code should prefer concrete domain homes over broad cross-cutting helpers
- behaviors that belong to a single model should stay near that model
- infrastructure details should not leak upward into surface-layer naming

## Migration Order

1. Re-group desktop renderer by workflow, one workflow at a time.
2. Re-group desktop Electron support by shell, IPC, updates, and connection command boundaries.
3. Re-group CLI hotspots by user task where the current command container is still too broad.
4. Only revisit `packages/core` directory names if the current shape starts blocking feature ownership.

## Phase 1

The first concrete migration slice is:

```text
apps/desktop/src/renderer/connections/add/
```

That workflow should own:

- add-connection page shell
- add-only view pieces
- add-only state hooks
- add-only DTOs

It should not absorb shared connection files that are also used by edit or app-level orchestration.
