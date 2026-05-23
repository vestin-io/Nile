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
- Deliver backend contracts before desktop flow work so UI never guesses storage semantics.
- Treat `Encrypted local storage` as a cross-platform backend, not a macOS fallback hack.
- Keep this slice additive:
  - no migration for existing saved connections
  - no in-place backend switching for already saved connections
- Keep each planned feature buildable and verifiable in one end-to-end agent run.

## Milestones

- [Milestone MVP](./milestone-mvp/plan.md)
- [Milestone Reliability](./milestone-reliability/plan.md)
- [Milestone Scale](./milestone-scale/plan.md)

## Cross-Milestone Risks / Spikes

- Cryptography choice is an early spike risk:
  - the implementation must settle on a versioned, authenticated encryption format that works on all desktop platforms without introducing raw-secret regressions
- Unlock lifecycle is a UX risk:
  - the first encrypted-local unlock, relaunch unlock, and wrong-passphrase recovery flows must stay explicit and understandable
- Existing connection compatibility is a runtime risk:
  - old saved connections must keep working without any implicit migration or accidental backend rewrite
