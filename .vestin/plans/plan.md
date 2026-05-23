# Plan

## Current Scope

Nile currently ships a local-first connection switcher with:

- a stable kernel in `packages/core`
- agent-local packages in `packages/agents/*`
- a shared connection-domain package in `packages/connections`
- builtin composition in `packages/builtins`
- a CLI surface in `apps/cli`
- a desktop surface in `apps/desktop`
- local host integration in `packages/host-local`

## Current Priorities

1. Keep the shared core stable and readable.
2. Keep connection-first UX consistent across CLI and desktop.
3. Keep agent packages isolated from connection-family semantics.
4. Keep workspace state and live runtime state clearly separated.
5. Keep concrete runtime composition in `packages/builtins`, not `packages/core`.
6. Keep public surfaces and import paths narrow so structure does not regress.

## Near-Term Rules

- New behavior should land in the existing core action clusters:
  - `actions/local-setup`
  - `actions/live-setup`
  - `actions/usage`
  - `actions/apply`
- New agent work should stay inside `packages/agents/<agent>/`.
- New connection-family work should stay inside `packages/connections/src/families/<family>/`.
- New app-facing concrete runtime bridges should land in `packages/builtins`.
- Surface changes should reuse existing session and presenter flows.
- Desktop changes should preserve the current grouped structure:
  - `electron/ipc`
  - `electron/shell`
  - `electron/state`
  - `electron/connections`
  - workflow-oriented renderer feature directories
- Package graph must stay clean:
  - `agents -> core`
  - `connections -> core`
  - `builtins -> core + agents + connections`
  - `apps -> builtins`
- Any future cloud work must replace only the saved workspace-state backend, not local live-state authority.
- Usage should be treated as a shared core capability when added, not a surface-only feature.

## Active Planning Tracks

- Credential storage backends:
  - `.vestin/plans/credential-storage-backends/plan.md`
- Gemini CLI session integration:
  - `.vestin/plans/gemini-cli-session/build.md`
  - `.vestin/plans/gemini-cli-session/extension-observations.md`
- Gemini connection and usage gaps:
  - `.vestin/plans/gemini-connection-and-usage.md`
- Agent/registry migration:
  - `.vestin/plans/agent-registry-migration.md`
- Connection family package migration:
  - `.vestin/plans/connection-family-package-migration.md`
  - `.vestin/plans/connection-family-package-migration-build.md`

## Done

- Local workspace state backed by SQLite plus credential references
- Shared connection creation and reuse rules
- Shared status, use, import, and history flows
- Agent packages for Codex, Cursor, Claude, Gemini, and OpenClaw
- Connection-family package structure under `packages/connections`
- Builtin registration and runtime composition under `packages/builtins`
- CLI and desktop surfaces on top of builtins plus core contracts
- Desktop state layer grouped under explicit Electron and renderer workflow boundaries
