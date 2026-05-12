# Architecture

Initiative: `nile`

## Summary

Nile is a local-first multi-agent connection switcher.

- Users manage saved `connections`.
- Nile reads and writes each agent's local runtime state explicitly.
- Shared core logic owns saved workspace state, matching, import, apply, and rollback orchestration.
- CLI and desktop are thin surfaces over the same core.

The current codebase is intentionally local-first:

- saved workspace state lives in SQLite plus a credential store
- live agent state stays device-local
- apply, import, detection, and rollback stay local

Future cloud work may replace the saved workspace-state backend, but it must not become the authority for one machine's live agent state.

## Top-Level Shape

```text
apps/
  cli/        command surface
  desktop/    Electron surface

packages/core/
  actions/        product action clusters
  agents/         agent-specific adapters
  application/    local workflows and local-only support
  models/         persistent domain model
  projection/     agent-facing status projection strategies
  runtime-local/  local session and adapter wiring
  services/       database, credential, history, logging, environment
```

## Architecture Boundaries

### Surfaces

Own:

- argument parsing and interactive flow
- renderer and Electron UI flow
- presenter-driven output
- desktop main-process state caching, invalidation, and refresh scheduling

Do not own:

- persistence rules
- connection matching rules
- agent config mutation rules

### Shared Core

Own:

- connection creation and reuse rules
- saved-state reads and writes
- agent status reads
- import and apply orchestration
- mutation history and rollback orchestration

The main product actions are grouped under `packages/core/src/actions/` and the runtime-local session layer:

- `local-setup`
- `live-setup`
- `usage`
- `apply`
- `runtime-local/NileSession` methods for create, import, remove, and rollback

Usage remains connection-scoped shared core logic.
For provider-backed usage with direct local or OAuth credentials, usage readers may call the upstream API directly.
For Cursor personal usage, shared core must treat web usage as a separate bound capability beside the saved connection, not as part of the base Cursor access definition.

### Workspace State

Own:

- endpoints
- accesses
- agent selection records

Rules:

- secrets do not go into SQLite
- accesses store credential references, not raw secrets
- saved workspace state is distinct from current live agent state

### Local Runtime

Own:

- agent-specific live-state detection
- explicit apply into local agent config/runtime files
- import of current local agent state
- rollback of Nile-owned local mutations

### Desktop State Layer

The desktop surface needs one additional layer that the CLI does not:

- a long-lived main-process state store for tray and settings rendering

This layer belongs in `apps/desktop`, not `packages/core`.

Current implementation shape:

- `apps/desktop/src/state/`
  - desktop read surface and query helpers
- `apps/desktop/src/electron/ipc/`
  - explicit preload-to-main contracts
- `apps/desktop/src/electron/shell/`
  - Electron lifecycle, tray, menu, and window orchestration
- `apps/desktop/src/electron/connections/`
  - desktop-owned connection command orchestration
- `apps/desktop/src/electron/state/`
  - long-lived main-process cache, invalidation, and refresh policy
- `apps/desktop/src/renderer/...`
  - workflow-oriented UI by feature

It owns:

- cached desktop snapshots for menubar and settings
- dirty tracking by state slice
- refresh scheduling and in-flight deduplication
- push notifications from main process to renderers

It must not own:

- endpoint compatibility rules
- usage retrieval rules
- live-state detection rules
- apply/import/remove/rollback business logic

Those rules stay in shared core and are called by the desktop state layer as source operations.

### Agent Adapters

Own:

- one agent's current-state reading
- one agent's apply behavior
- one agent's import behavior
- optional rollback support

Current adapters:

- `codex`
- `cursor`
- `claude`
- `openclaw`

## Current Core Model

### Endpoint

Represents one backend definition:

- root URL
- endpoint profile
- exposed protocol capabilities

### Access

Represents one credential-backed way to access an endpoint.

It owns:

- auth mode
- identity key
- enabled agent set
- credential reference

### Connection

`Connection` remains the product term exposed by CLI and desktop.

In core storage and orchestration, a user-facing connection maps to one `Access` plus its `Endpoint`.

### Selection

Represents the last Nile-applied saved access per agent.

### Mutation History

Represents Nile-originated local mutations and rollback snapshots.

## Current Control Flow

### Create Connection

1. Surface gathers a connection definition plus credential input.
2. Core ensures or reuses the right endpoint.
3. Core ensures or reuses the right access.
4. Core returns the saved connection summary for that endpoint plus access pair.

### Read Status

1. Surface asks core for agent status.
2. Core loads saved selection and asks the adapter to detect live state.
3. Core returns a read model describing current connection, drift, and import state.

### Read Usage

1. Surface asks core for connection usage.
2. Core resolves the saved connection.
3. Core dispatches to a connection-specific usage reader.
4. The usage reader may:
   - call an upstream API directly
   - read local artifacts
   - read a cached snapshot
   - degrade to unavailable without affecting connection validity
5. Core returns a normalized usage read model.

### Use Connection

1. Surface requests an explicit switch for one agent.
2. Core resolves the saved connection.
3. The target adapter writes the local runtime/config state.
4. Core records the applied selection and mutation history.

### Import Current Connection

1. Surface requests import for one agent.
2. Adapter reads live state.
3. Core matches it to an existing saved connection or creates a new one.
4. Core returns the imported or matched saved connection.

### Rollback

1. Surface requests rollback for one agent.
2. Adapter restores the latest Nile-owned local mutation snapshot.
3. Core updates rollback history state.

## Current Composition Root

`NileSession` is the local request-lifetime composition root.

It owns:

- one SQLite handle
- one credential store reference
- one local workspace-state composition
- one agent adapter registry

It should stay a local implementation detail, not a shared abstraction for future cloud and local backends.

For desktop, `NileSession` remains request-lifetime and stateless between calls.
Any long-lived caching or freshness policy should sit above it in the desktop main process.

## Cursor Usage Extension

Cursor personal usage adds one extra architecture rule:

- local Cursor login and Cursor web usage auth are separate concerns

The Cursor adapter remains responsible only for:

- local state detection
- apply
- import

Shared core usage support must own:

- web-session binding metadata
- bound web-session credentials
- connection-scoped usage snapshots
- identity matching between the saved Cursor connection and the web session

This keeps Cursor usage aligned with the `endpoint + access` model:

- `Access` remains the connection/auth truth
- usage binding remains optional and revocable
- cached snapshots survive connection switching

## Open-Source Guardrails

- Keep product language connection-first.
- Keep UI concerns out of `packages/core`.
- Keep Electron specifics out of shared core.
- Keep secrets out of SQLite, docs, logs, and fixtures.
- Keep apply explicit. Nile must not switch agents implicitly.
- Keep usage read-only. Usage failures must not mutate the selected agent connection except for clearing an invalid usage binding.
