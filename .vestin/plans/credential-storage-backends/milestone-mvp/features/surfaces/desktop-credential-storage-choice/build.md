# Build Log

## Status

- Built.

## Scope

- Surfaces feature: `desktop-credential-storage-choice`
- Milestone: MVP

## Tasks Completed

- `PC-101` Confirmed credential-bearing desktop creation flows enter through add/prepare/save connection routes in the settings renderer and `DesktopConnectionManager`.
- `PC-102` Confirmed desktop preference storage already loads in renderer app state and can safely own a desktop-local nullable default backend.
- `B-101` Added `defaultCredentialStorageBackend` to desktop preferences with normalization and restart persistence.
- `B-102` Added backend selection to add/create connection flows and threaded the chosen backend through renderer, preload, IPC, and main-process save paths.
- `B-103` Added encrypted-local passphrase establish/unlock UI for connection creation and session-local unlock wiring in the desktop main process.
- `B-104` Added explicit system-secure denial fallback messaging and a renderer unlock dialog that retries connection switching after restart when encrypted-local storage is locked.
- `B-105` Reworked desktop credential-storage UX so add-connection uses an in-page selector plus submit-time modal requirements, and quick setup now uses the same backend choice rules instead of a bypass import path.

## Files Changed

- `apps/desktop/src/electron/connections/contracts.ts`
- `apps/desktop/src/electron/connections/DesktopPreparedDraftStore.ts`
- `apps/desktop/src/electron/connections/DesktopConnectionManager.ts`
- `apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`
- `apps/desktop/src/electron/ipc/DesktopIpcInputValidator.ts`
- `apps/desktop/src/electron/ipc/DesktopIpcConnectionRoutes.ts`
- `apps/desktop/src/electron/preload.ts`
- `apps/desktop/src/electron/shell/DesktopMain.ts`
- `apps/desktop/src/renderer/settings/Preferences.ts`
- `apps/desktop/src/renderer/settings/Preferences.test.ts`
- `apps/desktop/src/renderer/connections/add/Types.ts`
- `apps/desktop/src/renderer/connections/add/useForm.ts`
- `apps/desktop/src/renderer/connections/add/usePageState.ts`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/dialogs/CredentialStorage.tsx`
- `apps/desktop/src/renderer/connections/dialogs/UnlockEncryptedLocalStorage.tsx`
- `apps/desktop/src/renderer/app/settings/useConnectionActions.ts`
- `apps/desktop/src/renderer/app/settings/Dialogs.tsx`
- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`
- `apps/desktop/src/electron/connections/DesktopConnectionGateway.ts`
- `apps/desktop/src/electron/connections/Imports.ts`

## Decisions

- Kept backend choice inside credential-bearing connection flows instead of early onboarding so users only decide storage mode at the moment a credential is about to be saved.
- Treated the global default backend strictly as a desktop-local default for future connections; existing saved connections are not rewritten.
- Used a dedicated unlock dialog plus one retry for connection switching instead of trying to silently recover locked encrypted-local credentials in the background.
- Surfaced system-secure denial as a recoverable same-form error that points users back to the already-visible `Encrypted local storage` choice instead of silently downgrading storage behavior.
- Moved passphrase/default confirmation out of the main add-connection page and into a shared requirements dialog so selector state stays visible in-page while blocking requirements only appear when the user actually commits.

## Verification Commands Run

- `./node_modules/.bin/vitest run apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/renderer/settings/Preferences.test.ts apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

## Fix / Re-run Rounds

- Round 1: `DesktopConnectionManager.test.ts` failed because credential-store test doubles and reuse expectations were still coupled to the old string-only credential target shape. Updated the stubs and denial mapping, then re-ran the suite successfully.
- Round 2: review follow-up found two remaining behavior gaps: draft preparation was creating the encrypted-local vault too early, and restart unlock recovery only covered connection switching. Added a shared renderer unlock-retry helper, wired it into gateway support probing and model catalog reads, then re-ran the focused desktop suite successfully.

## How To Run / Verify Locally

- Run the focused desktop suite:
  - `./node_modules/.bin/vitest run apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/renderer/settings/Preferences.test.ts apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- Run renderer/node typecheck:
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

## Key Findings

- The desktop-global backend default now persists locally across app restarts and only affects future connection creation, not existing saved connections.
- Encrypted-local unlock prompting is now wired for connection switching, saved gateway support probing, and connection model catalog reads after restart; broader background reads such as passive usage refresh still remain on their existing non-dialog behavior.
- System-secure denial now stays explicit: the current flow shows a recoverable error and leaves the backend choice visible so the user can deliberately switch to `Encrypted local storage`.
- Quick setup no longer saves current local sessions through an unconfigurable direct path; it now carries the chosen backend and passphrase requirements through the same desktop credential-storage flow before import.

