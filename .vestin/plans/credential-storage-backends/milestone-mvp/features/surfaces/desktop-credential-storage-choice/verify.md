# Verify Log

## Status

- Passed.

## Scope

- Surfaces feature: `desktop-credential-storage-choice`
- Milestone: MVP

## Commands

- `./node_modules/.bin/vitest run apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/renderer/settings/Preferences.test.ts apps/desktop/src/renderer/app/settings/useFlow.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

## Results

- Desktop preferences persist and normalize the nullable global default backend.
- Add-connection flows carry backend choice and encrypted-local passphrase inputs through renderer and main-process save paths.
- System-secure denial produces a recoverable same-flow fallback message.
- Connection switching, saved gateway support probing, and connection model catalog reads can now prompt for encrypted-local unlock and retry once after the vault is unlocked for the current app session.

## Notes

- Passive background reads outside those targeted user-driven flows still remain a follow-up area if broader prompting becomes necessary.
