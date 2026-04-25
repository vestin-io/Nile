# Codex Module

The Codex module implements the Codex agent adapter.

## Responsibilities

- read current Codex live state
- apply a saved connection into Codex local runtime state
- import current Codex state into a saved connection
- record and roll back Nile-owned Codex mutations

## Current Structure

- `current-state/`
- `apply/`
- `import/`
- `rollback/`

Codex is the deepest adapter implementation and is the reference shape for workflow-oriented agent directories.
