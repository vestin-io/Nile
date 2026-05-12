# Onboarding Scan + Import Interfaces

## Goal

Turn the scan/import design into a concrete implementation outline:

- shared core module boundaries
- result shapes
- import request shapes
- first-version surface contracts

This document is intentionally narrower than architecture.

It exists to remove ambiguity before implementation.

## Scope

This draft covers:

- core action structure
- core data shapes
- agent adapter participation
- CLI interaction contract
- desktop interaction contract

This draft does not cover:

- final copywriting
- final visual design
- persistence schema migrations
- update semantics for already-saved local setups beyond first-version constraints

## Core Module Layout

Add a new action-oriented module:

- `packages/core/src/actions/local-setup/`

Suggested first-version files:

- `ScanLocalSetups.ts`
- `ImportDetectedSetups.ts`
- `Result.ts`
- `Selection.ts`
- `index.ts`

Responsibilities:

- `ScanLocalSetups`
  - read local state from supported agents
  - normalize results into a shared scan list
  - classify against saved connections

- `ImportDetectedSetups`
  - accept user-selected scan items
  - revalidate importability
  - import selected items
  - return created vs reused outcomes

- `Result.ts`
  - shared result types only

- `Selection.ts`
  - import request validation and selection helpers

## Why This Belongs In Core

This flow is not surface-specific.

The same classification rules must be shared by:

- CLI onboarding
- CLI later re-scan
- desktop first-run import
- desktop settings re-scan

If scan/classification is duplicated in surfaces, the results will drift quickly.

## Action Boundaries

## `ScanLocalSetups`

Conceptual signature:

```ts
class ScanLocalSetups {
  run(): ScanLocalSetupsResult;
}
```

First version should stay synchronous if it only reuses current local readers.

If future agent readers need async behavior, the action can move to async later.

Output responsibility:

- one row per detected local candidate
- one row per unsupported/unavailable scan target when useful for the surface
- enough metadata for rendering and later import selection

## `ImportDetectedSetups`

Conceptual signature:

```ts
class ImportDetectedSetups {
  run(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult;
}
```

Input responsibility:

- identify which scan items the user selected
- preserve ordering from the scan result when useful

Output responsibility:

- one outcome per selected item
- distinguish created vs reused vs failed

## Scan Result Types

## Batch Result

```ts
type ScanLocalSetupsResult = {
  items: ScanItem[];
  importableCount: number;
};
```

`importableCount` is only a convenience for surfaces.

It avoids every surface recomputing the same count.

## Scan Item

```ts
type ScanItem = {
  scanId: string;
  agentId: "codex" | "claude" | "cursor";
  sourceKind: "current_live_setup";
  title: string;
  subtitle: string;
  state: ScanItemState;
  importable: boolean;
  defaultSelected: boolean;
  matchedConnectionId?: string;
  matchedConnectionLabel?: string;
  issues: string[];
  snapshot: ImportableSnapshot | null;
};
```

## Item State

```ts
type ScanItemState =
  | "new"
  | "already_saved"
  | "invalid"
  | "unsupported"
  | "unavailable";
```

Rules:

- `importable` must be `true` only for rows the user can actually import now
- `defaultSelected` should be `true` only for `new`
- `issues` should always exist, even if empty
- `snapshot` should only be non-null when the item can later be imported from this scan result

## Snapshot Shape

The core needs enough information to import later without surfaces reconstructing agent-specific state.

First-version shape:

```ts
type ImportableSnapshot = {
  agentId: "codex" | "claude" | "cursor";
  binding: {
    family: string;
    authMode: string;
    inferredLabel?: string;
    credential: unknown;
    metadata?: Record<string, string>;
  };
};
```

Important note:

- this is an internal core-only structure
- it must never be logged
- it must never be serialized into docs or SQLite

If the current implementation prefers not to carry raw credential material across layers, the alternative is:

- keep only a `scanId`
- re-read and revalidate live state during import

That is safer, but it means import is always based on a fresh read, not the exact scan snapshot.

## Recommended V1 Choice

For v1, prefer:

- `scanId`
- plus a fresh re-read on import

This keeps secrets from living in longer-lived in-memory result objects than necessary.

That changes the result shape to:

```ts
type ScanItem = {
  scanId: string;
  agentId: "codex" | "claude" | "cursor";
  sourceKind: "current_live_setup";
  title: string;
  subtitle: string;
  state: ScanItemState;
  importable: boolean;
  defaultSelected: boolean;
  matchedConnectionId?: string;
  matchedConnectionLabel?: string;
  issues: string[];
};
```

