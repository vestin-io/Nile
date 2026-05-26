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

## Follow-up Build: Locked Connection Detail Indicator

## Follow-up Build: Machine-Level Storage Mode Convergence

### Tasks Completed

- Replaced the renderer preference concept of `defaultCredentialStorageBackend` with machine-level `credentialStorageMode`, while still loading the legacy preference key for compatibility.
- Added shared renderer derivation for the effective machine storage mode from saved connections plus local preference state.
- Updated quick setup to treat storage selection as first-save setup only; once a machine mode exists, quick setup reuses it and no longer offers a conflicting change action.
- Updated add connection and settings to present storage mode as read-only once saved connections exist, instead of continuing to behave like a mutable per-connection/default backend selector.
- Updated the agents-page inline import entry to stop silently falling back to an implicit backend when no machine mode exists; it now routes the user back into quick setup instead of creating a mixed semantic path.

### Files Changed

- `apps/desktop/src/renderer/shared/CredentialStorageMode.ts`
- `apps/desktop/src/renderer/settings/Preferences.ts`
- `apps/desktop/src/renderer/settings/Preferences.test.ts`
- `apps/desktop/src/renderer/app/settings/usePreferences.ts`
- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/settings/general/Page.tsx`
- `apps/desktop/src/renderer/settings/general/CredentialStorageSection.tsx`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/add/usePageState.ts`
- `apps/desktop/src/renderer/connections/add/useForm.ts`

### Decisions

- Saved connections now win over renderer preference state when deriving the effective machine mode, so an existing workspace cannot be reinterpreted just by stale local preference data.
- The first-save machine mode is only persisted after a successful credential-bearing save; merely continuing past the quick-setup storage screen no longer locks the mode early.
- Agents-page inline import still remains a legacy affordance, but it no longer invents a backend choice on its own; if no machine mode has been established yet, the user is pushed back to the dedicated first-save flow.

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
- `./node_modules/.bin/vitest run apps/desktop/src/renderer/settings/Preferences.test.ts`

### Key Findings

- Renderer save/import flows now consistently behave like consumers of one machine storage mode once any saved connection exists.
- Main-process import/create flows now resolve the effective storage mode from saved connections before writing, so a missed renderer prop no longer creates a second backend silently.
- The renderer preference no longer loads the old `defaultCredentialStorageBackend` key; the surface now only recognizes `credentialStorageMode`.
- Settings no longer acts as a pre-first-save mode picker. Machine mode is established by the first successful credential-bearing save, not by changing a setting ahead of time.

### Tasks Completed

- Surfaced saved connection credential-storage backend metadata through the desktop connection projection so renderer pages can tell when a saved connection is backed by encrypted-local storage.
- Added a locked badge plus tooltip on the connection detail header when an encrypted-local connection is still locked for the current app session.
- Moved the locked affordance to the global settings header near the notification bell, made it clickable to reopen the unlock dialog, and reworked its warning styling for light-theme contrast without the earlier pulse animation.
- Improved the dark-theme locked button contrast and sanitized encrypted-local unlock failures into user-facing messages, including a separate corrupted-vault path for structurally unreadable vault files.
- Replaced renderer-side unlock error string guessing with a structured `desktop:unlock-encrypted-local-storage` result code, so expected unlock failures no longer surface as Electron handler exceptions or raw IPC messages.
- Added explicit encrypted-local unlock gates to add-connection, quick setup, and connection edit flows so save/update actions are blocked while an existing encrypted-local vault is still locked, with a direct `Unlock now` action rendered in-page.

### Files Changed

