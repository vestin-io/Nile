# Core Module

The core module is the stable kernel. It owns shared state, shared contracts, storage primitives, and cross-domain abstractions.

## Responsibilities

- persist endpoints, accesses, saved connection views, and selections
- persist connection-scoped usage metadata when a feature needs non-sensitive cached state
- keep secrets out of SQLite
- define credential storage backend contracts and secret-boundary rules
- define runtime contracts for connection operations and builtin composition
- define shared agent and connection ids, requirements, and registries
- record mutation history and rollback state

## Current Structure

- `actions/`
  - user-facing product action clusters:
    - `local-setup`
    - `live-setup`
    - `usage`
    - `apply`
- `models/`
  - endpoint, access, connection, and selection storage plus shared rules
- `application/local/`
  - local workflows, state reset, and local credential support
- `runtime-local/`
  - narrow runtime-local primitives used by agent packages and builtins runtime composition
- `services/`
  - database, credential, environment, history, and logging

## Boundaries

- CLI and desktop may call core, but must not own core business rules.
- Agent-specific file and runtime mutation belongs in agent packages.
- Connection-family semantics belong in `packages/connections`.
- Concrete session/runtime composition belongs in `packages/builtins`.
- Core may expose contracts and shared orchestration primitives, but it must not embed UI formatting.
- Core may persist references to credentials, but not raw secrets.
- Usage features may add connection-scoped bindings or snapshots, but they must stay separate from saved connection truth unless the connection itself changes.

## Feature Index

- [Workspace State](./features/workspace-state.md)
- [Agent Runtime](./features/agent-runtime.md)
- [Mutation History](./features/mutation-history.md)
- [Usage](./features/usage.md)
- [Credential Storage Backends](./features/credential-storage-backends.md)
