# Milestone Reliability

## 1) References

- Spec index: [../../../specs/spec.json](../../../specs/spec.json)
- Module specs:
  - [../../../specs/core/module.md](../../../specs/core/module.md)
  - [../../../specs/surfaces/module.md](../../../specs/surfaces/module.md)
- Feature specs:
  - [../../../specs/core/features/credential-storage-backends.md](../../../specs/core/features/credential-storage-backends.md)
  - [../../../specs/surfaces/features/desktop-credential-storage-choice.md](../../../specs/surfaces/features/desktop-credential-storage-choice.md)
- Architecture: [../../../architect.md](../../../architect.md)

## 2) Milestone Goal

Reserve space for post-MVP hardening without expanding scope in this planning slice.

## 3) Spec Coverage

- Included:
  - none beyond MVP in this planning slice
- Explicit exclusions:
  - backend migration
  - passphrase rotation
  - CLI parity
  - cross-machine vault portability UX

## 4) Features (Agent Execution Units)

- No additional feature execution units are planned for Reliability yet.
- Any new work here requires either:
  - an explicit spec expansion, or
  - MVP verification findings that justify re-planning

## 5) Checkpoints

- MVP has shipped and verification logs identify concrete hardening gaps worth planning.

## 6) Risks / Spikes

- Reliability work is intentionally deferred until MVP verifies the chosen cryptography and unlock lifecycle.