- `packages/core/src/models/connection/SavedConnections.ts`
- `apps/desktop/src/state/Types.ts`
- `apps/desktop/src/state/connection/List.ts`
- `apps/desktop/src/state/connection/Status.ts`
- `apps/desktop/src/renderer/app/settings/Chrome.tsx`
- `apps/desktop/src/renderer/app/settings/useCredentialStorageSession.ts`
- `apps/desktop/src/renderer/shared/EncryptedLocalUnlock.ts`
- `apps/desktop/src/renderer/shared/EncryptedLocalUnlock.test.ts`
- `apps/desktop/src/renderer/shared/EncryptedLocalUnlockGate.tsx`
- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/connections/list/Page.tsx`
- `apps/desktop/src/renderer/connections/detail/Page.tsx`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/edit/Page.tsx`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/quick-setup/StorageStep.tsx`
- `apps/desktop/src/renderer/quick-setup/DetectedSetup.tsx`
- `apps/desktop/src/renderer/quick-setup/DetectedSetupAction.tsx`
- `apps/desktop/src/renderer/quick-setup/AgentCard.tsx`
- `apps/desktop/src/renderer/settings/general/CredentialStorageSection.tsx`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`
- `packages/core/src/services/credential/Store.ts`
- `packages/core/src/services/credential/index.ts`
- `packages/core/src/services/credential/EncryptedLocalCredentialStore.ts`
- `packages/core/src/services/credential/EncryptedLocalCredentialStore.test.ts`
- `apps/desktop/src/electron/connections/contracts.ts`
- `apps/desktop/src/electron/ipc/DesktopIpcConnectionRoutes.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- `system_secure_storage` / keychain-backed connections are unaffected by the session unlock state; the new lock affordance is only shown for encrypted-local connections while the vault remains locked.
- The saved connection summary keeps the backend field optional at the type boundary for fixture compatibility, but runtime summaries now always populate `system_secure_storage` or `encrypted_local_storage`.
- The locked indicator now lives in the global settings header near the notification bell rather than inside connection detail content, because the lock state is session-wide storage state, not a property of one specific detail section.
- The first warning-style version relied too much on subtle amber opacity and a breathing effect; the final button uses stable high-contrast warning colors so it remains visible in light theme and feels less noisy.
- Dark theme needed a separate contrast pass as well; the current warning button uses a brighter amber fill and border there instead of just a faint tint over the dark header.
- The unlock dialog no longer shows raw Electron IPC error strings. It now maps failures into user-facing messages and distinguishes clearly corrupted vault files from generic passphrase-or-authentication failures, but cryptographic authentication failures still cannot perfectly separate “wrong passphrase” from “tampered ciphertext.”
- Unlock failure handling is now keyed off a stable IPC result code rather than renderer substring matching on `error.message`, which removes a brittle dependency on exception text staying unchanged across core and Electron layers.
- Existing encrypted-local vaults are now treated as a hard gate for add/save/update flows until the user unlocks them for the current app session; only the “first-time vault setup” path remains allowed without a prior unlock because it creates the vault rather than reopening it.

## Follow-up Build: On-demand Unlock Prompts

### Tasks Completed

- Removed the startup auto-unlock flow so Nile no longer opens an unlock dialog just because an encrypted-local vault exists.
- Replaced the in-page `Unlock now` gates with on-demand unlock prompts that appear only when the user tries to continue quick setup, save a detected local setup, save a new connection, or update an encrypted-local connection.
- Added contextual hint copy inside the unlock dialog so each interaction explains what action is blocked until the user unlocks encrypted local storage.
- Removed the temporary `EncryptedLocalUnlockGate` component and kept the header badge as the persistent manual unlock affordance.

### Files Changed

- `apps/desktop/src/renderer/app/settings/useCredentialStorageSession.ts`
- `apps/desktop/src/renderer/app/settings/Dialogs.tsx`
- `apps/desktop/src/renderer/connections/dialogs/UnlockEncryptedLocalStorage.tsx`
- `apps/desktop/src/renderer/shared/EncryptedLocalAccess.tsx`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/quick-setup/StorageStep.tsx`
- `apps/desktop/src/renderer/quick-setup/DetectedSetup.tsx`
- `apps/desktop/src/renderer/quick-setup/DetectedSetupAction.tsx`
- `apps/desktop/src/renderer/quick-setup/AgentCard.tsx`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/edit/Page.tsx`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`
- `apps/desktop/src/renderer/shared/EncryptedLocalUnlockGate.tsx`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- The better interaction model here is session-level unlock on demand, not proactive gating at page load. Users can still browse and inspect the app while the vault remains locked, and Nile only interrupts when a concrete action actually needs decrypted credentials.
- `system_secure_storage` / keychain-backed connections remain unaffected by this session lock state; only encrypted-local flows request the unlock dialog.
- The same unlock dialog now serves both the header shortcut and blocked action flows, but only action-triggered requests carry a contextual hint about what will continue after unlock.

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

