# Milestone MVP

## 1) References

- Spec index: [../../../specs/spec.json](../../../specs/spec.json)
- Module specs:
  - [../../../specs/core/module.md](../../../specs/core/module.md)
  - [../../../specs/surfaces/module.md](../../../specs/surfaces/module.md)
- Feature specs:
  - [../../../specs/core/features/credential-storage-backends.md](../../../specs/core/features/credential-storage-backends.md)
  - [../../../specs/surfaces/features/desktop-credential-storage-choice.md](../../../specs/surfaces/features/desktop-credential-storage-choice.md)
- Discovery success criteria:
  - no standalone `.vestin/discovery.md` exists in this repo; use the approved spec requirements as the success criteria for this slice

## 2) Milestone Goal

Deliver the first user-facing credential storage choice flow for desktop:

- new credential-bearing desktop connection flows can save to either:
  - `System secure storage`
  - `Encrypted local storage`
- desktop remembers a global default backend for future connection creation
- encrypted-local storage works with a single desktop-local passphrase and keeps secrets out of SQLite and preferences
- existing saved connections continue working unchanged

Done means a user can create one new connection with each backend, restart the app, and still reopen both connections without any raw secret appearing in SQLite or desktop preferences.

## 3) Spec Coverage

- Included:
  - `core / credential-storage-backends`
  - `surfaces / desktop-credential-storage-choice`
- Explicit exclusions:
  - backend migration for existing saved connections
  - in-place backend switching for already saved connections
  - CLI credential-storage choice UX
  - per-connection passphrases
  - import/export tooling for encrypted-local vault files

## 4) Features (Agent Execution Units)

### Feature: Core Credential Storage Backends

- Feature ref:
  - `module`: `core`
  - `feature`: `credential-storage-backends`
  - Spec: [../../../specs/core/features/credential-storage-backends.md](../../../specs/core/features/credential-storage-backends.md)
- Milestone: MVP
- Dependencies:
  - Feature deps: none
  - Current state: `unstarted`
- Tree todo:
  - [ ] Prerequisite checks
    - [ ] `PC-001` Confirm current saved-connection credential metadata shape and locate all backend-specific write/read entry points.
    - [ ] `PC-002` Confirm existing secret-boundary tests for SQLite, preferences, and mutation history so the new backend can extend them instead of duplicating them.
  - [ ] Build
    - [ ] `B-001` Define shared backend contract
      - Dependencies: `PC-001`
      - Work:
        - Files to modify:
          - `packages/core/src/...` credential contracts, saved connection metadata, and local credential resolution types
        - Scope notes:
          - add backend vocabulary and per-connection backend metadata
          - do not add migration logic for old connections
      - Done when:
        - all credential-bearing connection persistence paths can carry explicit backend metadata without guessing
    - [ ] `B-002` Implement encrypted-local vault primitives
      - Dependencies: `B-001`
      - Work:
        - Files to create/modify:
          - `packages/core/src/services/credential/...`
          - any desktop-local storage helpers needed for a passphrase-encrypted vault
        - Scope notes:
          - choose a versioned authenticated-encryption format
          - support write/read/unlock failure
          - keep passphrase-derived material out of persisted state
      - Done when:
        - core can store and read credential payloads through encrypted-local storage with an explicit passphrase input
    - [ ] `B-003` Wire runtime credential resolution through backend metadata
      - Dependencies: `B-001`, `B-002`
      - Work:
        - Files to modify:
          - connection create/update paths
          - runtime credential read paths
          - any access/credential reference code that currently assumes one backend
        - Scope notes:
          - existing keychain/system-secure behavior must remain intact
          - no surface-specific prompting in core
      - Done when:
        - a saved connection resolves secrets through its declared backend and old saved connections remain compatible
    - [ ] `B-004` Add focused tests
      - Dependencies: `B-002`, `B-003`
      - Work:
        - Files to create/modify:
          - `packages/core/src/...*.test.ts`
        - Scope notes:
          - include tamper, wrong-passphrase, and no-secret-in-SQLite assertions
      - Done when:
        - automated tests cover backend metadata persistence and encrypted-local failure modes
  - [ ] Verification
    - [ ] `V-001` Prove backend contract correctness
      - Dependencies: `B-004`
      - Steps:
        - `npm run typecheck`
        - run focused credential backend tests
        - inspect created SQLite rows in a temp workspace to confirm only metadata/references are stored
      - Expected outcome:
        - backend metadata persists, secrets do not enter SQLite/preferences, and encrypted-local failures are explicit
