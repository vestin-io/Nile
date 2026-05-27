# Credential Storage Modes

Credential storage modes define where Nile keeps saved connection secrets for one local workspace instance and how those secrets are recovered at runtime.

This feature owns:

- the shared machine-level storage-mode vocabulary
- the platform-abstract system secure storage contract
- the encrypted-local vault contract
- the portable import/export bundle contract
- the cross-store export/import workflow contract
- upgrade rules from older per-connection backend metadata
- the rule that the first successful credential save establishes the machine storage mode for later writes

This feature does not own:

- renderer interaction copy
- desktop prompt timing
- desktop import/export UI flows

## Requirements

### Shared Mode Rules

- Nile MUST support at least two machine-level credential storage modes:
  - `system_secure_storage`
  - `encrypted_local_storage`
- Nile MUST treat the selected storage mode as machine-scoped local state for one desktop workspace instance, not as connection-scoped metadata for newly saved connections.
- Nile MUST allow only one active storage mode for new credential writes in a local workspace instance at a time.
- The first successful credential-bearing save in a local workspace instance MUST establish the active machine storage mode if no mode has been established yet.
- Once the first saved connection exists in a workspace instance, Nile MUST treat the storage mode as locked until an explicit reset or reinitialize flow clears saved local state.
- Nile MUST keep the shared mode vocabulary platform-abstract so `system_secure_storage` may map to macOS Keychain, Windows credential storage, Linux secret-service storage, or another supported OS-native secure store without renaming the product-level mode.

### Secret Boundary Rules

- Nile MUST NOT write raw saved-connection secrets into SQLite.
- Nile MUST NOT write raw saved-connection secrets into desktop preference storage.
- Nile MUST NOT write the encrypted-local passphrase into SQLite, desktop preference storage, logs, or mutation history.
- Nile MAY persist non-sensitive storage-mode metadata and credential references needed to reopen saved connections.

### Encrypted Local Storage Rules

- `encrypted_local_storage` MUST store credential payloads in a Nile-managed local file or file set outside SQLite.
- `encrypted_local_storage` MUST encrypt credential payloads with a user-provided passphrase.
- `encrypted_local_storage` MUST use authenticated encryption so corrupted or tampered ciphertext fails closed instead of producing partial plaintext.
- Nile MUST derive its encryption key from the user passphrase using versioned KDF parameters stored alongside the vault metadata.
- Nile MUST use one desktop-local passphrase scope for this backend in this slice rather than one passphrase per connection.
- Nile MAY cache a successfully unlocked derived key in process memory for the running app session only.
- Nile MUST discard any in-memory passphrase-derived material on app exit.
- Nile MUST treat a successful unlock as session-scoped: one unlock may satisfy all encrypted-local reads and writes for the current app run, but it MUST NOT survive app exit.
- If the passphrase is missing, wrong, or forgotten, Nile MUST fail closed and require explicit user recovery steps instead of silently replacing or bypassing the encrypted vault.
- Nile MUST keep the encrypted-local vault format versioned and portable enough to serve as the future base for export/import flows across supported desktop platforms.
- Nile SHOULD treat encrypted-local vault metadata as stable product storage, not as temporary desktop-only implementation detail, because later export/import features depend on this format boundary.

### Portable Bundle Rules

- Nile MUST define one portable encrypted bundle format for import/export that is independent from any OS-native secure-store representation.
- Nile MUST treat the portable bundle format as a product contract distinct from the runtime encrypted-local vault file layout.
- Nile MAY reuse the same cryptographic primitives, KDF family, and secret-payload codec family used by encrypted-local runtime storage.
- Nile MUST version the portable bundle format independently so future schema changes can be validated and rejected explicitly.
- Nile MUST use whole-payload authenticated encryption for the exported bundle.
- Nile MUST require a dedicated export passphrase for each exported bundle.
- Nile MUST NOT require the current machine's encrypted-local unlock state in order to create or read an export bundle.
- Nile MUST store enough non-secret metadata in the bundle envelope to validate:
  - format identity
  - format version
  - KDF parameters
  - cipher metadata
- Nile MUST keep the portable bundle payload platform-neutral so the same exported bundle may be imported on macOS, Windows, or Linux.

### Export Rules

- Nile MUST support exporting saved connections from a workspace whose active machine storage mode is:
  - `system_secure_storage`
  - `encrypted_local_storage`
- Export MUST read decrypted credential material from the active machine storage backend through source-store adapters.
- Export MUST serialize credentials into the portable bundle payload instead of copying OS-native secure-store records or the runtime vault file verbatim.
- Export MUST support both:
  - whole-workspace export
  - selected-connection export
- Export MUST fail closed if any requested credential cannot be read from the source backend.

### Import Rules

- Import MUST decrypt and validate the portable bundle before any credential mutation begins.
- Import MUST support partial import by accepting an explicit subset of bundle connections to apply.
- Import MUST write imported credentials into the target machine's currently active machine storage mode.
- Import MUST NOT recreate the source machine's per-connection backend layout on the target machine.
- Import MUST refuse to proceed if the target workspace is in a mixed legacy backend state that already requires reset.
- If the target workspace has no established machine storage mode yet, import MUST establish it explicitly before writing the first imported credential.

### Duplicate Detection And Merge Rules

- Nile MUST detect duplicate connections using this priority:
  - prefer identity/account fingerprint when present
  - otherwise fall back to normalized endpoint family + endpoint identifier/url + auth mode
- Import MUST classify each selected bundle connection as one of:
  - new
  - duplicate
  - failed
