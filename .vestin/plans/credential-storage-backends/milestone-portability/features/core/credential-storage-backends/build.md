# Build Log

## Build: Portable Bundle Codec And Workflow Foundation

- Added a versioned encrypted portable bundle contract under `packages/core/src/services/credential/`.
- Implemented bundle encode/decode with:
  - `scrypt`
  - `aes-256-gcm`
  - dedicated export passphrase
- Implemented export workflow from saved connections into portable payload records.
- Implemented import preview and apply workflows with:
  - duplicate detection by stable identity key
  - partial selection
  - `skip_existing`
  - `replace_existing`
- Restored imported selected-agent bindings and model selections.

### Verification

- `./node_modules/.bin/vitest run packages/core/src/services/credential/PortableBundleCodec.test.ts packages/core/src/services/credential/PortableWorkflow.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

### Key findings

- The portable bundle format is intentionally separate from the runtime encrypted-local vault file, but reuses the same crypto primitives and credential codec family.
- `replace_existing` currently replaces connection-owned state only. It does not restore history, alerts, usage cache, or UI preferences.
- CLI import/export parity is still deferred; this build only established core portable workflows and desktop-facing contracts.