## Follow-up Build: Connections List Refresh Unlock

### Tasks Completed

- Wrapped the connections list toolbar refresh action in the same encrypted-local unlock recovery used by the detail-page refresh path.
- Added a dedicated unlock hint for refreshing saved connections so the dialog text matches the list-level action instead of reusing the single-connection wording.
- Localized the new refresh hint across all supported desktop languages.

### Files Changed

- `apps/desktop/src/renderer/connections/list/Page.tsx`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`
- `apps/desktop/src/renderer/shared/i18n/de.ts`
- `apps/desktop/src/renderer/shared/i18n/es.ts`
- `apps/desktop/src/renderer/shared/i18n/fr.ts`
- `apps/desktop/src/renderer/shared/i18n/it.ts`
- `apps/desktop/src/renderer/shared/i18n/ja.ts`
- `apps/desktop/src/renderer/shared/i18n/ko.ts`
- `apps/desktop/src/renderer/shared/i18n/th.ts`
- `apps/desktop/src/renderer/shared/i18n/vi.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- The earlier unlock coverage only wrapped the connection detail refresh button, so the list-level toolbar refresh still bypassed the dialog and looked inconsistent.
- The list-level refresh now prompts only when there is at least one saved encrypted-local connection and the current session is still locked; keychain/system-secure connections remain unaffected.

## Follow-up Build: Agent Import Uses Default Backend

### Tasks Completed

- Wrapped the legacy `Agents` page import action so it now forwards the current default credential storage backend instead of silently falling back to the session default.
- Added the same encrypted-local unlock prompt to that agent import path when the current default backend is encrypted local storage and the vault exists but is still locked.

### Files Changed

- `apps/desktop/src/renderer/app/settings/App.tsx`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- The `Quick setup` flow already passed an explicit backend, but the older inline `Save to Nile` action on the `Agents` page still called `importCurrentConnection(agentId)` with no backend input, which caused main-process logs to show `credentialStorageBackend:"default"`.
- After this fix, the `Agents` page import path now follows the same default-backend intent as the rest of the desktop flows; encrypted-local defaults will no longer silently save through the session fallback without an unlock prompt.

## Follow-up Build: Platform-Specific System Storage Copy

### Tasks Completed

- Updated desktop renderer credential-storage copy so the system-secure option can name the platform-specific password manager instead of always describing a generic or Mac-specific store.
- Removed several English `This Mac` references from quick setup and credential-storage flows in favor of device-neutral copy.
- Switched desktop Windows main-process wiring to the new core Windows Credential Manager backend and removed the now-unused desktop file-backed credential store path.

### Files Changed

- `apps/desktop/src/electron/shell/DesktopMain.ts`
- `apps/desktop/src/electron/credentials/DesktopCredentialStore.ts`
- `apps/desktop/src/renderer/shared/Platform.ts`
- `apps/desktop/src/renderer/shared/Platform.test.ts`
- `apps/desktop/src/renderer/app/settings/usePreferences.ts`
- `apps/desktop/src/renderer/quick-setup/StorageStep.tsx`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/dialogs/CredentialStorage.tsx`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`
- `apps/desktop/src/renderer/shared/i18n/de.ts`
- `apps/desktop/src/renderer/shared/i18n/es.ts`
- `apps/desktop/src/renderer/shared/i18n/fr.ts`
- `apps/desktop/src/renderer/shared/i18n/it.ts`
- `apps/desktop/src/renderer/shared/i18n/ja.ts`
- `apps/desktop/src/renderer/shared/i18n/ko.ts`
- `apps/desktop/src/renderer/shared/i18n/th.ts`
- `apps/desktop/src/renderer/shared/i18n/vi.ts`

### Verification Commands Run

