# Multi-Client Auth Switching Research

Date: 2026-04-24

## Scope

This note extends the earlier Codex-focused research in `docs/codex-auth-switching-research.md`.

The goal here is narrower and more architectural:

- confirm how adjacent clients actually switch accounts/auth locally
- identify which parts are shared across clients
- identify which parts are client-specific and must live behind adapters
- capture local examples from this machine for Codex, Claude, and Cursor

## Executive summary

The earlier assumption was too Codex-centric.

A future-proof switcher cannot be built around `auth.json` swapping alone.

What actually generalizes is:

- a shared account/credential model
- an explicit activation flow
- one adapter per client/runtime
- one usage source per client/runtime

What does **not** generalize is the concrete activation primitive:

- Codex: live auth file replacement
- Claude: live credentials replacement, with platform-specific credential storage
- Cursor: likely Electron / VS Code state surfaces, SQLite and local storage, not a simple single auth file

So the framework center should be:

- `account`
- `credential`
- `activation`
- `client-adapter`
- `usage-source`

Not:

- `profile`
- `project binding`
- `auth.json`

## 1. Codex ecosystem findings

### 1.1 What the three Codex projects prove

The three researched Codex switchers are:

- `research/codex-switcher`
- `research/codex-auth`
- `research/codex-switch`

Two of them clearly support both ChatGPT-style auth snapshots and API key style auth in the live Codex state:

- `codex-switcher`
- `codex-auth`

`codex-switch` is materially different. It is built around token-bearing `auth.json` structures and is not the right reference for API key and OAuth parity.

### 1.2 Why this matters

For Codex, the switcher problem is still fundamentally:

- save multiple account states
- activate one into the live Codex state
- restart or relaunch the client

That part is mature enough to treat as a known adapter shape.

## 2. Claude ecosystem findings

### 2.1 Community implementations are also live-state switchers

Two representative Claude projects were cloned:

- `research/claude-swap`
- `research/claude-switcher-tray`

They converge on the same broad pattern as Codex:

1. capture the current logged-in Claude account
2. save it as a named backup
3. replace the live Claude credential state with another saved account
4. restart or reopen Claude so the new account takes effect

### 2.2 `claude-swap`

Key implementation signals:

- backup root: `~/.claude-swap-backup/`
- per-account backup dirs: config + credentials backups
- live credential read/write is platform-dependent

Relevant files:

- `research/claude-swap/src/claude_swap/switcher.py`
- `research/claude-swap/src/claude_swap/oauth.py`
- `research/claude-swap/README.md`

Important details:

- on macOS it reads/writes Claude credentials through Keychain-oriented logic
- on Linux/WSL/Windows it reads/writes `~/.claude/.credentials.json`
- switching writes target credentials back into the live location
- usage is a separate concern and can be fetched through OAuth-related APIs

This is a strong signal that the Claude adapter must support:

- file-backed credentials on some platforms
- secure-store backed credentials on others
- live-state replacement as the activation primitive

### 2.3 `claude-switcher-tray`

Key implementation signals:

- saved accounts live under `~/.claude/accounts/*.json`
- live credentials are `~/.claude/.credentials.json`
- active account detection compares stored and live refresh tokens
- the app clears/restarts surrounding app state after switch

Relevant file:

- `research/claude-switcher-tray/csharp/Program.cs`

This is the cleanest evidence that a Claude switcher is not conceptually different from a Codex switcher.
It is still:

- save current session
- write chosen session back to live credentials
- refresh client

But the file paths and storage medium are different.

## 3. Cursor findings

### 3.1 Cursor is not presenting itself like Codex or Claude

We do not yet have a strong small standalone "account switcher" reference for Cursor comparable to the Codex and Claude tools above.

The best architectural reference we found is:

- `research/ccs`

And `ccs` does **not** treat Cursor as "just another auth file to swap".

### 3.2 `ccs` is the most important architecture reference

Relevant files:

- `research/ccs/src/targets/target-adapter.ts`
- `research/ccs/src/types/config.ts`
- `research/ccs/docs/cursor-integration.md`
- `research/ccs/docs/project-overview-pdr.md`

What `ccs` proves:

- multi-client systems need a target adapter layer
- profile/account resolution can be target-agnostic
- the last-mile activation/runtime behavior is target-specific

The `TargetAdapter` contract in `ccs` is the clearest pattern worth borrowing:

