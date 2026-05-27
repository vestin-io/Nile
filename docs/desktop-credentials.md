# Desktop Credential Storage

This document explains how Nile stores credentials on a desktop machine and how the desktop import/export flow works.

## Storage Modes

Each machine uses one credential storage mode at a time:

- `System secure storage`
- `Encrypted local storage`

Nile treats this as a machine-level choice, not a per-connection toggle. Once the machine has saved its first connection, the storage mode is established and stays locked until the local state is reset.

### System secure storage

`System secure storage` is the platform-native secure store abstraction.

Examples:

- macOS: Keychain
- Windows: Credential Manager / platform-secure store integration
- Linux: future system-secure-store integration

Use this when you want native OS protection and do not need a portable credential bundle.

### Encrypted local storage

`Encrypted local storage` stores credentials inside a Nile-managed encrypted vault on the local machine.

Use this when you want:

- a passphrase-protected local vault
- a portable base for export/import
- a storage mode that can move across machines through Nile migration packages

## Unlock Behavior

When a machine uses `Encrypted local storage`, Nile may need to unlock the vault before it can continue a credential-sensitive action.

Examples:

- switching to a saved connection
- refreshing encrypted-local-backed connection data
- saving a new connection
- updating an existing connection
- exporting a migration package

Nile does not require unlock for unrelated actions, and it does not block connections that use `System secure storage`.

Unlock is session-scoped:

- unlock once for the current app run
- close Nile
- unlock again on the next run if needed

## Migration Packages

Nile exports and imports encrypted migration packages with the `.nilevault` file extension.

These files are:

- Nile-specific
- encrypted
- portable across machines and operating systems

They are not:

- a raw Keychain export
- a Windows Credential Manager export
- a copy of Nile's runtime local vault file

### What a migration package contains

A `.nilevault` file contains a portable, encrypted Nile bundle with:

- selected saved connections
- connection metadata needed to restore them
- the associated secret payloads

It does not currently target history, UI preferences, or usage cache.

### Export passphrase vs unlock passphrase

These are different:

- `Unlock passphrase`
  - unlocks the local encrypted storage vault on the current machine
- `Export passphrase`
  - encrypts the `.nilevault` file you are creating

If the machine uses `Encrypted local storage` and the vault is still locked, Nile first asks you to unlock it. After that, Nile asks for a dedicated export passphrase for the migration package itself.

## Desktop Export Flow

The desktop export entry lives on the **Connections** page.

Export flow:

1. Select one or more saved connections in the Connections list.
2. Click `Export`.
3. If needed, unlock encrypted local storage.
4. Enter and confirm an export passphrase.
5. Choose where to save the `.nilevault` file.
6. Nile writes the encrypted migration package.

Notes:

- export from the Connections page is multi-select
- if nothing is selected, export is disabled
- the export dialog appears before the native save panel so you can set the export passphrase first

## Desktop Import Flow

The desktop import entry also lives on the **Connections** page.

Import flow:

1. Click `Import`.
2. Choose a `.nilevault` file.
3. Enter the package passphrase.
4. Review the import preview.
5. Select which connections to import.
6. Choose a duplicate strategy:
   - `Skip existing`
   - `Replace existing`
7. Confirm import.

If the current machine has not established a storage mode yet, Nile will ask you to choose one before it writes imported credentials.

If the target mode is `Encrypted local storage`, Nile may also require local vault setup or unlock before finishing the import.

## Duplicate Handling

Nile detects duplicates using connection identity information.

When duplicates are found, import supports:

- `Skip existing`
- `Replace existing`

`Replace existing` replaces the connection body, including secret and connection-level metadata needed to restore the imported connection.

## Reset and Recovery

If you forget the local encrypted-storage passphrase, the recovery path is to reset local Nile state and re-establish the machine storage mode.

Reset clears:

- the machine storage mode
- encrypted local storage state
- saved local credential state managed by Nile

After reset, Nile treats the machine as uninitialized again.