- `npx vitest run apps/desktop/src/renderer/shared/Platform.test.ts`
- `npm run typecheck`

### Key Findings

- The credential-storage option now names `Apple Keychain` on macOS and `Windows Credential Manager` on Windows while keeping a generic fallback for unsupported/unknown desktop platforms.
- The renderer still carries some non-English legacy "this Mac" wording outside the credential-storage path; this round limited the cleanup to the flows directly touched by storage-mode selection and unlock messaging.
- Windows environment-secret persistence still uses the desktop-local encrypted JSON file path for managed environment variables; this round only changed saved connection credential storage.

## Follow-up Build: Machine-Level Storage Mode Finalization

### Tasks Completed

- Stopped exposing per-connection credential backend metadata to renderer connection state and moved machine-level storage-mode derivation into `SettingsState.advanced`.
- Updated desktop settings, quick setup, add-connection, and agent-import flows to treat storage mode as a machine-level choice rather than a per-connection default.
- Added explicit mixed-state handling: if older local state contains saved connections across multiple backends, desktop now treats that as reset-required instead of allowing more saves.
- Tightened desktop IPC contracts so storage-mode inputs only appear on create/import-first-save paths, not on connection update flows.

### Files Changed

- `apps/desktop/src/state/Types.ts`
- `apps/desktop/src/state/SettingsQuery.ts`
- `apps/desktop/src/state/connection/List.ts`
- `apps/desktop/src/state/connection/Status.ts`
- `apps/desktop/src/renderer/shared/CredentialStorageMode.ts`
- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/settings/general/CredentialStorageSection.tsx`
- `apps/desktop/src/renderer/settings/general/Page.tsx`
- `apps/desktop/src/renderer/quick-setup/Page.tsx`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/electron/connections/contracts.ts`
- `apps/desktop/src/electron/ipc/DesktopIpcInputValidator.ts`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
- `./node_modules/.bin/vitest run apps/desktop/src/renderer/settings/Preferences.test.ts packages/core/src/services/credential/EncryptedLocalCredentialStore.test.ts`

### Key Findings

- Renderer no longer needs to infer machine-level mode by reading `credentialStorageBackend` off every projected connection; that backend remains internal storage metadata only.
- A stored machine mode without saved connections is still treated as locked/established, which preserves current behavior when users delete all connections without resetting local state.
- Mixed backend state remains detectable from older saved access records, but desktop now surfaces it as a reset-required condition instead of allowing additional creates/imports to silently extend the split state.

## Follow-up Build: Mixed-State Connections Become Read-Only

### Tasks Completed

- Added reset-required blocking to connections list/detail/edit flows when saved connections on this Mac still span multiple storage backends.
- Disabled detail-page edit/refresh actions in mixed state and surfaced the same destructive reset guidance already used by quick setup and add-connection.

### Files Changed

- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/connections/list/Page.tsx`
- `apps/desktop/src/renderer/connections/detail/Page.tsx`
- `apps/desktop/src/renderer/connections/detail/ActionGroup.tsx`
- `apps/desktop/src/renderer/connections/edit/Page.tsx`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- Once per-connection backend stopped being a renderer-facing concept, the safe recovery path for legacy mixed installs is to make existing connection management read-only until reset, not to keep trying to infer unlock behavior per row.
- This keeps the single-mode product rule honest without silently hiding existing saved connections from users who still need to inspect them before resetting.

## Follow-up Build: Settings App Structure Split

### Tasks Completed

- Extracted `SettingsPageContent` prop assembly from `App.tsx` into `usePageContentProps.ts` so the top-level settings renderer stays under the repository 500-line file limit.

### Files Changed

- `apps/desktop/src/renderer/app/settings/App.tsx`
- `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- `apps/desktop/src/renderer/app/settings/usePageContentProps.ts`

### Verification Commands Run

- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key Findings

- This split is structural only. The extracted hook preserves the existing settings-page callback wiring and lets pre-push structure checks pass without changing credential-storage behavior.

## Follow-up Build: Desktop Machine-Mode Tests Aligned

### Tasks Completed