- detect binary
- prepare credentials
- build args
- build env
- exec

This is the main reason the current architecture should evolve from "Codex-only switcher" into "multi-client-ready core with Codex-first implementation".

### 3.3 Cursor integration in `ccs` is bridge-oriented

The `ccs` Cursor docs show a legacy path where Cursor credentials are imported and used to back a local daemon / bridge rather than directly switching the Cursor app itself.

That matters because it implies there may be more than one viable Cursor adapter shape:

- native app-state switch
- credential import + bridge/proxy

So Cursor should be modeled as an adapter family, not assumed to be one fixed auth-file swap.

## 4. Local machine examples

These are **structural examples only** from this machine.
This section intentionally avoids recording any credential values.

### 4.1 Codex local state

Observed paths:

- `~/.codex/auth.json`
- `~/.codex/config.toml`
- `~/.codex/history.jsonl`
- `~/.codex/sessions/`
- `~/.codex/archived_sessions/rollout-*.jsonl`

What this tells us:

- Codex has a clear live auth surface
- Codex also has local session artifacts that can be scanned for best-effort usage
- Codex remains the simplest MVP target

### 4.2 Claude local state

Observed paths under the CLI/user config area:

- `~/.claude/settings.json`
- `~/.claude/history.jsonl`
- `~/.claude/projects/`
- `~/.claude/sessions/`

Observed paths under the macOS desktop app area:

- `~/Library/Application Support/Claude/config.json`
- `~/Library/Application Support/Claude/claude_desktop_config.json`
- `~/Library/Application Support/Claude/Preferences`
- `~/Library/Application Support/Claude/Local Storage/`
- `~/Library/Application Support/Claude/IndexedDB/`

Important local observation:

- on this machine, `~/.claude/.credentials.json` is **not** present right now

Interpretation:

- we cannot assume one universal Claude live credential file on every machine/state
- the Claude adapter must tolerate multiple storage surfaces
- desktop and CLI state may overlap, but they should not be treated as identical without direct validation

### 4.3 Cursor local state

Observed paths:

- `~/Library/Application Support/Cursor/User/settings.json`
- `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- `~/Library/Application Support/Cursor/User/globalStorage/storage.json`
- `~/Library/Application Support/Cursor/Preferences`
- `~/Library/Application Support/Cursor/Local Storage/leveldb/`
- `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb`

Structural observation:

- `Cursor/User/globalStorage/state.vscdb` is a SQLite database
- it contains at least `ItemTable` and `cursorDiskKV`
- `ItemTable` has the shape `key TEXT, value BLOB`

Interpretation:

- Cursor looks like a VS Code / Electron state surface, not a simple single auth JSON
- a Cursor adapter will likely need either:
  - targeted SQLite/LevelDB/app-state mutation, or
  - a higher-level bridge/proxy integration approach

## 5. Architecture implications

### 5.1 What should be shared

Shared across all future clients:

- `credential store`
- `account registry`
- `active selection model`
- `usage summary model`
- `surface contracts` for CLI and desktop

### 5.2 What must be adapter-specific

Per-client:

- where live auth state lives
- whether credentials are file-backed or secure-store-backed
- whether the client must be restarted after activation
- how usage is read
- whether "native switching" or "bridge/proxy switching" is the right shape

### 5.3 Recommended phase structure

Phase 1:

- shared multi-client-ready core
- `codex` adapter
- `codex` session-derived usage source
- CLI
- desktop / menubar surface

Phase 2:

- `claude` adapter
- `claude` usage source
- model presets
- grouped profile bundles

Phase 3:

- `cursor` native adapter or bridge adapter
- richer analytics
- optional policy / auto-switch layers

## 6. Decision update

The current MVP should still stay Codex-first.

But the architecture should no longer be phrased as:

- "Codex account switcher"

It should be phrased as:

- "multi-client auth switcher core with a Codex-first adapter"

That change is justified by the research in:

- `research/claude-swap`
- `research/claude-switcher-tray`
- `research/ccs`

## 7. Recommended next step

Update `.vestin` so that:

- the **implementation scope** stays Codex-first
- the **architecture scope** becomes multi-client-ready

Concrete move:

- keep `Codex` as the only fully implemented adapter in MVP
- introduce an adapter contract into the architecture docs now
- explicitly classify adapters into:
  - `live-state swap`
  - `isolated-root`
  - `bridge/proxy`
