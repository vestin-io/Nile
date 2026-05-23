# Desktop Credential Storage Choice

Desktop credential storage choice defines how the Electron surface asks users where new connection credentials should live, how it remembers the default choice for future connections, and how it unlocks encrypted-local storage for each running app session.

## Requirements

### Desktop Choice Flow

- The desktop surface MUST ask for credential storage mode only in connection-oriented flows that are about to save credential material or set the machine default for future saves.
- The desktop surface MUST NOT ask for credential storage mode during unrelated first-run setup or generic onboarding before credential storage is relevant.
- The desktop surface MUST expose these user-facing choices:
  - `System secure storage`
  - `Encrypted local storage`
- The desktop surface MUST present `System secure storage` as the recommended option when available on the host platform.

### Global Default Rules

- The desktop surface MUST persist a desktop-local global default credential backend preference.
- The global default MAY be:
  - `system_secure_storage`
  - `encrypted_local_storage`
  - `null` when the user has not chosen a default yet
- When the global default is already set, new connection flows MUST preselect that backend.
- Changing the global default MUST affect only future connection creations and MUST NOT rewrite existing saved connections.

### First-Time Selection Rules

- If the user has no global default yet, the first desktop connection flow that needs to save credentials MUST ask for a backend choice before saving.
- That first-time choice flow MUST establish the machine default for future connection saves instead of asking a separate "remember this choice" question in the same step.
- After an explicit desktop reset, the next quick-setup or add-connection flow MUST behave like first-time selection again because the machine default has been cleared.

### Encrypted Local Storage Interaction Rules

- If the user selects `Encrypted local storage` and no encrypted-local vault exists yet, desktop MUST prompt for a passphrase and confirmation before saving the new connection or committing encrypted-local as the machine default.
- Desktop MUST require passphrase confirmation when establishing a new encrypted-local passphrase.
- If an encrypted-local vault already exists, desktop MUST treat unlock as session-level state for the running app.
- When desktop starts and detects an existing encrypted-local vault that is still locked, desktop MUST surface one startup unlock prompt for the current app session.
- Desktop SHOULD present that startup unlock prompt without blocking the app shell from rendering.
- After a successful startup unlock, desktop MUST reuse that unlocked session state across quick setup, add/edit connection flows, usage reads, and other encrypted-local credential access in the same app run.
- If the startup unlock is dismissed or fails, desktop MAY continue to surface explicit unlock prompts only when a later action cannot proceed without encrypted-local credential access.
- Desktop MUST clearly state that Nile cannot recover encrypted-local credentials if the passphrase is forgotten.

### System Secure Storage Failure Rules

- If desktop attempts `System secure storage` and the host OS denies access, desktop MUST surface a recoverable error instead of silently failing.
- After a system-secure denial, desktop SHOULD offer `Encrypted local storage` as an explicit fallback choice in the same flow.
- Desktop MUST NOT silently convert a connection from `System secure storage` to `Encrypted local storage` without explicit user confirmation.

### Scope Rules

- This slice MUST support per-connection backend choice at creation time.
- This slice MUST NOT require backend migration or backend switching for already saved desktop connections.
- This slice MUST treat desktop reset as the recovery path for forgotten encrypted-local passphrases by clearing the machine default backend along with the encrypted-local vault.

## Verification

- Unit test desktop preference reads/writes for:
  - unset global default
  - saving `system_secure_storage` as the global default
  - saving `encrypted_local_storage` as the global default
- Unit test connection-create UI state for:
  - first credential-bearing connection with no global default
  - new connection with a preexisting global default
  - overriding the global default for one connection
  - system-secure denial offering encrypted-local fallback
- Unit test desktop reset flow for:
  - clearing `defaultCredentialStorageBackend` back to `null`
  - re-exposing the quick-setup storage step after reset
- Unit test startup unlock orchestration for:
  - prompting once when an encrypted-local vault exists and is locked
  - not prompting again after a successful unlock in the same app session
- Manual verification:
  - create a first connection and choose a default
  - quit and relaunch the app
  - verify the app prompts once to unlock encrypted-local storage when a vault exists
  - verify the next new connection flow preselects the same default without re-asking for storage mode
  - verify an older connection remains unchanged after editing the global default
  - verify reset clears the encrypted-local default so quick setup asks for storage mode again

## Data Model Impact

Desktop-local preference storage gains:

- `defaultCredentialStorageBackend: "system_secure_storage" | "encrypted_local_storage" | null`

Desktop connection creation flows gain transient draft fields for:

- selected backend for the current connection
- encrypted-local passphrase entry when establishing a brand-new encrypted-local vault

Desktop app-session state gains:

- startup unlock prompt state for the current run
- encrypted-local unlocked session state reused across the current run

## Failure And Edge Cases

- If the user closes the backend-choice prompt before saving, the connection draft remains unsaved.
- If encrypted-local passphrase confirmation does not match, desktop blocks save and keeps the connection draft editable.
- If the encrypted-local vault is locked after app restart, desktop first prompts once at startup to unlock it for the current app session.
- If the user dismisses the startup unlock prompt, encrypted-local-backed actions may remain unavailable until the user explicitly unlocks later in the same app run.
- If system-secure storage is unavailable on a platform, desktop may hide the recommendation state but must still keep backend naming consistent with the shared core contract.
