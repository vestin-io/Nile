# Gemini CLI Session Build Log

## 2026-05-14

### Spec and local state store foundation

- added a Gemini module spec under `.vestin/specs/gemini/`
- recorded the Gemini adapter feature as `in_progress` in `.vestin/state/features.json`
- started implementation with Gemini-owned local state stores for:
  - `oauth_creds.json`
  - `google_accounts.json`
  - `settings.json`
- intentionally kept Gemini out of global runtime registration for this slice
- deferred the Gemini keychain-backed OAuth backend to the next implementation slice

### Verification

- `./node_modules/.bin/vitest run packages/core/src/agents/gemini/CredentialStore.test.ts packages/core/src/agents/gemini/AccountsStore.test.ts packages/core/src/agents/gemini/SettingsStore.test.ts`
- `npm run typecheck`

### Session backend and reader slice

- added a Gemini credential document codec so file-backed and keychain-backed OAuth state share one parse/serialize path
- added a Gemini keychain-backed OAuth store for the official:
  - service `gemini-cli-oauth`
  - account `main-account`
- added a Gemini credential backend that:
  - prefers keychain-backed credentials
  - falls back to `oauth_creds.json`
  - treats malformed keychain state as authoritative invalid state instead of silently falling back
- added a Gemini session identity reader for:
  - `email`
  - `sub`
  - display label
- added a Gemini session reader that validates:
  - `settings.json` auth mode
  - current credential backend state
  - `google_accounts.json.active`
  - `id_token` identity claims
- recorded Gemini-specific extension friction in:
  - `.vestin/plans/gemini-cli-session/extension-observations.md`
- intentionally kept global agent registration, shared auth-mode wiring, and apply/rollback integration for the next slice

### Verification

- `./node_modules/.bin/vitest run packages/core/src/agents/gemini/CredentialStore.test.ts packages/core/src/agents/gemini/AccountsStore.test.ts packages/core/src/agents/gemini/SettingsStore.test.ts packages/core/src/agents/gemini/KeychainStore.test.ts packages/core/src/agents/gemini/Backend.test.ts packages/core/src/agents/gemini/Reader.test.ts`
- `npm run typecheck`

### Shared auth mode and live-setup staging slice

- added a dedicated shared credential kind:
  - `gemini_cli_session`
- added a shared auth mode:
  - `gemini_cli_session`
- added a shared endpoint profile/protocol/family for Gemini CLI session-backed connections
- updated shared connection plumbing for Gemini:
  - credential validation
  - connection support kind resolution
  - identity-key resolution
  - connection label suggestion
  - connection upsert matching
- added a Gemini live-setup reader that converts current Gemini local state into a shared import-candidate shape:
  - endpoint: `gemini`
  - profile: `gemini-cli`
  - auth mode: `gemini_cli_session`
- kept Gemini out of the global agent/runtime registry for now
- explicitly guarded desktop add/update flows so `gemini_cli_session` is recognized but not silently routed through the existing add-connection form

### Notes

- split Gemini local session shape from the shared stored credential shape
  - local file/keychain state does not carry `kind`
  - shared saved credentials do
- this prevented the Gemini file stores from pretending they already were global stored credentials

### Verification

- `./node_modules/.bin/vitest run packages/core/src/agents/gemini/CredentialStore.test.ts packages/core/src/agents/gemini/AccountsStore.test.ts packages/core/src/agents/gemini/SettingsStore.test.ts packages/core/src/agents/gemini/KeychainStore.test.ts packages/core/src/agents/gemini/Backend.test.ts packages/core/src/agents/gemini/Reader.test.ts packages/core/src/agents/gemini/live-setup/Reader.test.ts`
- `npm run typecheck`

### Detect/import/apply/rollback runtime slice

- added Gemini runtime classes for:
  - live detection
  - import current connection
  - apply selection
  - rollback latest mutation
- added `gemini` projection support and runtime adapter registration
- registered `gemini` in shared agent definitions, capabilities, and default home resolution
- added desktop agent icon wiring for Gemini
- updated desktop/state test fixtures to isolate `gemini` home explicitly instead of falling back to the real `~/.gemini`

### Notes

- Gemini exposed a new extension trap in desktop tests:
  - many fixtures assumed a fixed four-agent set
  - once `gemini` joined `SUPPORTED_AGENT_IDS`, tests started reading personal machine state
- this is now recorded in `.vestin/plans/gemini-cli-session/extension-observations.md`

### Verification