- Import MUST support these merge strategies:
  - `skip_existing`
  - `replace_existing`
- `replace_existing` MUST fully replace connection-owned state:
  - secret
  - label
  - enabled/configurable agents
  - selected agent bindings
  - model selections
  - connection metadata
- `replace_existing` MUST NOT replace:
  - history
  - alerts
  - usage cache
  - desktop UI preferences
- Nile MUST expose structured per-connection import/export result codes so surfaces do not infer outcomes from exception strings.

### System Secure Storage Rules

- `system_secure_storage` MUST remain the recommended mode when the host platform exposes a supported secure credential store.
- Nile MUST treat OS-denied or unavailable system-secure writes as a storage failure, not as permission to downgrade secrets into plaintext local files.
- Nile MUST keep system secure storage behind a platform adapter boundary so desktop surfaces do not branch on `keychain` or other OS-specific labels.
- Nile MUST allow later platform adapters for Windows and Linux without changing the machine-level mode vocabulary or saved-state semantics.

### Mode Locking And Upgrade Rules

- New credential writes MUST use the active machine-level storage mode and MUST NOT accept a per-connection override once the mode is established.
- If no machine-level mode has been established yet, new credential writes MUST either:
  - establish the mode from the user-selected first-save flow, or
  - fail explicitly if the caller does not provide enough information to establish that first mode.
- Nile MUST continue loading older saved rows that still carry legacy per-connection backend metadata from released versions.
- If legacy saved rows all agree on one backend, Nile MUST derive the active machine-level storage mode from that legacy state during upgrade.
- If legacy saved rows disagree and represent mixed storage backends in one local workspace instance, Nile MUST NOT continue silent mixed-mode writes. Nile MUST enter a user-recoverable state that blocks further credential mutations until the user resets or otherwise resolves local saved state explicitly.
- Resetting desktop-local state as an explicit recovery action MUST remove the encrypted-local vault file set, clear any in-memory unlocked key material for the current app session, and clear the machine-level storage mode.

## Verification

- Unit test machine-level mode persistence for:
  - first saved connection created with `system_secure_storage`
  - first saved connection created with `encrypted_local_storage`
  - restart/reload paths preserving the active machine mode
- Unit test encrypted-local vault behavior for:
  - write and read with the correct passphrase
  - unlock failure with the wrong passphrase
  - tampered ciphertext rejection
  - no passphrase persisted to SQLite or desktop preferences
  - unlocked key material cleared on explicit local reset
- Unit test mode-locking rules so:
  - once at least one saved connection exists, new credential writes cannot switch to a different mode without reset
  - per-connection override inputs are rejected or ignored in favor of the active machine mode
- Unit test portable bundle behavior for:
  - bundle encrypt/decrypt with the correct export passphrase
  - wrong export passphrase failure
  - tampered bundle rejection
  - unsupported bundle version rejection
- Unit test export/import workflows for:
  - export from `system_secure_storage`
  - export from `encrypted_local_storage`
  - import into `system_secure_storage`
  - import into `encrypted_local_storage`
  - selected-subset import
  - `skip_existing`
  - `replace_existing`
  - duplicate detection with and without identity/account fingerprints
- Unit test upgrade rules for:
  - legacy saved rows all using `system_secure_storage`
  - legacy saved rows all using `encrypted_local_storage`
  - legacy saved rows with mixed backends entering a recoverable blocked state
- Manual verification:
  - choose one storage mode, save a connection, then verify later saves use the same mode
  - verify the first successful credential save establishes the machine mode even if it originates from a legacy inline import flow
  - restart the app and verify the mode remains locked
  - verify reset clears saved local state, the encrypted-local vault, and the active mode

## Data Model Impact

This feature introduces or stabilizes:

- `CredentialStorageMode`
  - `system_secure_storage`
  - `encrypted_local_storage`
- machine-scoped local metadata describing the active storage mode
- encrypted-local vault metadata containing:
  - schema/version
  - KDF parameters
  - non-secret salt/nonce metadata
- encrypted-local vault entries keyed by credential identity or reference id
- portable bundle envelope metadata containing:
  - format/version
  - KDF parameters
  - cipher metadata
  - encrypted payload
- portable bundle payload records containing:
  - source metadata
  - stable duplicate-detection fields
  - connection-owned metadata
  - portable secret payloads

Legacy per-connection backend metadata may continue to exist temporarily for upgrade compatibility, but it is migration input rather than the long-term source of truth for new saves.

The encrypted-local vault file is credential storage, not workspace business state.
It must stay separate from SQLite and separate from desktop preference storage.

## Failure And Edge Cases

- Wrong passphrase:
  - credential reads fail closed
  - no credential payload is returned
  - the caller receives a repairable unlock error
- Explicit desktop reset:
  - clears saved local connections and related local credential state
  - clears the encrypted-local vault file set
  - clears the active machine storage mode
  - clears the unlocked in-memory session state
- Corrupted encrypted-local vault:
  - affected entries fail closed
  - Nile does not overwrite the vault automatically
- Wrong export-bundle passphrase:
  - bundle import fails closed
  - no credential mutation is committed
- Corrupted or unsupported bundle:
  - import fails closed
  - Nile does not partially apply the bundle
- Platform-secure storage denial:
  - the write fails explicitly
  - Nile does not silently downgrade to another storage mode
- Existing workspaces saved before this feature:
  - continue loading through upgrade-safe compatibility rules
  - may require explicit reset if legacy saved data is already mixed across storage backends