And import becomes:

- re-read current live state for the selected agent
- re-run matching
- import if still valid

This is the better first version.

## Import Request Types

```ts
type ImportDetectedSetupsInput = {
  selections: ImportSelection[];
};

type ImportSelection = {
  scanId: string;
};
```

Minimal rule:

- surfaces send only selected `scanId`s
- core owns all revalidation

## Import Result Types

```ts
type ImportDetectedSetupsResult = {
  results: ImportDetectedSetupResult[];
};

type ImportDetectedSetupResult = {
  scanId: string;
  status: "created" | "reused" | "skipped" | "failed";
  connectionId?: string;
  connectionLabel?: string;
  message?: string;
};
```

Semantics:

- `created`
  - a new saved connection was created
- `reused`
  - an existing saved connection already matched and was reused
- `skipped`
  - selected item is no longer importable or no longer selected by policy
- `failed`
  - import tried and failed

## Agent Adapter Participation

Current agent adapters already expose import-like behavior, but not scan-list behavior.

First-version participation should be narrow.

Each supported agent should provide enough information to answer:

- is there a readable current local setup?
- is it valid?
- what family/auth mode does it map to?
- what would its title/subtitle be in scan results?

This should not force every agent to implement a second import pipeline.

## Recommended Agent-Core Boundary

Add a small adapter-facing scan contract, conceptually:

```ts
type LocalSetupProbe = {
  agentId: "codex" | "claude" | "cursor";
  status: "available" | "invalid" | "unsupported" | "unavailable";
  title?: string;
  subtitle?: string;
  issues: string[];
};
```

Then let `ScanLocalSetups` translate that into `ScanItem` and use existing shared matching logic.

This avoids pushing UI-oriented scan result types down into agent adapters.

## Matching And Classification

`ScanLocalSetups` should classify each probe in this order:

1. if probe is `unavailable`
   - `state = "unavailable"`
2. if probe is `unsupported`
   - `state = "unsupported"`
3. if probe is `invalid`
   - `state = "invalid"`
4. if probe is `available`
   - normalize into the existing shared connection matching path
   - if exact match exists:
     - `state = "already_saved"`
   - otherwise:
     - `state = "new"`

## CLI Contract

## First-Run

When no saved connections exist, CLI should:

1. run `ScanLocalSetups`
2. show list rows
3. allow multi-select of `importable` rows
4. call `ImportDetectedSetups`
5. show results

CLI does not need a different first-run data shape.

## Re-Scan

Later, CLI should expose the same flow under a normal action like:

- `Scan local setups`

## CLI Row Presentation

Each row should render:

- agent label
- title
- subtitle
- state badge
- optional matched connection label
- optional issue text

## Desktop Contract

## First-Run

When saved connection count is zero:

- desktop main window should prefer a scan/import page
- it should not drop users directly into a management page with empty lists

## Later Reuse

The same page or dialog should remain available from settings.

Recommended place:

- `Connections`
  - action button: `Scan local setups`

## Desktop Row Presentation

Each row should show:

- checkbox
- agent
- title
- subtitle
- state
- matched connection if applicable
- issue text if needed

Primary action:

- `Import selected`

Secondary actions:

- `Refresh scan`
- `Skip for now`

## Session And Resource Handling

This flow touches:

- local agent readers
- shared matching
- connection creation/import

Implementation must keep session handling explicit:

- open one session for scan
- close it before surface interaction ends
- open a fresh session for import

Do not keep a session alive while waiting for user selection.

That rule matters for both CLI and desktop.

## V1 Constraints

To keep first implementation small:

- do not add background watching
- do not auto-import
- do not batch-apply after import
- do not silently update existing saved connections
- do not expose provider/binding internals in surface contracts

## Recommended Implementation Order

1. Add scan-local result types in core
2. Add `ScanLocalSetups`
3. Add `ImportDetectedSetups`
4. Add CLI first-run and re-scan flow
5. Add desktop first-run empty state
6. Add desktop reusable scan/import entry under `Connections`

## Final Recommendation

Keep the first version strict and boring:

- read-only scan
- explicit multi-select
- import only selected rows
- reuse exact matches
- skip update semantics for now

That gives Nile a solid onboarding path without turning onboarding into a one-off special case.

## V1 Decision

The current implementation target excludes `changed`.

First-version state set:

- `new`
- `already_saved`
- `invalid`
- `unsupported`
- `unavailable`
