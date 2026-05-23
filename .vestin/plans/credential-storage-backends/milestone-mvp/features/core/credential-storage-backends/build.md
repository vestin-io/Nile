# Build Log

## Status

- Built.

## Scope

- Core feature: `credential-storage-backends`
- Milestone: MVP

## Tasks Completed

- `PC-001` Confirmed saved-connection credential reads/writes flow through `AccessRegistry`, `SavedConnections`, `LocalConnectionWorkflows`, and desktop runtime/session entry points.
- `PC-002` Confirmed existing secret-boundary coverage already lived in access-registry and credential-store tests, then extended those tests instead of duplicating SQLite/preference assertions elsewhere.
- `B-001` Added shared credential backend vocabulary and connection-scoped backend metadata persistence.
- `B-002` Implemented encrypted-local vault primitives with authenticated encryption and versioned KDF metadata.
- `B-003` Routed saved-connection credential resolution through backend metadata while keeping legacy/default system-secure behavior compatible.
- `B-004` Added focused persistence and failure-mode tests for backend metadata and encrypted-local storage.
- `B-005` Extended current-session import flows so desktop quick-setup imports can explicitly target `system_secure_storage` or `encrypted_local_storage` instead of always inheriting the implicit legacy path.

## Files Changed

- `packages/core/src/services/credential/Store.ts`
- `packages/core/src/services/credential/index.ts`
- `packages/core/src/services/credential/KeychainCredentialStore.ts`
- `packages/core/src/services/credential/KeychainCredentialStore.test.ts`
- `packages/core/src/services/credential/EncryptedLocalCredentialStore.ts`
- `packages/core/src/services/credential/EncryptedLocalCredentialStore.test.ts`
- `packages/core/src/services/credential/BackendCredentialStore.ts`
- `packages/core/src/models/access/Types.ts`
- `packages/core/src/models/access/Builder.ts`
- `packages/core/src/models/access/Credentials.ts`
- `packages/core/src/models/access/SqliteAccessStore.ts`
- `packages/core/src/models/access/Registry.test.ts`
- `packages/core/src/models/connection/Runtime.ts`
- `packages/core/src/models/connection/Upsert.ts`
- `packages/core/src/application/local/ConnectionInputs.ts`
- `packages/core/src/application/local/ConnectionWorkflows.ts`
- `packages/core/src/application/local/StateReset.ts`
- `packages/core/src/actions/apply/Support.ts`
- `packages/core/src/actions/live-setup/Import.ts`
- `packages/core/src/runtime-local/AgentWorkspaceBinding.ts`
- `packages/core/src/models/agent/Adapter.ts`
- `packages/core/src/models/agent/index.ts`
- `packages/builtins/src/runtime/NileSession.ts`
- `packages/agents/codex/src/CodexAgentAdapter.ts`
- `packages/agents/codex/src/import/ImportCurrentConnection.ts`
- `packages/agents/claude/src/ClaudeAgentAdapter.ts`
- `packages/agents/claude/src/ImportCurrentConnection.ts`
- `packages/agents/cursor/src/CursorAgentAdapter.ts`
- `packages/agents/cursor/src/ImportCurrentConnection.ts`
- `packages/agents/gemini/src/GeminiAgentAdapter.ts`
- `packages/agents/gemini/src/ImportCurrentConnection.ts`
- `packages/agents/openclaw/src/OpenClawAgentAdapter.ts`
- `packages/agents/openclaw/src/ImportCurrentConnection.ts`

## Decisions

- Used `scrypt` plus `aes-256-gcm` for the encrypted-local vault so passphrase-derived keys stay versioned and tamper detection fails closed.
- Persisted backend choice as connection-scoped access metadata in SQLite while keeping raw secret material out of SQLite and preferences.
- Kept pre-existing connections on implicit `system_secure_storage` semantics by defaulting missing backend metadata at read time instead of forcing migration in this slice.
- Added an explicit `SystemSecureCredentialStoreDeniedError` so surfaces can offer an intentional encrypted-local fallback without guessing from generic command failures.
- Kept current-session import customization narrowly scoped to credential backend metadata; passphrase establish/unlock remains a desktop concern and does not leak into core import contracts.

