# Credential Storage Backends Plan

## References

- Spec index: [../../specs/spec.json](../../specs/spec.json)
- Core module: [../../specs/core/module.md](../../specs/core/module.md)
- Surfaces module: [../../specs/surfaces/module.md](../../specs/surfaces/module.md)
- Core feature spec: [../../specs/core/features/credential-storage-backends.md](../../specs/core/features/credential-storage-backends.md)
- Surfaces feature spec: [../../specs/surfaces/features/desktop-credential-storage-choice.md](../../specs/surfaces/features/desktop-credential-storage-choice.md)
- Architecture: [../../architect.md](../../architect.md)

## Plan Principles

- Keep secrets out of SQLite, desktop preferences, logs, and test fixtures.
- Deliver storage-mode contracts before desktop flow work so UI never guesses storage semantics.
- Treat `System secure storage` as a platform-abstracted OS store:
  - macOS Keychain
  - Windows Credential Manager / DPAPI
  - Linux Secret Service or equivalent
- Treat `Encrypted local storage` as the portable/exportable foundation, not a macOS fallback hack.
- Keep one machine-level storage mode per desktop instance:
  - do not allow mixing system-secure and encrypted-local saved connections on the same machine
  - do not keep connection-level backend choice as a long-term model
- After the first saved connection exists, storage mode is locked:
  - changing it requires reset / reinitialize
- Keep each planned feature buildable and verifiable in one end-to-end agent run.

## Milestones

- [Milestone MVP](./milestone-mvp/plan.md)
- [Milestone Reliability](./milestone-reliability/plan.md)
- [Milestone Scale](./milestone-scale/plan.md)
- [Milestone Portability](./milestone-portability/plan.md)

## Cross-Milestone Risks / Spikes

- Cryptography choice is an early spike risk:
  - the implementation must settle on a versioned, authenticated encryption format that works on all desktop platforms without introducing raw-secret regressions
- Storage-mode migration is the main runtime risk:
  - current in-flight work already writes connection-level backend metadata
  - the new plan must collapse mixed/partial state into one machine-level mode without silently re-encrypting secrets
- Unlock lifecycle is a UX risk:
  - on-demand encrypted-local unlock, wrong-passphrase recovery, and reset-as-recovery must stay explicit and understandable
- Future import/export is a product constraint:
  - the local vault format must stay stable and portable enough to support later export/import without redesigning storage semantics
- Portable import/export will introduce a second long-lived contract:
  - runtime vault format may evolve for local operation
  - portable bundle format must remain stable across platforms and app versions
