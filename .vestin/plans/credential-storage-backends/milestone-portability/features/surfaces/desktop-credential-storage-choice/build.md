# Build Log

## Build: Desktop Portable Import / Export Wiring

- Added desktop IPC contracts for:
  - export preview
  - export apply
  - import preview
  - import apply
  - export/import file picking
- Added desktop main-process portability gateway to orchestrate:
  - current machine storage-mode checks
  - mixed-state blocking
  - bundle file read/write
  - import target-mode resolution
- Added settings UI for credential portability:
  - export action
  - import action
  - storage-mode summary
- Added desktop dialogs for:
  - export bundle passphrase setup
  - import bundle preview and selection
  - import result summary
- Added import support for choosing a target storage mode when the machine has not yet established one.
- Added import support for creating or unlocking encrypted local storage before writing imported credentials.
- Decoupled import success from the follow-up settings refresh so a completed import still shows a success result even if later view refresh fails.
- Switched the default export bundle filename to the local machine date instead of UTC.
- Added explicit portability translations for the non-English desktop locales instead of relying on English fallback.
- Fixed `SettingsApp` hook ordering so credential portability state is initialized before any loading/error early return branches.
- Added import/export actions to the Connections page toolbar.
- Added multi-select export from the current Connections list/table instead of forcing export-all from that surface.
- Renamed the portable bundle file extension from `.nilebundle` to `.nilevault`.
- Removed the Settings-page import/export section so the primary portability entry lives on the Connections page.
- Restyled the Connections-page actions as a segmented button group for import, export, add connection, and refresh.
- Export now participates in the same encrypted-local unlock flow as refresh/save actions: if the machine mode is `encrypted_local_storage` and the vault is still locked, Nile prompts for unlock before opening the export path/passphrase steps.
- Added a dedicated unlock hint for export and translated it across the desktop locale set.
- Reordered export UX so Nile opens the export passphrase dialog first, then asks for the filesystem save path at submit time. This avoids the native save panel looking like an immediate export before the user has provided an export passphrase.
- Tightened portability wording across all desktop locales so the UI consistently refers to a localized “migration package” concept rather than leaving `bundle` as an English loanword.
- Changed the export dialog’s file field to represent the default file name instead of implying that a concrete save path has already been chosen.
- Updated `README.md` and added `docs/desktop-credentials.md` so the public docs reflect machine-level storage modes, encrypted local unlock behavior, `.nilevault` migration packages, and the Connections-page import/export entry points.
- Corrected the public README surface/status section so it reflects current Windows desktop support instead of the older macOS-only wording.

### Verification

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key findings

- Import/export now lives on the Connections page only. Settings no longer exposes a duplicate portability section.
- Import failures that occur while writing into a target store still surface as normal action errors. Expected credential-store failures are user-readable, but import/export does not yet use a fully structured result code contract the way encrypted-local unlock does.
- Connections-page export currently scopes to the user's explicit selection. If nothing is selected, export is disabled instead of silently falling back to export-all.
- The public docs now describe the current desktop portability model, but they do not yet cover future CLI parity because CLI import/export is intentionally still out of scope for this milestone.
