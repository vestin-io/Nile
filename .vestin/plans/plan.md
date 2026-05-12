# Plan

## Current Scope

Nile currently ships a local-first connection switcher with:

- shared core logic in `packages/core`
- a CLI surface in `apps/cli`
- a desktop surface in `apps/desktop`
- adapters for `codex`, `cursor`, `claude`, and `openclaw`

## Current Priorities

1. Keep the shared core stable and readable.
2. Keep connection-first UX consistent across CLI and desktop.
3. Keep agent adapters isolated from shared persistence rules.
4. Keep workspace state and live runtime state clearly separated.
5. Keep public surfaces and import paths narrow so structure does not regress.

## Near-Term Rules

- New behavior should land in the existing core action clusters:
  - `actions/local-setup`
  - `actions/live-setup`
  - `actions/usage`
  - `actions/apply`
- New agent work should stay inside `packages/core/src/agents/<agent>/`.
- Surface changes should reuse existing session and presenter flows.
- Desktop changes should preserve the current grouped structure:
  - `electron/ipc`
  - `electron/shell`
  - `electron/state`
  - `electron/connections`
  - workflow-oriented renderer feature directories
- Any future cloud work must replace only the saved workspace-state backend, not local live-state authority.
- Usage should be treated as a shared core capability when added, not a surface-only feature.

## Done

- Local workspace state backed by SQLite plus credential references
- Shared connection creation and reuse rules
- Shared status, use, import, and history flows
- Agent adapters for Codex, Cursor, Claude, and OpenClaw
- CLI and desktop surfaces on top of the same core
- Desktop state layer grouped under explicit Electron and renderer workflow boundaries
