# Desktop Credential Storage Mode

Desktop credential storage mode defines how the Electron surface lets the user establish one machine-level storage mode, how it enforces that mode for later saves, and how it unlocks encrypted-local storage only when a user action needs decrypted credentials.

## Requirements

### Mode Selection Flow

- The desktop surface MUST expose these user-facing choices:
  - `System secure storage`
  - `Encrypted local storage`
- The desktop surface MUST present `System secure storage` as the recommended option when available on the host platform.
- Desktop MUST ask for storage mode only when the user is about to create the first saved connection or otherwise establish local credential storage for the first time.
- The first successful credential-bearing save MUST establish the machine storage mode even if that save originates from a legacy inline import affordance rather than the dedicated first-run chooser.
- Desktop MUST NOT ask for storage mode during unrelated onboarding before credential storage is relevant.
- Once the first saved connection exists, desktop MUST stop offering mode switching in normal flows.

### Machine-Level Mode Rules

- Desktop MUST persist one desktop-local machine-level storage mode preference.
- The persisted mode MAY be:
  - `system_secure_storage`
  - `encrypted_local_storage`
  - `null` when local credential storage has not been initialized yet
- New connection creation, quick setup imports, inline `Save to Nile` actions, and similar credential-save flows MUST all use the same machine-level mode.
- Desktop MUST NOT permit a second competing storage-mode choice on the same machine once the first saved connection has established the mode.
- Desktop MUST NOT support a per-connection storage-mode override after the machine-level mode has been established.
- Desktop MUST surface existing connections as using the machine’s active storage mode rather than asking the user to reason about mixed per-connection storage.

### Locking And Reset Rules

- Once at least one saved connection exists, desktop MUST treat the machine-level storage mode as locked.
- Settings MAY show the active mode after lock, but MUST present it as read-only in normal operation.
- Quick setup, add connection, agent-page inline import, and agent-detail import affordances MUST all behave as mode consumers after lock rather than re-opening storage selection.
- If the user wants to change storage mode after lock, desktop MUST require an explicit reset or reinitialize flow that clears saved local state.
- Desktop reset MUST clear:
  - the active machine-level storage mode
  - the encrypted-local vault, if present
  - the current encrypted-local unlocked session state
  - saved local connections that depend on the locked mode
- After reset, the next credential-bearing flow MUST behave like first-time setup again.

### Encrypted Local Storage Interaction Rules

- If the user selects `Encrypted local storage` and no encrypted-local vault exists yet, desktop MUST prompt for a passphrase and confirmation before allowing the first credential save to continue.
- Desktop MUST require passphrase confirmation when establishing a new encrypted-local passphrase.
- If an encrypted-local vault already exists, desktop MUST treat unlock as session-level state for the running app only.
- Desktop MUST NOT auto-prompt for unlock at app startup solely because a vault exists.
- When a user action cannot continue without encrypted-local credential access, desktop MUST interrupt that action with an unlock dialog and explain why decrypting is required to continue.
- The unlock dialog SHOULD include action-specific hint copy such as saving a connection, saving a detected setup, switching connections, or refreshing encrypted-local-backed data.
- After a successful unlock, desktop MUST reuse that unlocked session state across later encrypted-local reads and writes in the same app run.
- If the user cancels an unlock dialog, desktop MUST leave the triggering action incomplete without silently downgrading to another storage mode.
- Desktop MUST clearly state that Nile cannot recover encrypted-local credentials if the passphrase is forgotten.
- Desktop SHOULD describe encrypted-local storage as the portable basis for future export/import work rather than as a platform fallback.

### System Secure Storage Rules

- If desktop attempts `System secure storage` and the host OS denies access, desktop MUST surface a recoverable error instead of silently failing.
- Desktop MAY allow retrying the same action after the OS-secure failure.
- Desktop MUST NOT silently convert a workspace from `System secure storage` to `Encrypted local storage` without an explicit reset and re-selection flow.
- Desktop MUST keep product copy platform-neutral (`System secure storage`) even when the current platform implementation is macOS Keychain or another named OS store.

### Inline And Legacy Entry Point Rules

- All desktop flows that can create or import saved credentials MUST honor the active machine-level mode, including:
  - add connection
  - quick setup
  - agents-page inline `Save to Nile`
  - agent-detail import current setup
- No legacy save/import entry point may bypass the active machine-level mode by falling back to an implicit default.
- If an action touches only non-secret metadata and does not read or write credentials, desktop MAY allow it without unlock even while encrypted-local storage remains locked.

## Verification

- Unit test desktop preference reads/writes for:
  - unset machine-level mode
  - saving `system_secure_storage` as the first selected mode
  - saving `encrypted_local_storage` as the first selected mode
- Unit test lock rules for:
  - settings showing the current mode as read-only once saved connections exist
  - quick setup, add connection, and inline import all using the same active mode
  - reset clearing the mode back to `null`
- Unit test on-demand unlock behavior for:
  - first encrypted-local save establishing a passphrase
  - later encrypted-local save prompting unlock only when needed
  - canceling unlock leaving the original action incomplete
  - successful unlock resuming the original action
- Unit test agent import / quick setup parity so legacy inline import buttons do not fall back to an implicit backend.
- Manual verification:
  - choose one mode and save the first connection
  - verify the same first-save behavior holds for legacy inline import/save affordances
  - verify settings now shows the mode as locked/read-only
  - verify add connection, quick setup, and inline `Save to Nile` all use the same mode
  - verify encrypted-local actions prompt unlock only when the user tries to continue a blocked action
  - verify reset clears the mode and re-exposes first-time mode selection

## Data Model Impact

Desktop-local preference or state storage gains:

- `credentialStorageMode: "system_secure_storage" | "encrypted_local_storage" | null`

Desktop connection creation flows may keep transient draft fields for:

- a first-time storage-mode selection before local credential storage has been initialized
- encrypted-local passphrase entry when establishing a brand-new vault

Desktop app-session state gains:

- encrypted-local unlocked session state reused across the current run
- unlock-dialog context for the current blocked action

## Failure And Edge Cases

- If the user closes the first-time mode selection before saving, the connection draft remains unsaved.
- If encrypted-local passphrase confirmation does not match, desktop blocks save and keeps the current draft editable.
- If the encrypted-local vault is locked after app restart, desktop keeps running normally and prompts only when a specific action needs decrypt access.
- If the user dismisses an unlock dialog, encrypted-local-backed actions remain unavailable until the user explicitly unlocks later in the same app run.
- If system-secure storage is unavailable on a platform, desktop may hide the recommendation state but must keep the product-level naming consistent with the shared core contract.
- If older local state already contains mixed legacy connection backends, desktop MUST route the user to explicit recovery/reset instead of pretending the workspace is in a valid single-mode state.