- Execution logs:
  - Build log: [./features/core/credential-storage-backends/build.md](./features/core/credential-storage-backends/build.md)
  - Verify log: [./features/core/credential-storage-backends/verify.md](./features/core/credential-storage-backends/verify.md)

### Feature: Desktop Credential Storage Choice

- Feature ref:
  - `module`: `surfaces`
  - `feature`: `desktop-credential-storage-choice`
  - Spec: [../../../specs/surfaces/features/desktop-credential-storage-choice.md](../../../specs/surfaces/features/desktop-credential-storage-choice.md)
- Milestone: MVP
- Dependencies:
  - Feature deps:
    - `core / credential-storage-backends`
  - Current state: `unstarted`
- Tree todo:
  - [ ] Prerequisite checks
    - [ ] `PC-101` Confirm which desktop connection creation flows currently save credential-bearing connections and where backend selection can be inserted without broad onboarding rewrites.
    - [ ] `PC-102` Confirm current desktop preference storage shape and restart-read path for renderer, tray, and main-process consumers.
  - [ ] Build
    - [ ] `B-101` Add desktop-local global default backend preference
      - Dependencies: `PC-102`
      - Work:
        - Files to modify:
          - desktop preferences store and tests
        - Scope notes:
          - preference affects only new connection creation defaults
          - no retroactive mutation of existing connections
      - Done when:
        - desktop can persist and reload a nullable global default backend
    - [ ] `B-102` Add backend selection to credential-bearing connection create flows
      - Dependencies: `PC-101`, `B-101`, `core/credential-storage-backends:B-003`
      - Work:
        - Files to modify:
          - renderer add/create connection flow
          - any main-process draft/save contracts needed to pass backend choice
        - Scope notes:
          - ask only when a credential save is actually about to happen
          - preselect global default when present
      - Done when:
        - desktop can create a new connection with an explicit selected backend
    - [ ] `B-103` Add encrypted-local passphrase establish/unlock flow
      - Dependencies: `B-102`, `core/credential-storage-backends:B-002`
      - Work:
        - Files to modify:
          - renderer credential dialogs/forms
          - main/electron draft save path if passphrase material must stay off renderer persistence paths
        - Scope notes:
          - global passphrase only for this slice
          - no passphrase recovery flow beyond explicit failure messaging
      - Done when:
        - selecting encrypted-local storage either establishes or unlocks the vault before save
    - [ ] `B-104` Add system-secure denial fallback and restart-read coverage
      - Dependencies: `B-102`, `B-103`
      - Work:
        - Files to modify:
          - desktop error/fallback flow
          - tray/menubar/main-process preference readers if needed
          - surface tests
        - Scope notes:
          - fallback must stay explicit
          - no silent backend conversion
      - Done when:
        - system-secure denial offers encrypted-local fallback and restart still remembers the chosen backend/default
  - [ ] Verification
    - [ ] `V-101` Prove desktop choice flow correctness
      - Dependencies: `B-104`
      - Steps:
        - `npm run typecheck`
        - run focused desktop tests for preferences and connection creation
        - manual check:
          - first credential-bearing connection with no default prompts for choice
          - selecting “remember as default” affects the next new connection
          - existing connections remain unchanged
          - restart preserves the global default
      - Expected outcome:
        - desktop choice flow behaves deterministically across first-run, override, fallback, and restart cases
- Execution logs:
  - Build log: [./features/surfaces/desktop-credential-storage-choice/build.md](./features/surfaces/desktop-credential-storage-choice/build.md)
  - Verify log: [./features/surfaces/desktop-credential-storage-choice/verify.md](./features/surfaces/desktop-credential-storage-choice/verify.md)

## 5) Checkpoints

- Checkpoint 1:
  - shared backend metadata exists and encrypted-local vault tests pass in isolation
- Checkpoint 2:
  - desktop can create one new connection using `System secure storage`
- Checkpoint 3:
  - desktop can create one new connection using `Encrypted local storage` with passphrase establish/unlock
- Checkpoint 4:
  - after restart, the global default remains selected for new connections and existing connections keep their original backend

## 6) Risks / Spikes

- Spike 1:
  - choose the encrypted-local cryptography/KDF format before `B-002`
  - output:
    - exact primitive choice
    - file metadata shape
    - tamper/failure behavior
- Risk 2:
  - some existing desktop connection flows may save drafts through renderer/main IPC contracts that currently assume one credential backend
  - mitigation:
    - finish `PC-101` before modifying UI copy or persistence payloads
