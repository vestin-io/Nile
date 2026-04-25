# Codex Auth Switching Research

Date: 2026-04-24

Repos inspected:

- `research/codex-auth`
- `research/codex-switcher`
- `research/codex-switch`

## Short Answer

These three projects are not using three completely different architectures.

Their shared core pattern is:

1. Persist multiple account snapshots in the tool's own storage.
2. Choose one account.
3. Materialize that account back into Codex's live auth file at `~/.codex/auth.json` or `$CODEX_HOME/auth.json`.

The differences are in how much state they manage around that core:

- `codex-switcher`: simplest implementation, mostly "stored account -> write live auth.json".
- `codex-switch`: profile-oriented wrapper with locking, backup, dedup, and a temporary-launch mode.
- `codex-auth`: the heaviest implementation, with a registry under `CODEX_HOME/accounts/`, snapshot sync, auto-import, and auto-switching logic.

None of the three uses "one account = one isolated CODEX_HOME directory" as the primary switching mechanism.

## 1. `Loongphy/codex-auth`

### Storage model

- Uses the active Codex root resolved from `CODEX_HOME` or `~/.codex`. See `resolveCodexHome` and `activeAuthPath`. File: `research/codex-auth/src/registry.zig`
- Stores managed snapshots under `<codex_home>/accounts/*.auth.json` and metadata in `<codex_home>/accounts/registry.json`. See lines 457-472. File: `research/codex-auth/src/registry.zig`

### Switching model

- The actual active session is still the live `auth.json`.
- `activateAccountByKey` copies a stored snapshot into the live auth path, then updates `active_account_key`. See lines 2010-2022. File: `research/codex-auth/src/registry.zig`
- `replaceActiveAuthWithAccountByKey` does the same replacement without the backup path. See lines 2024-2040. File: `research/codex-auth/src/registry.zig`

### What makes it different

- It continuously syncs the current live `auth.json` back into the managed registry/snapshots. See `syncCurrentAuthBestEffort` and `syncActiveAccountFromAuth`, lines 1606-1788. File: `research/codex-auth/src/registry.zig`
- If the current `auth.json` is unknown, it can auto-import it as a new managed account. Same file, lines 1706-1751.
- It preserves or hardens permissions on managed files and keeps backups inside the accounts area. See lines 475-509. File: `research/codex-auth/src/registry.zig`

### Summary

`codex-auth` is still fundamentally "copy selected snapshot to live auth.json", but wrapped in a full account registry system inside the active Codex home.

## 2. `Lampese/codex-switcher`

### Storage model

- Stores all managed accounts in its own app directory `~/.codex-switcher/accounts.json`. See lines 10-18 and 38-62. File: `research/codex-switcher/src-tauri/src/auth/storage.rs`

### Switching model

- Resolves Codex home from `CODEX_HOME` or `~/.codex`. See lines 11-24. File: `research/codex-switcher/src-tauri/src/auth/switcher.rs`
- `switch_to_account` serializes the chosen account into Codex's live `auth.json` and writes it directly. See lines 27-52. File: `research/codex-switcher/src-tauri/src/auth/switcher.rs`

### What makes it different

- It is the simplest of the three: no per-profile snapshot directories, no auth lock, and no backup-before-switch in the main switching path.
- It does refresh ChatGPT tokens and, if the refreshed account is the active one, writes the refreshed credentials back to live `auth.json`. See lines 43-87. File: `research/codex-switcher/src-tauri/src/auth/token_refresh.rs`
- OAuth login completion immediately adds the account to storage, marks it active, and switches live auth. See lines 47-63. File: `research/codex-switcher/src-tauri/src/commands/oauth.rs`

### Summary

`codex-switcher` is the thinnest implementation: app-owned account store plus direct overwrite of live `auth.json`.

## 3. `xjoker/codex-switch`

### Storage model

- Uses live Codex auth at `~/.codex/auth.json` or `$CODEX_HOME/auth.json`. See lines 20-37. File: `research/codex-switch/src/auth.rs`
- Stores managed profiles under `~/.codex-switch/profiles/<alias>/auth.json` and tracks the current alias in `~/.codex-switch/current`. See lines 39-54. File: `research/codex-switch/src/auth.rs`

### Switching model

- `switch_live_auth` reads the selected profile's `auth.json`, locks switching with `auth.lock`, backs up the existing live auth, writes the selected profile into the live auth path, and updates the current marker. See lines 83-129. File: `research/codex-switch/src/profile.rs`
- `cmd_use` calls that switching path after warning if the current live `auth.json` does not belong to a saved profile. See lines 516-540. File: `research/codex-switch/src/profile.rs`

### What makes it different

- It deduplicates profiles by exact content hash first, then by identity (`account_id` + `email`). See lines 132-247 and 329-376. File: `research/codex-switch/src/profile.rs`
- It auto-detects when the live `auth.json` changed and can save or update the matching stored profile. See lines 329-417 and 422-493. File: `research/codex-switch/src/profile.rs`
- It has a special `launch` mode that temporarily swaps the live auth, starts `codex`, waits a few seconds for Codex to read auth at startup, then restores the original auth file. See lines 795-841. File: `research/codex-switch/src/main.rs`

### Summary

`codex-switch` is also snapshot-copy based, but much more careful than `codex-switcher`: it adds locking, backup, identity matching, and a temporary launch workflow.

## Common Pattern vs Differences

### Common pattern

All three tools ultimately depend on the same assumption:

- Codex reads credentials from the live auth file location.
- Therefore, switching accounts means replacing the live auth material with another account's credential snapshot.

### Differences

- `codex-switcher`: flat account store, direct overwrite.
- `codex-switch`: profile directories, lock file, backup, dedup, temporary launch restore.
- `codex-auth`: account registry embedded under the active Codex home, snapshot sync from live auth, richer metadata and automation.

## What I did not find

- I did not find these repos using per-account `CODEX_HOME` directories as the main switching primitive.
- I did not find them modifying Codex's own `config.toml` to perform auth switching.
- `codex-switch` supports passing model flags through when launching Codex, for example `codex-switch launch alice -- --model gpt-4o`, but that is argument passthrough, not account switching via model config. File: `research/codex-switch/README.md`

## Takeaway For Our Design

If we build a switcher, there are two realistic directions:

1. Follow the community pattern:
   Store many account snapshots and write the selected one into live `auth.json`.
2. Build a stricter isolation model:
   Use one `CODEX_HOME` per account and launch Codex with the chosen root, isolating auth, config, history, cache, and logs together.

The community projects mostly chose option 1 because it works with current Codex behavior and is easy to integrate with existing installs.
Option 2 is cleaner architecturally, but it is a different product shape: more launcher-oriented, less "patch the current install in place".