## Follow-up Build

### Tasks Completed

- Split quick setup into a dedicated credential-storage step plus a separate agent-save step.
- Added a machine-level default credential storage selector to desktop settings.
- Kept encrypted-local passphrase setup/unlock behind the shared credential storage dialog instead of reintroducing inline passphrase fields.

### Files Changed

- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/quick-setup/StorageStep.tsx`
- `apps/desktop/src/renderer/connections/dialogs/CredentialStorage.tsx`
- `apps/desktop/src/renderer/settings/general/Page.tsx`
- `apps/desktop/src/renderer/settings/general/CredentialStorageSection.tsx`
- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`

### Decisions

- Quick setup now treats credential storage as its own first-class screen instead of a selector embedded above the agent list; the passphrase modal only appears when that chosen storage mode still needs setup or unlock.
- Settings owns the long-lived machine default, while quick setup still allows a one-off backend choice for the current session if the user leaves "remember default" unchecked.

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/vitest run apps/desktop/src/renderer/settings/Preferences.test.ts apps/desktop/src/renderer/app/settings/useFlow.test.ts`

### Key Findings

- Quick setup now has a real two-step structure, but the animated storage step currently uses CSS transitions only; no deeper motion system was added.
- Wrong encrypted-local passphrases are now surfaced inline in the shared credential storage dialog, but the dialog still does not show a distinct loading state while unlock is in flight.
- Settings can now establish or unlock encrypted-local storage before saving the default backend, but it intentionally does not offer a way to clear the default back to `null`.
- Quick setup now treats the storage step as an explicit machine-default decision and no longer shows a separate "remember this choice" checkbox there.
- Quick setup no longer reopens the storage-choice first step on every app launch just because encrypted local storage is locked for the current session; existing defaults now stay in place and unlock is deferred until the user actually saves a setup.
- Quick setup now marks a card as saved as soon as the save request succeeds in the current renderer session, so a locked encrypted-local connection on the next refresh no longer leaves that card stuck in perpetual saving.
- Quick setup no longer waits for the follow-up full settings refresh before resolving `Save to Nile`; the import request now returns as soon as the save itself succeeds, and refresh continues in the background.
- The optimistic "saved" marker now also covers the branch where quick setup first opens the encrypted-local unlock/passphrase dialog and only saves after that dialog succeeds; previously that modal path still left the card spinning.
- Added structured desktop import logs across `desktop:import-current-connection` so stuck quick-setup saves can now be traced stage-by-stage through IPC, state store, gateway, session import, and managed API-key environment sync without logging credential material.
- Quick setup save actions now distinguish between "real save started" and "requirements dialog needed first"; clicking a card that only opens the encrypted-local unlock/passphrase dialog no longer leaves the card stuck in a pre-import spinner before any IPC call is made.

## Follow-up Build: Session Unlock And Reset Recovery

### Tasks Completed

- Rewrote the desktop credential-storage interaction rules to treat encrypted-local unlock as startup/session behavior instead of primarily per-action prompting.
- Changed desktop reset so it clears the machine default credential-storage backend alongside the normal quick-setup reset behavior.
- Added a startup unlock check in the settings renderer that prompts once per app run when an encrypted-local vault exists and is still locked.
- Removed the add-connection "remember default" sub-flow and made the first no-default add flow persist the chosen backend automatically.
- Relaxed storage-choice steps so an existing locked vault no longer blocks choosing `Encrypted local storage`; passphrase setup is still required only when creating a brand-new vault.

### Files Changed

- `.vestin/specs/core/features/credential-storage-backends.md`
- `.vestin/specs/surfaces/features/desktop-credential-storage-choice.md`
- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/app/settings/useFlow.ts`
- `apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/add/usePageState.ts`
- `apps/desktop/src/renderer/connections/dialogs/CredentialStorage.tsx`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/settings/general/CredentialStorageSection.tsx`
- `apps/desktop/src/electron/shell/DesktopMain.ts`

### Decisions

- Startup unlock is now the primary way to re-open encrypted-local storage for the current app run; action-level unlock prompts remain only as fallback for flows that still require credential access after the startup prompt was dismissed.
- Desktop reset now treats forgotten encrypted-local passphrases as a recovery case by clearing the machine default backend in renderer preferences and clearing unlocked key material in the current process.
- The first add-connection flow with no stored default no longer asks a second "remember this choice" question; the selector choice itself becomes the machine default for future saves.

### Verification Commands Run

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- Reset now re-exposes quick setup storage selection by clearing `defaultCredentialStorageBackend`, but it intentionally leaves unrelated UI preferences such as language, theme, and quota-display preferences intact.
- Startup unlock prompting is implemented once per renderer app run and intentionally does not block the app shell from rendering first.
- Existing action-level unlock hooks still exist as fallback paths, so this slice is now startup-first rather than startup-only.
- There is still no dedicated renderer test for the startup unlock orchestration in `SettingsApp`; this round is covered by typecheck plus the reset preference test.

## Follow-up Build: Shared Credential Storage State And Reset Event

### Tasks Completed

- Promoted credential-storage state to a shared renderer value owned by `SettingsApp` and passed it into quick setup, add connection, and settings instead of letting each page fetch-and-cache its own copy.
- Added an explicit `desktop:local-state-reset` renderer event so reset clears the machine default backend and quick-setup dismissal state as part of reset semantics, not as a settings-page-only side effect.
- Updated quick setup so reset immediately reopens the storage step and startup unlock/passphrase changes are reflected without requiring a page reload.
- Updated add connection to reuse the shared credential-storage state and refresh it after encrypted-local unlock before continuing save/prepare flows.
- Fixed startup unlock orchestration so it waits for the first real credential-storage read before deciding whether the one-time session unlock prompt should appear.

### Files Changed

- `apps/desktop/src/electron/ipc/DesktopIpcStateRoutes.ts`
- `apps/desktop/src/electron/preload.ts`
- `apps/desktop/src/electron/shell/DesktopMain.ts`
- `apps/desktop/src/electron/shell/DesktopShell.ts`
- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/app/settings/useFlow.ts`
- `apps/desktop/src/renderer/app/settings/usePreferences.ts`
- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/add/usePageState.ts`
- `apps/desktop/src/renderer/globals.d.ts`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`