- `./node_modules/.bin/vitest run packages/core/src/agents/gemini/Backend.test.ts packages/core/src/agents/gemini/live-setup/Detector.test.ts packages/core/src/agents/gemini/ImportCurrentConnection.test.ts packages/core/src/agents/gemini/ApplySelection.test.ts packages/core/src/agents/gemini/RollbackLatestMutation.test.ts packages/core/src/projection/Resolver.test.ts packages/core/src/models/agent/Capabilities.test.ts`

### CLI and desktop integration hardening slice

- updated desktop/state and CLI fixtures to override Gemini home explicitly
- added a minimal CLI regression for:
  - `nile gemini import`
- hardened Gemini keychain fallback behavior so the hybrid backend treats both:
  - command-result "unavailable" failures
  - synchronous helper-resolution throws
  as file-fallback conditions
- confirmed Gemini import now works through:
  - core runtime
  - desktop/state fixtures
  - CLI command flow

### Verification

- `./node_modules/.bin/vitest run apps/cli/src/NileCli.test.ts apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/profiles/Manager.test.ts packages/core/src/agents/gemini/Backend.test.ts packages/core/src/agents/gemini/ImportCurrentConnection.test.ts packages/core/src/agents/gemini/ApplySelection.test.ts packages/core/src/agents/gemini/RollbackLatestMutation.test.ts`

### Extension-hardening slice

- updated desktop preferences so the default agent order is derived from `SUPPORTED_AGENT_IDS` instead of a fixed four-agent list
- preserved stored user order while appending newly supported agents at the end
- replaced the CLI `--agents` parser's fixed `codex/claude/cursor/openclaw` allowlist with `isAgentId(...)`
- taught local credential request build/resolve code about:
  - `gemini_cli_session`
  - `current_gemini`
- kept this support below the generic add-connection surface for now
  - Gemini session creation still enters through Gemini import/apply flows
  - but the local credential plumbing no longer needs another agent-specific special case the next time we expose it
- added desktop i18n/auth labels for:
  - `gemini_cli_session`

### Verification

- `./node_modules/.bin/vitest run packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/application/local/LocalCredentialRequestBuilder.test.ts apps/desktop/src/renderer/settings/Preferences.test.ts apps/cli/src/NileCli.test.ts apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/profiles/Manager.test.ts packages/core/src/agents/gemini/Backend.test.ts packages/core/src/agents/gemini/ImportCurrentConnection.test.ts packages/core/src/agents/gemini/ApplySelection.test.ts packages/core/src/agents/gemini/RollbackLatestMutation.test.ts`
- `npm run typecheck`

### Desktop surface staging slice

- hid the generic `Add connection` action in the agent detail connections tab when an agent has no matching add-connection definition
- threaded the current detected setup into the agent detail page so Gemini can offer an explicit `Import current setup` action instead of routing users into the generic add-connection flow
- kept the import action visible even when the agent already has saved connections, so a new Gemini live session remains reachable from the detail page

### Notes

- Gemini exposed another desktop assumption:
  - the connections tab previously assumed every supported agent should expose the generic add-connection surface
  - this was true for preset-backed providers, but not for a session agent that currently enters through import/apply
