# Usage V1 Build Log

## 2026-04-29

### Step 1: Core Usage Action

- Added `packages/core/src/actions/usage/` with a shared `Usage` action and normalized result types.
- Implemented the first provider-backed reader for `openai/openai_session` connections via ChatGPT `wham/usage`.
- Kept unsupported provider families explicit instead of faking empty usage.

### Step 2: CLI Usage Command

- Added `nile usage <connectionId>` as an explicit on-demand lookup.
- Kept CLI usage query single-shot only. No polling or background refresh.
- Added presenter formatting for plan and quota windows.

### Step 3: Claude Session Usage

- Added `claude_session` as a first-class stored credential and auth mode in core.
- Wired Claude current-state reading to live `~/.claude/.credentials.json` plus `settings.json.oauthAccount`.
- Implemented Anthropic OAuth usage lookup via `GET https://api.anthropic.com/api/oauth/usage`.
- Kept the usage result normalized into the same connection-scoped window contract as Codex.
- Did not add local transcript-derived Claude analytics in this step.

## 2026-05-04

### Core Hardening

- Switched keychain writes away from argv-based `security ... -w <secret>` usage to prompted secret input with encoded single-line payloads.
- Kept backward compatibility for existing unencoded keychain rows and secure history snapshots.
- Added mutation-history snapshot cleanup on failed inserts so partially written secure/file snapshots do not linger orphaned.
- Hardened apply and rollback failure paths so `markFailed(...)` errors no longer mask the original failure.
- Reworked saved-connection and status list paths to preload endpoint/access data instead of doing repeated per-row registry lookups.

## 2026-05-21

### Surface Terminology Alignment

- Updated user-visible CLI quota output so connection summaries, detailed reads, and Cursor follow-up messages now say `quota` instead of `usage`.
- Updated surfaced provider and Cursor fallback/error messages that are shown directly to operators so they consistently refer to quota requests, quota responses, and live quota availability.
- Updated desktop English copy for quota alerts and profile settings labels to remove the remaining visible `usage` wording.

#### Key findings

- Command names, module names, and internal type/file names still use `usage`; this change was intentionally limited to user-visible text so it would not broaden into a CLI/API rename.
- Non-English desktop translations were already using quota-oriented wording for the affected surfaces, so only the remaining English strings needed edits in this pass.

## 2026-05-29

### Cursor quota binding backend fix

- Fixed Cursor quota binding storage so `usage:cursor:*` credentials now persist the saved connection's `credentialStorageBackend` instead of silently defaulting to system secure storage.
- Added an explicit `credential_storage_backend` column to `cursor_usage_bindings` and threaded that metadata through:
  - `packages/agents/cursor/src/usage/Types.ts`
  - `packages/agents/cursor/src/usage/BindingStore.ts`
  - `packages/agents/cursor/src/usage/BindingRegistry.ts`
  - `packages/agents/cursor/src/usage/Binder.ts`
- Added regression coverage for:
  - encrypted-local Cursor quota binding writes
  - persisted backend round-trip across binding registry reopen
  - existing binding migration when the saved connection backend changes
  - persisted unsupported backend rows failing closed instead of silently falling back
- Verified the fix end to end against the local workspace state:
  - `jay-ji-spotto-ai-2` now auto-binds successfully
  - `cursor_usage_bindings.credential_storage_backend` now stores `encrypted_local_storage`
  - a live Cursor quota read now returns `available` again for that saved connection

#### Key findings

- Existing legacy binding rows without `credential_storage_backend` are intentionally left untouched. They continue to resolve through the old implicit system-store path instead of attempting an automatic credential-store migration.
- Existing non-legacy bindings now migrate between credential stores on rebind when the saved connection backend changes, so quota bindings no longer get pinned to the old store.
- Persisted rows with an unrecognized `credential_storage_backend` now fail closed during read instead of silently defaulting to system secure storage.
- The bug was not in Cursor's quota API or local session detection. It was a backend-routing gap specific to quota binding credentials, so the fix stays local to the Cursor usage binding path instead of broadening credential-store behavior globally.
