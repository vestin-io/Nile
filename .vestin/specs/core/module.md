# Core Module

The core module owns shared state, shared actions, and agent-facing orchestration.

## Responsibilities

- persist endpoints, accesses, saved connection views, and selections
- persist connection-scoped usage metadata when a feature needs non-sensitive cached state
- keep secrets out of SQLite
- create and reuse saved connections
- read current agent status
- read current connection usage
- import current local agent state
- apply a saved connection to one agent
- record mutation history and rollback state

## Current Structure

- `actions/`
  - user-facing product action clusters:
    - `local-state`
    - `current-state`
    - `usage`
    - `apply`
- `models/`
  - endpoint, access, connection, and selection storage plus rules
- `application/local/`
  - local workflows, state reset, and local credential support
- `runtime-local/`
  - local session, runtime resource ownership, and adapter registry wiring
- `services/`
  - database, credential, environment, history, and logging

## Boundaries

- CLI and desktop may call core, but must not own core business rules.
- Agent-specific file and runtime mutation belongs in agent adapters.
- Core may orchestrate apply/import flows, but it must not embed UI formatting.
- Core may persist references to credentials, but not raw secrets.
- Usage features may add connection-scoped bindings or snapshots, but they must stay separate from saved connection truth unless the connection itself changes.