- the safe shape for now is:
  - hide generic add when `canConfigureAgent(...)` is false
  - surface import explicitly from detected setup instead

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/profiles/Manager.test.ts apps/cli/src/NileCli.test.ts packages/core/src/agents/gemini/Backend.test.ts packages/core/src/agents/gemini/ImportCurrentConnection.test.ts packages/core/src/agents/gemini/ApplySelection.test.ts packages/core/src/agents/gemini/RollbackLatestMutation.test.ts`
- `npm run typecheck`

### Extension-consolidation slice

- moved the shared `LocalCredentialRequest` types out of `LocalCredentialResolver` so builder/inputs/index exports no longer depend on the resolver file just to name the request shape
- added a shared `CurrentSessionResolver` for:
  - `current_codex`
  - `current_claude`
  - `current_cursor`
  - `current_gemini`
- added a shared `PreferredCredentialBackend` so Gemini no longer owns the generic "preferred backend with fallback backend" read/snapshot/restore pattern by itself
- made agent connection entry mode explicit in capabilities:
  - `configure`
  - `import`
  - `configure_or_import`
- exposed a browser-safe capabilities subpath so renderer-safe code can consume agent entry metadata without reaching through an unexported core module

### Notes

- this slice did not add new Gemini behavior
- it reduced three pieces of extension friction that Gemini had exposed:
  - current session request/resolution scattered across builder + resolver
  - hybrid session backend logic living entirely inside one agent
  - desktop assuming every agent starts from generic add-connection

### Verification

- `./node_modules/.bin/vitest run packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/application/local/LocalCredentialRequestBuilder.test.ts packages/core/src/models/agent/Capabilities.test.ts apps/desktop/src/renderer/CoreImportBoundaries.test.ts apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/profiles/Manager.test.ts apps/cli/src/NileCli.test.ts packages/core/src/agents/gemini/Backend.test.ts packages/core/src/agents/gemini/ImportCurrentConnection.test.ts packages/core/src/agents/gemini/ApplySelection.test.ts packages/core/src/agents/gemini/RollbackLatestMutation.test.ts`
- `npm run typecheck`

### Gemini usage reader slice

- added `GeminiSessionUsageReader` in the shared usage pipeline
- Gemini usage now follows the same remote-API flow shape as OpenAI / Claude:
  - discover `cloudaicompanionProject` via `loadCodeAssist`
  - fetch quota buckets via `retrieveUserQuota`
  - normalize them into shared `ConnectionUsageWindow` entries
- deduped tier-alias buckets so Gemini no longer shows repeated preview/stable aliases for the same quota
- wired `gemini_cli_session` into builtin connection usage reader registration
- added usage tests covering:
  - successful Gemini quota normalization
  - missing project metadata fallback
  - desktop/state usage surface regression

### Key findings

- Gemini quota is available from a usable source, but it is still based on Google internal `cloudcode-pa` endpoints rather than a documented public usage API.
- Accurate Gemini quota requires the discovered `cloudaicompanionProject`; treating a missing project as unavailable is safer than surfacing misleading all-`100%` buckets.
- This slice does not auto-refresh expired Gemini OAuth tokens inside core. If the saved access token is stale, the user currently gets a clear refresh/re-auth message instead of a silent fallback through the local CLI.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/actions/usage/Usage.test.ts`
- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts`
- `npm run typecheck`

### Gemini selected-model apply slice

- threaded Gemini `modelId` through the agent projection so saved per-connection model settings can participate in apply
- extended `GeminiSettingsStore` to read and write `settings.json.model.name`
- updated Gemini apply so:
  - `security.auth.selectedType` is still enforced as `oauth-personal`
  - `model.name` is written only when the selected connection actually has a saved model
- added coverage for:
  - preserving unrelated Gemini settings while writing `model.name`
  - applying a Gemini connection with a saved selected model and verifying it lands in `~/.gemini/settings.json`

### Key findings

- Gemini CLI persists the preferred startup model in the global user settings file under `settings.json -> model.name`; it does not maintain a per-connection model slot of its own.
- Applying a Gemini model from Nile can safely set the default model for new Gemini CLI sessions, but it does not retarget already-running Gemini CLI processes.
- Leaving `model.name` untouched when a connection has no saved model is the safer behavior because it avoids clobbering an existing user-wide Gemini default unexpectedly.

### Verification

- `./node_modules/.bin/vitest run packages/agents/gemini/src/SettingsStore.test.ts packages/agents/gemini/src/ApplySelection.test.ts packages/agents/gemini/src/RollbackLatestMutation.test.ts packages/core/src/actions/usage/Usage.test.ts`
- `npm run typecheck`

### Gemini model catalog slice

- added a Gemini session model catalog reader under the Gemini CLI session family instead of forcing Gemini through the OpenAI `/models` path
- Gemini model detection now follows Gemini CLI's own shape closely:
  - `loadCodeAssist` discovers `cloudaicompanionProject`
  - `listExperiments` reads Gemini feature flags
  - `retrieveUserQuota` confirms preview-model access
- wired connection model catalog lookup so session-backed families can provide their own model list
- Gemini connections now surface a supported model list that includes:
  - preview models only when quota/flags indicate access
  - stable `gemini-2.5-*` defaults
  - Gemma options exposed by Gemini CLI
- kept the model catalog transport injectable from `ConnectionModelCatalog` so the shared test harness can mock Gemini remote calls without special global fetch state

### Key findings

- Gemini CLI model selection is not driven by a public `/models` endpoint. The reliable source for Nile is Gemini CLI's own internal combination of project discovery, experiments, and quota buckets.
- Returning a Gemini-specific session model catalog is cleaner than pretending Gemini is OpenAI-compatible, and it avoids baking Gemini-specific branches into generic UI code.
- This slice still depends on Google internal `cloudcode-pa` endpoints. If those responses drift, the safe fallback remains:
  - keep saved manual model ids working
  - treat remote Gemini model detection as unavailable instead of guessing more aggressively

### Verification

- `./node_modules/.bin/vitest run packages/connections/src/catalog/Catalog.test.ts packages/agents/gemini/src/SettingsStore.test.ts packages/agents/gemini/src/ApplySelection.test.ts packages/core/src/actions/usage/Usage.test.ts`
- `npm run typecheck`

### Gemini quota unauthorized auto-resync

- Added a narrow current-session recovery path around runtime quota reads instead of broadening provider detection or import flows:
  - Gemini quota 401/403 results now carry a structured `errorCode: "credential_unauthorized"`
  - current-session manifests can opt into `usageUnauthorizedRecovery`
  - Gemini opts in with `sync_current_session_and_retry`
- Builtins runtime now wraps shared usage reads with a retry flow that:
  - only activates on structured unauthorized quota errors
  - resolves the current local session from the manifest registry
  - compares the current session identity key against the saved connection identity key
  - only syncs the saved credential and retries quota when the identity still matches
- Added integration coverage for both branches:
  - stale saved Gemini credential recovers from the current local Gemini session and succeeds on retry
  - current local Gemini session for a different Google identity does not overwrite the saved connection

### Key findings

- The real Gemini drift problem was not account matching; it was credential freshness. Nile already matched the same `identityKey`, but quota reads still used the older saved session snapshot.
- Auto-syncing on every `valid_matched` detect would have turned background detection into an implicit write path. Restricting the write to `credential_unauthorized` quota failures keeps the side effect much narrower.
- Identity matching is required before auto-sync. Without that guard, a local Gemini login to another Google account could silently retarget an existing saved connection.

### Verification

- `./node_modules/.bin/vitest run packages/builtins/src/runtime/RecoveringUsage.test.ts packages/core/src/actions/usage/Usage.test.ts apps/desktop/src/state/UsageCache.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Gemini quota unauthorized CLI refresh