## Verification Commands Run

- `./node_modules/.bin/vitest run packages/core/src/services/credential/KeychainCredentialStore.test.ts packages/core/src/services/credential/EncryptedLocalCredentialStore.test.ts packages/core/src/models/access/Registry.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

## Fix / Re-run Rounds

- Round 1: desktop-manager tests failed because older test stubs still assumed string-only credential ids after the new `{ reference, backend }` target shape. Updated stubs to normalize `CredentialStoreTarget`, then re-ran the suite successfully.
- Round 2: review follow-up found that draft preparation could create an encrypted-local vault before save. Split desktop credential preparation into draft-safe vs save-time behavior and added a focused manager test to keep draft preparation side-effect free.

## How To Run / Verify Locally

- Run the focused core suite:
  - `./node_modules/.bin/vitest run packages/core/src/services/credential/KeychainCredentialStore.test.ts packages/core/src/services/credential/EncryptedLocalCredentialStore.test.ts packages/core/src/models/access/Registry.test.ts`
- Run typecheck:
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

## Key Findings

- This slice keeps old saved connections on their existing effective behavior by defaulting missing backend metadata to `system_secure_storage`; no migration was introduced.
- Encrypted-local vault key material is cached only in process memory and explicitly cleared on app quit, but there is still no passphrase recovery path by design.
- The encrypted-local vault is stored beside the desktop-local database under `credentials/encrypted-local.v1.json`; it remains outside SQLite and outside preference storage as required.
- Current-session imports now update matched/reused saved connections with the selected credential backend before syncing refreshed credentials, so quick setup can deliberately migrate a reused connection into encrypted-local storage.

## Follow-up Build: Session Unlock Semantics

### Tasks Completed

- Aligned the feature spec with session-scoped encrypted-local unlock semantics and explicit reset-based recovery for forgotten passphrases.
- Ensured desktop reset clears the in-memory unlocked encrypted-local key material in the running process before the desktop-local recovery flow completes.

### Files Changed

- `.vestin/specs/core/features/credential-storage-backends.md`
- `apps/desktop/src/electron/shell/DesktopMain.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- The encrypted-local vault file was already deleted by desktop-local reset through the `credentials/` state path; this round added the missing in-memory unlocked-key cleanup so reset fully behaves as a recovery path in the current app run.
- The core credential backend contract now explicitly describes reset as a valid recovery path for forgotten encrypted-local passphrases without changing the no-recovery guarantee for the passphrase itself.

## Follow-up Build: System-Secure Compatibility Cleanup

### Tasks Completed

- Restored legacy compatibility for system-secure credential targets so existing string-based credential-store call sites and tests continue to work while encrypted-local keeps the structured `{ reference, backend }` target.
- Updated `StateReset` test fixtures to include the new `credential_storage_backend` access column expected by the current reset query.

### Files Changed

- `packages/core/src/services/credential/BackendCredentialStore.ts`
- `packages/core/src/application/local/StateReset.test.ts`

### Verification Commands Run

- `./node_modules/.bin/vitest run packages/core/src/application/local/StateReset.test.ts packages/core/src/actions/usage/Usage.test.ts packages/core/src/actions/live-setup/Matcher.test.ts packages/agents/codex/src/live-setup/Detector.test.ts packages/agents/cursor/src/usage/Binder.test.ts`
- `npm test`

### Key Findings

- `system_secure_storage` remains intentionally backward-compatible with string credential ids; only encrypted-local needs the structured target object.
- The failing reset behavior was a stale test fixture schema, not a runtime migration bug in `StateReset`.