- Updated `DesktopConnectionManager` tests so first-save add/draft/import paths explicitly pass the machine-level storage mode that the product now requires.
- Added `listSavedConnections()` stubs for session doubles that now need an established storage mode during import and batch-import flows.

### Files Changed

- `apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`

### Verification Commands Run

- `./node_modules/.bin/vitest run apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`

### Key Findings

- The new machine-level mode invariant is exercised directly in desktop tests now; fixtures can no longer rely on implicit `system_secure_storage` fallback.

## Follow-up Build: System-Secure Copy Cleanup

### Tasks Completed

- Removed the remaining non-English desktop reset strings that still described system-secure credentials as `keychain`-managed after the Windows Credential Manager rollout.
- Kept the platform-specific storage-option naming work intact while making the destructive reset warning platform-neutral across every supported desktop locale touched by that flow.

### Files Changed

- `apps/desktop/src/renderer/shared/i18n/de.ts`
- `apps/desktop/src/renderer/shared/i18n/es.ts`
- `apps/desktop/src/renderer/shared/i18n/fr.ts`
- `apps/desktop/src/renderer/shared/i18n/it.ts`
- `apps/desktop/src/renderer/shared/i18n/ja.ts`
- `apps/desktop/src/renderer/shared/i18n/ko.ts`
- `apps/desktop/src/renderer/shared/i18n/th.ts`
- `apps/desktop/src/renderer/shared/i18n/vi.ts`

### Verification Commands Run

- `npm run typecheck`

### Key Findings

- The reset confirmation no longer names a macOS-only credential store on Windows or other platforms, even in non-English locales.
- Several non-English storage-option strings still rely on English fallback keys for the newer platform-specific system-store description; this follow-up only corrected the stale reset wording.

## Follow-up Build: Managed Env Local-Store Support

### Tasks Completed

- Added a desktop environment storage-mode reader so managed `NILE_*` API-key values now follow the machine-level credential storage mode instead of hardcoding macOS to the keychain-backed environment store.
- Updated `DesktopEnvironmentStore` to re-evaluate the current machine-level mode from local state on each access:
  - Windows still keeps the existing desktop file-backed environment store path.
  - macOS now uses the desktop file-backed environment store when the machine mode is `encrypted_local_storage`.
  - The first-save flow no longer requires an app restart before managed env writes switch over to the local store.
- Kept external shell-backed managed env flows working for the current OpenClaw-style path by mirroring to the system store only when shell export wiring is still required.
- Added regression coverage for:
  - machine-mode resolution from saved connections vs desktop preferences
  - macOS file-backed managed env persistence in encrypted-local mode
  - dynamic in-session mode switching for the environment store
  - shell-backed mirror behavior and mirror cleanup in managed-env orchestration

### Files Changed

- `apps/desktop/src/electron/environment/StorageMode.ts`
- `apps/desktop/src/electron/environment/StorageMode.test.ts`
- `apps/desktop/src/electron/environment/Store.ts`
- `apps/desktop/src/electron/environment/Store.test.ts`
- `apps/desktop/src/electron/environment/Shell.ts`
- `apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.ts`
- `apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts`

### Verification Commands Run

- `npx vitest run apps/desktop/src/electron/environment/StorageMode.test.ts apps/desktop/src/electron/environment/Store.test.ts apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.test.ts apps/desktop/src/electron/environment/Shell.test.ts`
- `npm run build -w @nile/desktop`
- `npm run typecheck`

### Key Findings

- The key startup prompt was not coming from saved-connection credentials anymore; it was coming from the separate managed-environment store still reading macOS keychain entries even after the machine mode had moved to encrypted local storage.
- Re-evaluating the machine mode on each environment-store access is necessary. Caching the backend at app startup would still leave same-session first-save/import flows on the old keychain path until restart.
- This pass does not remove legacy `nile.switcher.environment` keychain entries that older desktop builds may already have written. In encrypted-local mode Nile now stops reading them for normal desktop-managed API-key flows, but shell-backed flows that still need external env export keep using a controlled system-store mirror until a file-backed shell bridge exists.