- moved Gemini unauthorized quota recovery closer to ClaudeBar's live-session behavior:
  - current-session source manifests can now declare an optional unauthorized-usage recovery hook
  - `RecoveringUsage` calls that hook before resolving/syncing the current session snapshot
  - Gemini's current-session source now uses that hook to run `gemini`, feed `/quit`, wait briefly for `oauth_creds.json` to settle, then resolve the refreshed local session
- added a Gemini-local `SessionRefresh` helper instead of baking spawn logic into core:
  - resolves the `gemini` command from PATH/NVM
  - sets `GEMINI_CLI_HOME` and `HOME` for the target Gemini home
  - kills the refresh attempt after 15s and reports a focused error
- tightened regression coverage around the new path:
  - a fake `gemini` executable rewrites `oauth_creds.json`, proving unauthorized quota can recover via live CLI refresh
  - identity-mismatch still refuses to overwrite the saved connection
  - Gemini refresh helper has a direct unit test for command/env/input wiring

### Key findings

- The earlier auto-sync fix only solved saved-vs-local credential drift. It could not recover cases where the current local `oauth_creds.json` itself needed the Gemini CLI to rotate tokens first.
- Putting the refresh hook on `CurrentSessionSourceManifest` keeps the provider-specific side effect in the Gemini plugin package while core stays generic.
- The refresh path still intentionally stops at one CLI run and one quota retry. If Google starts requiring a fully interactive re-login instead of silent startup refresh, Nile will still surface the unauthorized error rather than loop or guess.

### Verification

- `./node_modules/.bin/vitest run packages/agents/gemini/src/SessionRefresh.test.ts packages/builtins/src/runtime/RecoveringUsage.test.ts packages/core/src/actions/usage/Usage.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Gemini CLI refresh failure diagnostics

- extended `GeminiSessionRefresh` to capture short stdout/stderr snippets from the background `gemini` refresh run
- non-zero exit and timeout errors now include a compact CLI output summary, so desktop logs show more than just the exit code
- added a focused regression proving stderr text is surfaced in the thrown refresh error

### Key findings

- Exit code alone was not enough to debug why the silent `gemini` refresh sometimes failed after dev restarts.
- Keeping the output snippet capped and normalized avoids flooding logs while still exposing the actionable part of the CLI failure.

### Verification

- `./node_modules/.bin/vitest run packages/agents/gemini/src/SessionRefresh.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Gemini headless refresh args

- changed Gemini unauthorized refresh from a bare interactive launch plus `/quit` stdin to an explicit headless invocation:
  - `--skip-trust`
  - `--prompt "refresh auth"`
- kept `GEMINI_CLI_TRUST_WORKSPACE=true` in the env so both the CLI flag and env-based trust path are satisfied
- updated the refresh tests to assert the new args and empty stdin behavior

### Key findings

- After fixing the workspace trust gate, Gemini CLI 0.42.0 still rejected the old refresh flow because a plain launch in this environment expected either stdin content or an explicit `--prompt`.
- Using the documented headless `--prompt` path is less brittle than relying on a fast interactive startup followed by `/quit`.

### Verification

- `./node_modules/.bin/vitest run packages/agents/gemini/src/SessionRefresh.test.ts packages/builtins/src/runtime/RecoveringUsage.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
