# Credential Storage Backends

Credential storage backends define where Nile keeps saved connection secrets and how those secrets are recovered at runtime.

This feature owns:

- the shared credential backend vocabulary
- the secret-boundary rules for backend persistence
- the encrypted-local vault contract
- connection-scoped backend selection metadata

This feature does not own:

- renderer interaction copy
- desktop-only preference prompts
- migration of existing saved connections between backends

## Requirements

### Shared Backend Rules

- Nile MUST support at least two credential backends for saved connections:
  - `system_secure_storage`
  - `encrypted_local_storage`
- Nile MUST treat the selected backend as connection-scoped metadata.
- Nile MUST keep the backend metadata persistent across app restarts.
- Nile MUST allow future agents and connection families to reuse the same backend vocabulary without agent-specific branching in surfaces.

### Secret Boundary Rules

- Nile MUST NOT write raw saved-connection secrets into SQLite.
- Nile MUST NOT write raw saved-connection secrets into desktop preference storage.
- Nile MUST NOT write the encrypted-local passphrase into SQLite, desktop preference storage, logs, or mutation history.
- Nile MAY persist non-sensitive backend metadata and credential references needed to reopen a saved connection.

### Encrypted Local Storage Rules

- `encrypted_local_storage` MUST store credential payloads in a Nile-managed local file or file set outside SQLite.
- `encrypted_local_storage` MUST encrypt credential payloads with a user-provided passphrase.
- `encrypted_local_storage` MUST use authenticated encryption so corrupted or tampered ciphertext fails closed instead of producing partial plaintext.
- `encrypted_local_storage` MUST derive its encryption key from the user passphrase using versioned KDF parameters stored alongside the vault metadata.
- Nile MUST use one desktop-local passphrase scope for this backend in this slice rather than one passphrase per connection.
- Nile MAY cache a successfully unlocked derived key in process memory for the running app session only.
- Nile MUST discard any in-memory passphrase-derived material on app exit.
- Nile MUST treat a successful desktop unlock as session-scoped: one unlock may satisfy all encrypted-local reads and writes for the current app run, but it MUST NOT survive app exit.
- If the passphrase is missing, wrong, or forgotten, Nile MUST fail closed and require explicit user recovery steps instead of silently replacing or bypassing the encrypted vault.
- Nile MUST support an explicit recovery path that lets desktop reset the encrypted-local vault and its unlocked session state when the user chooses to discard locally encrypted credentials and start over.

### System Secure Storage Rules

- `system_secure_storage` MUST remain the recommended backend when the host platform exposes a supported secure credential store.
- Nile MUST treat OS-denied or unavailable system-secure writes as a backend failure, not as permission to downgrade secrets into plaintext local files.
- Nile SHOULD surface a user-recoverable fallback path that lets the caller explicitly choose `encrypted_local_storage` after a system-secure denial.

### Scope And Migration Rules

- Existing saved connections MUST keep their current backend behavior in this slice.
- This slice MUST NOT require automatic migration of previously saved connections between backends.
- This slice MUST NOT require in-place backend switching for an already saved connection.
- Resetting desktop-local state as an explicit recovery action MUST remove the encrypted-local vault file set and clear any in-memory unlocked key material for the current app session.

## Verification

- Unit test backend metadata persistence for:
  - connection created with `system_secure_storage`
  - connection created with `encrypted_local_storage`
  - restart/reload paths preserving the selected backend
- Unit test encrypted-local vault behavior for:
  - write and read with the correct passphrase
  - unlock failure with the wrong passphrase
  - tampered ciphertext rejection
  - no passphrase persisted to SQLite or desktop preferences
  - unlocked key material cleared on explicit desktop-local reset
- Unit test fallback rules so:
  - system-secure denial does not produce plaintext local storage
  - explicit encrypted-local selection still succeeds
- Manual verification:
  - create one connection with each backend
  - restart the app
  - verify both saved connections reopen with their original backend metadata and without new secret material appearing in SQLite

## Data Model Impact

This feature introduces shared backend concepts:

- `CredentialStorageBackend`
  - `system_secure_storage`
  - `encrypted_local_storage`
- connection-scoped backend metadata persisted with saved connection truth
- encrypted-local vault metadata containing:
  - schema/version
  - KDF parameters
  - non-secret salt/nonce metadata
- encrypted-local vault entries keyed by credential identity or reference id

The encrypted-local vault file is credential storage, not workspace business state.
It must stay separate from SQLite and separate from desktop preference storage.

## Failure And Edge Cases

- Wrong passphrase:
  - credential reads fail closed
  - no credential payload is returned
  - the caller receives a repairable unlock error
- Explicit desktop reset:
  - clears the encrypted-local vault file set
  - clears the unlocked in-memory session state
  - leaves saved-connection metadata/loading rules to the normal reset recovery flow
- Corrupted encrypted-local vault:
  - affected entries fail closed
  - saved connection metadata remains intact
  - Nile does not overwrite the vault automatically
- Platform-secure storage denial:
  - the write fails explicitly
  - Nile may offer encrypted-local storage as an explicit fallback
- Existing connections saved before this feature:
  - continue using their prior storage behavior
  - are not migrated automatically in this slice
