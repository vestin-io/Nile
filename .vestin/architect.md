# Architecture

Initiative: `nile`

## Summary

Nile is a local-first multi-agent connection switcher with explicit package boundaries.

- Users manage saved `connections`.
- Agents own local runtime state and local config mutation.
- Connection families own connection semantics, endpoint shaping, catalog reads, and mutation rules.
- Builtins owns concrete registration and runtime composition.
- Apps are thin entry surfaces over builtins and stable core contracts.

The system stays local-first:

- saved workspace state lives in SQLite plus a credential store
- live agent state stays device-local
- apply, import, detection, rollback, and local usage stay local

Future cloud work may replace the saved workspace-state backend, but it must not become the authority for one machine's live agent state.

## Dependency Rules

Allowed:

- `agents -> core`
- `connections -> core`
- `builtins -> core`
- `builtins -> agents`
- `builtins -> connections`
- `apps -> builtins`
- `apps -> core` only for stable types, ids, and other pure contracts

Forbidden:

- `core -> agents`
- `core -> connections`
- `agents -> connections`
- `connections -> agents`

If a class knows both:

- an agent-local filesystem/runtime implementation detail
- and connection-family semantics

it does not belong in `core`. It usually belongs in `builtins` composition.

## Top-Level Shape

```text
apps/
  cli/          CLI surface
  desktop/      Electron surface

packages/
  core/         stable contracts, registries, storage, shared primitives
  agents/       agent-local runtime packages
  connections/  connection-family semantics and shared connection-domain logic
  builtins/     builtin registration and concrete runtime composition
  host-local/   local OS/browser/shell integration
```

## Package Responsibilities

### `packages/core`

Own:

- stable ids and shared domain types
- SQLite and credential-store primitives
- registry classes and runtime contracts
- shared services
- cross-domain orchestration contracts
- agent-independent connection and selection storage

Do not own:

- builtin agent registration
- builtin connection family registration
- concrete connection runtime implementations
- agent-local config mutation
- connection-family-specific protocol behavior
- app workflow composition

Examples that belong here:

- `models/access`
- `models/endpoint`
- `models/selection`
- `models/connection/Runtime.ts`
- `services/database`
- `services/credential`

### `packages/agents/*`

Own:

- one agent's manifest and runtime factory
- one agent's current-session source
- one agent's interactive login source
- one agent's projection
- one agent's local file/runtime reads and writes
- one agent's apply/import/rollback flows
- one agent's local usage behavior

Do not own:

- connection identity matching
- connection label fallback semantics
- gateway probing
- endpoint shaping
- connection-family catalog protocol logic
- imports from `@nile/connections`

Examples:

- `packages/agents/codex`
- `packages/agents/cursor`
- `packages/agents/claude`
- `packages/agents/gemini`
- `packages/agents/openclaw`

### `packages/connections`

Own:

- connection family manifests and behaviors
- identity key rules
- access matching rules
- session fallback label rules
- model catalog readers
- onboarding rules
- endpoint shaping
- gateway probing
- create/update/preparation mutation logic
- connection-domain support, labeling, setup, and catalog layers

Structure:

```text
packages/connections/
  src/
    families/
    catalog/
    setup/
    mutations/
    support/
    labeling/
```

Do not own:

- agent-local config file reads
- agent-local usage implementations
- imports from `@nile/agent-*`

### `packages/builtins`

Own:

- builtin agent module registration
- builtin connection family registration
- concrete runtime composition
- app-facing bridges over local/session/connection runtime helpers
- builtin cursor-usage bridge

Builtins is the only package allowed to depend on both:

- agent packages
- connection packages

Builtins must remain composition-only. It must not become a second domain layer.

### `apps/*`

Own:

- user interaction
- presentation
- Electron lifecycle
- renderer state and UI
- CLI prompts and command routing

Apps should depend on:

- `@nile/builtins` for concrete runtime and composition
- `@nile/core` only for stable contracts/types and basic ids

Apps must not compose concrete agent or connection runtime directly.

## Current Runtime Shape

### Builtin Registration

Builtin module registration happens in `@nile/builtins`, not in `@nile/core`.

- Electron main registers builtins before opening the desktop runtime.
- CLI registers builtins before creating the CLI runtime.
- Browser/renderer-safe agent metadata must not rely on node-only agent package imports.

### Session and Runtime Composition

Concrete session runtime composition lives in `@nile/builtins/runtime`.

- `NileSession`
- session resource composition
- session work helpers

`@nile/core` exposes the narrow runtime-local primitives and contracts those classes depend on, but it does not own the composed runtime shell.

### Connection Runtime

`@nile/core` owns connection runtime contracts and registries.

`@nile/connections` provides the concrete implementations for:

- creator
- updater
- model catalog
- gateway probe
- identity resolution

`@nile/builtins` registers those concrete services into the core-owned runtime registry.

## Desktop State Layer

The desktop surface still owns a long-lived main-process state layer:

- `apps/desktop/src/electron/state/`
- `apps/desktop/src/electron/ipc/`
- `apps/desktop/src/electron/shell/`
- `apps/desktop/src/renderer/...`

It owns:

- cached desktop snapshots for menubar and settings
- refresh scheduling and invalidation
- IPC contracts between renderer and main

It does not own:

- connection-family business rules
- agent-local config mutation rules
- saved workspace-state mutation logic

Those remain in core contracts plus builtins-owned composition over agents and connections.