### Decisions

- Reset now broadcasts a renderer event because the machine default backend lives in renderer preferences rather than main-process state; this keeps reset semantics consistent for every caller of `window.nileDesktop.connections.resetState()`.
- Shared credential-storage state stays renderer-local in `SettingsApp` instead of introducing a new global store, because the affected surfaces already share the same settings window tree.
- Startup unlock remains once-per-session, but the “already checked” flag now waits for the initial credential-storage load so a default `false/false` placeholder cannot suppress the first real unlock prompt.

### Verification Commands Run

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- Quick setup, add connection, and settings now observe the same credential-storage state, so startup unlock or vault creation in one flow is immediately visible to the others.
- Reset semantics now clear the machine default backend through a renderer event rather than a page-specific helper, which makes reset behavior consistent across future entry points.
- There is still no renderer behavior test that exercises the full startup unlock dialog lifecycle; this change is currently covered by typecheck plus the reset helper test.

## Follow-up Build: Add Connection Review Fixes

### Tasks Completed

- Restored encrypted-local unlock error feedback in the add-connection storage dialog so wrong passphrases surface inline instead of silently stalling the flow.
- Made the add-connection form follow reset semantics for the machine default backend by reverting to `system_secure_storage` when reset clears the default and the form was still following the old default value.

### Files Changed

- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/add/useForm.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- `Add connection` now reports encrypted-local unlock failures the same way quick setup and settings already did, but this path still lacks a focused renderer test.
- Reset now correctly clears the default-backend assumption even for an already-open add-connection form, while preserving a user's manual override if they had already changed the selector away from the old default.

## Follow-up Build: Startup Unlock Visibility And Quick Setup Save Errors

### Tasks Completed

- Made startup encrypted-local unlock visibly open the settings window before presenting the once-per-session unlock dialog so the prompt is not trapped in a hidden renderer.
- Routed quick-setup import/save failures through the shared settings action error surface, including the branch where unlock succeeds first and the actual save fails afterwards.
- Stopped quick setup from writing post-unlock save failures back into the credential-storage dialog state after that dialog has already closed.

### Files Changed

- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/app/settings/useConnectionActions.ts`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- Startup unlock is now user-visible by construction because it forces the settings surface open before the unlock dialog is requested.
- Quick setup save failures now land in the shared destructive alert banner instead of disappearing into a closed passphrase dialog.

## Follow-up Build: Surface Test Realignment

### Tasks Completed

- Updated the desktop `Surface` expectations to match the current saved-connection projection for active Azure Codex connections, including `agentModelId` and `selectedByAgents`.

### Files Changed

- `apps/desktop/src/state/Surface.test.ts`

### Verification Commands Run

- `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts`
- `npm test`

### Key Findings

- The desktop surface behavior itself did not regress in this round; the failing assertion was an outdated test expectation after the newer connection projection started carrying model/selection metadata on the current connection.
