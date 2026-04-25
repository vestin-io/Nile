# Plan

## Current Scope

Nile currently ships a local-first connection switcher with:

- shared core logic in `packages/core`
- a CLI surface in `apps/cli`
- a desktop surface in `apps/desktop`
- adapters for `codex`, `cursor`, and `claude`

## Current Priorities

1. Keep the shared core stable and readable.
2. Keep connection-first UX consistent across CLI and desktop.
3. Keep agent adapters isolated from shared persistence rules.
4. Keep workspace state and live runtime state clearly separated.

## Near-Term Rules

- New behavior should land in the existing action-oriented core structure.
- New agent work should stay inside `packages/core/src/agents/<agent>/`.
- Surface changes should reuse existing session and presenter flows.
- Any future cloud work must replace only the saved workspace-state backend, not local live-state authority.
- Usage should be treated as a shared core capability when added, not a surface-only feature.

## Done

- Local workspace state backed by SQLite plus credential references
- Shared connection creation and reuse rules
- Shared status, use, import, and history flows
- Agent adapters for Codex, Cursor, and Claude
- CLI and desktop surfaces on top of the same core
