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

## Follow-up Build: Explicit Create-Time Storage Metadata

### Tasks Completed

- Tightened core create-time contracts so new local/create connection flows must provide explicit credential storage backend metadata instead of relying on omitted-value defaults.
- Updated desktop and CLI create/onboarding call sites to pass `system_secure_storage` explicitly outside the desktop machine-mode path.
- Kept persisted access-level backend metadata as an internal storage concern so the credential store can still resolve where each saved secret lives.

### Files Changed

- `packages/core/src/application/local/ConnectionInputs.ts`
- `packages/core/src/models/connection/Runtime.ts`
- `packages/core/src/models/connection/Upsert.ts`
- `packages/core/src/actions/live-setup/Import.ts`
- `packages/connections/src/mutations/Creator.test.ts`
- `packages/builtins/src/runtime/NileSession.test.ts`
- `apps/cli/src/commands/ConnectionCommands.ts`
- `apps/desktop/src/electron/connections/DesktopConnectionManager.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
- `./node_modules/.bin/vitest run packages/connections/src/mutations/Creator.test.ts packages/builtins/src/runtime/NileSession.test.ts`

### Key Findings

- Connection-level backend is no longer a user-facing selection model, but persisted access records still need internal backend metadata so stored secrets can be read from the correct store.
- `system_secure_storage` is now passed explicitly in non-desktop create paths, which removes the last hidden create-time fallback for new connections without changing the runtime credential-store compatibility layer.

## Follow-up Build: Cross-Surface Single-Mode Enforcement

### Tasks Completed

- Blocked CLI connection save/import flows when this machine is already established on `encrypted_local_storage` or when older state is mixed across multiple backends.
- Added explicit `credentialStorageBackend` propagation to detected-setup imports so desktop and CLI batch-import paths no longer depend on hidden system-secure fallbacks.

### Files Changed

- `apps/cli/src/commands/ConnectionCommands.ts`
- `packages/core/src/actions/local-setup/Result.ts`
- `packages/core/src/actions/local-setup/ImportDetectedSetups.ts`
- `apps/desktop/src/electron/connections/Imports.ts`
- `apps/desktop/src/electron/connections/DesktopConnectionGateway.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
- `./node_modules/.bin/vitest run apps/cli/src/NileCli.test.ts`

### Key Findings

- The machine-level single-mode rule has to be enforced across every writable surface, not just desktop renderer flows; otherwise CLI can silently recreate the same mixed-backend state that desktop now blocks.
- `importDetectedSetups` previously had no backend input at all, so even after tightening create flows it could still create system-secure connections implicitly. Passing the backend through that batch-import path closes the last active cross-surface fallback.

## Follow-up Build: Windows Credential Manager Backend

### Tasks Completed

- Added a dedicated Windows system-secure credential store implementation backed by the native Windows Credential Manager API.
- Extracted shared credential payload serialization/validation so macOS Keychain and Windows Credential Manager stores enforce the same stored-secret shape rules.
- Kept the encrypted-local vault path unchanged while letting desktop Windows route `system_secure_storage` to the native OS store instead of the earlier desktop-local file fallback.

### Files Changed

- `packages/core/src/services/credential/StoredCredentialCodec.ts`
- `packages/core/src/services/credential/WindowsCredentialWriter.ts`
- `packages/core/src/services/credential/WindowsCredentialManagerStore.ts`
- `packages/core/src/services/credential/WindowsCredentialManagerStore.test.ts`
- `packages/core/src/services/credential/KeychainCredentialStore.ts`
- `packages/core/src/services/credential/index.ts`

### Verification Commands Run

- `npx vitest run packages/core/src/services/credential/KeychainCredentialStore.test.ts packages/core/src/services/credential/WindowsCredentialManagerStore.test.ts`
- `npm run typecheck`

### Key Findings

- Windows `system_secure_storage` now maps to the real Windows Credential Manager instead of a Nile-managed file, which aligns the product meaning of "system secure storage" across macOS and Windows.
- The Windows implementation uses PowerShell-hosted P/Invoke into the native Credential Manager API, so no new npm/native dependency was introduced in this slice.
- Existing encrypted-local behavior and reset semantics remain unchanged; this round only changed the Windows system-store backend.

## Follow-up Build: Windows Credential Payload Chunking

### Tasks Completed

- Split oversized Windows system-secure credential payloads across multiple Credential Manager entries instead of failing on the native blob-size cap.
- Kept the base credential entry as a small manifest so Windows reads, updates, and deletes can reconstruct or clean up chunked payloads deterministically.
- Added focused store tests for chunked create/read/update/remove behavior without reintroducing the earlier desktop-local Windows fallback.

### Files Changed

- `packages/core/src/services/credential/WindowsCredentialWriter.ts`
- `packages/core/src/services/credential/WindowsCredentialManagerStore.ts`
- `packages/core/src/services/credential/WindowsCredentialManagerStore.test.ts`

### Verification Commands Run

- `npx vitest run packages/core/src/services/credential/WindowsCredentialManagerStore.test.ts`
- `npm run typecheck`

### Key Findings

- Native Windows Credential Manager generic credentials still enforce a small per-entry payload limit, so chunking has to happen in Nile rather than in the OS API.
- This round intentionally does not preserve or migrate the earlier unreleased desktop-local Windows credential-file format; only the current Credential Manager layout matters now.
