# Onboarding Scan + Import Design

## Goal

Design a reusable local-state discovery and import flow for new and existing users.

This is not a one-time wizard.

It is a repeatable shared-core capability that:

1. scans supported local agent setups
2. classifies what was found
3. lets the user select what to import
4. imports the selected items into saved connections

Onboarding is only the first place this flow appears.

## Why This Should Not Be First-Run Only

Local agent state changes over time:

- a user signs into Claude later
- a user adds a second Codex session later
- a user removes saved connections and wants to re-import
- Nile adds support for another agent later

If this flow only exists at first launch, it immediately becomes the wrong model.

The correct product model is:

- `Scan local setups`
- `Import detected connections`

This should be available:

- during first-run onboarding
- later from normal CLI flow
- later from desktop settings

## Product Rules

- Scanning must not mutate any saved state.
- Importing must stay explicit.
- Users must be able to import some detected setups and skip others.
- Already-saved setups must not be duplicated.
- The same scan/import flow must work for first-run and later re-scan.
- Shared core owns detection, classification, matching, and import decisions.
- CLI and desktop only own interaction and presentation.

## User-Facing Shape

The flow should always look like:

1. scan local setups
2. show detected items in a list
3. mark each item with a status
4. let the user check the ones to import
5. import the checked items
6. show created vs reused results

## Status Model

Each detected item should be classified into one of these states:

- `new`
  - Nile can read a valid local setup and there is no matching saved connection yet.
- `already_saved`
  - Nile found a valid local setup that already matches an existing saved connection.
- `invalid`
  - Nile found agent-local state, but it is incomplete or malformed and cannot be imported.
- `unsupported`
  - Nile recognized the source shape, but this setup type is not importable yet.
- `unavailable`
  - Nile could not find a readable local setup for that scan target.

Only `new` should be selected by default.

`already_saved`, `invalid`, `unsupported`, and `unavailable` should not be selectable.

## Core Result Model

The shared core should return a batch result, not one agent at a time.

Conceptually:

```ts
type ScanLocalSetupsResult = {
  items: DetectedLocalSetup[];
};

type DetectedLocalSetup = {
  scanId: string;
  agentId: "codex" | "cursor" | "claude";
  title: string;
  subtitle: string;
  state: "new" | "already_saved" | "invalid" | "unsupported" | "unavailable";
  importable: boolean;
  matchedConnectionId?: string;
  matchedConnectionLabel?: string;
  issues?: string[];
};
```

Important constraints:

- `scanId` is for one scan result row, not a persistent ID.
- The scan result must be stable enough for a user to select items from one run.
- The surface should not have to reconstruct matching state by itself.

## Matching Rules

Matching should continue to use the existing shared-core connection matching rules, not a second surface-only heuristic.

That means:

- provider family matching stays in core
- binding dedupe logic stays in core
- existing state matcher logic stays in core

The scan layer should ask:

- can this local setup be normalized?
- does it match an existing saved connection?
- if not, is it importable as a new saved connection?

## Reuse Of Existing Core Pieces

This flow should reuse current agent-specific detection work where possible.

Existing reusable pieces already exist:

- agent-specific current-state readers
- agent-specific current-state detectors
- shared connection state matcher
- shared connection creation/import logic

But current import is still one-agent, one-action:

- `import current Codex`
- `import current Claude`

The new flow should sit above that and orchestrate a batch view.

## Proposed Core Structure

Add one new action-oriented capability in core:

- `actions/local-setup/`

Suggested responsibilities:

### `ScanLocalSetups`

- enumerate supported scan targets
- ask each agent adapter for its detectable local setup
- normalize each result into a `DetectedLocalSetup`
- classify against existing saved connections

### `ImportDetectedSetups`

- accept a scan result plus selected `scanId`s
- validate that each selected item is still importable
- import each selected item through existing shared import rules
- return created vs reused outcomes

This keeps the flow as:

- scan is read-only
- import is explicit and separate

## Surface Behavior

## CLI

CLI should support both onboarding and normal reuse.

### First-Run

If there are no saved connections yet:

1. run scan
2. show detected items
3. let the user multi-select importable entries
4. import the selection

### Later Reuse

Add a normal action like:

- `Scan local setups`

This should run the same flow again.

The CLI should not have a separate first-run-only implementation.

### CLI Empty Cases

If no importable setups are found:

- explain that no local setups were found
- point the user to:
  - sign into a supported agent and rescan
  - or add a connection manually

## Desktop

Desktop should use the same core flow.

### First-Run

When there are no saved connections yet, the main window should prefer a first-run empty state instead of a normal management screen.

That empty state should:

- show detected local setups
- show status for each
- let the user check importable rows
- let the user import selected rows in one action

### Later Reuse

The same scan/import list should remain available from settings, likely under `Connections`.

The user should be able to run it again later without any onboarding framing.

### Menubar

The menubar should stay minimal.

It may link to:

- `Open Main Window`

The actual scan/import flow should live in the main window, not inside the tray submenu.

## Import Semantics

The first version should treat this as:

- import new saved connections
- reuse existing saved connections when already matched

The first version should avoid trying to update existing saved connections in place unless that behavior is clearly defined.

That means:

- `new` imports create saved connections
- `already_saved` stays informational

This keeps first behavior simple and safe.

## Recommended V1 Scope

Support repeatable scan/import for:

- Codex
- Claude

Cursor can still participate in scanning if useful, but if import rules are not stable enough yet it can report:

- `unsupported`
- or `unavailable`

The first version should prioritize:

1. valid scan results
2. strong matching
3. explicit multi-select import
4. no duplicate saved connections

## Risks

### 1. Duplicate Or Near-Duplicate Imports

If matching is too weak, users will import the same logical setup repeatedly.

Mitigation:

- rely on shared core matching
- make `already_saved` obvious

### 2. Scan Results Becoming Stale

A user can scan, then change local state before import.

Mitigation:

- revalidate each selected item at import time
- fail only the stale item, not the whole batch

### 3. Overloading Onboarding With Too Much Explanation

If this becomes a tutorial, it will slow down the first useful action.

Mitigation:

- keep the flow list-first
- show statuses and recommended defaults
- avoid long educational copy

### 4. Mixing Scan And Import In One Step

If scan mutates state, the user loses control and retry behavior becomes messy.

Mitigation:

- keep scan read-only
- keep import explicit

## Final Recommendation

Treat this as a reusable core capability:

- `scan local setups`
- `classify`
- `select`
- `import selected`

Do not treat it as a first-run-only onboarding wizard.

Onboarding should simply be the first time Nile chooses to launch this reusable flow.

## V1 Decision

For the current first implementation:

- do not implement `changed`
- keep only:
  - `new`
  - `already_saved`
  - `invalid`
  - `unsupported`
  - `unavailable`
