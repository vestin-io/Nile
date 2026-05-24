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
  - no standalone `.vestin/discovery.md` exists in this repo; use the approved product direction for machine-level single-mode storage as the success criteria for this slice

## 2) Milestone Goal

Deliver a simplified, cross-platform-safe credential storage model for desktop:

- each desktop instance uses exactly one machine-level credential storage mode:
  - `System secure storage`
  - `Encrypted local storage`
- the first saved connection establishes the machine storage mode
- once any saved connection exists, the machine storage mode becomes read-only
- changing storage mode requires reset / reinitialize
- encrypted-local unlock remains session-scoped and on-demand
- `Encrypted local storage` remains the foundation for later export/import work

Done means a user can:

- choose the machine storage mode once when saving the first credential-bearing connection
- keep saving/importing subsequent connections without re-choosing per connection
- see that storage mode is locked after the first saved connection exists
- reset local state to start over with a different mode

## 3) Spec Coverage

- Included:
  - `core / credential-storage-backends`
  - `surfaces / desktop-credential-storage-choice`
- Explicit exclusions:
  - export/import UX and file transport
  - multi-vault or per-profile local encrypted storage
  - cross-machine migration tooling
  - CLI-specific storage-mode UI
  - in-place conversion between system-secure and encrypted-local secrets without reset

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
    - [ ] `PC-001` Audit all runtime and persistence call sites that still treat `credentialStorageBackend` as a connection-level field.
    - [ ] `PC-002` Confirm what existing rows/configs can already contain mixed backend metadata and define the allowed compatibility outcome for that pre-release state.
  - [ ] Build
    - [ ] `B-001` Introduce machine-level storage-mode contract
      - Dependencies: `PC-001`
      - Work:
        - Files to modify:
          - `packages/core/src/services/credential/...`
          - `packages/core/src/application/local/...`
          - any shared types that currently expose per-connection backend choice
        - Scope notes:
          - define a desktop-machine storage mode abstraction
          - keep `System secure storage` platform-abstract
          - do not add export/import implementation yet
      - Done when:
        - core can reason about one machine storage mode without requiring every new connection input to choose a backend
    - [ ] `B-002` Collapse connection-level backend writes into machine-mode enforcement
      - Dependencies: `B-001`, `PC-002`
      - Work:
        - Files to modify:
          - connection create/import/update workflows
          - saved connection projections
          - any access builders/upserts that currently persist backend as mutable per-connection state
        - Scope notes:
          - existing saved rows must still load safely
          - no silent re-encryption or backend conversion
          - mixed pre-release state may be tolerated only as a recoverable/reset-required condition
      - Done when:
        - new mutations are constrained by machine storage mode instead of arbitrary per-connection backend input
    - [ ] `B-003` Preserve encrypted-local vault and system-secure abstractions
      - Dependencies: `B-001`
      - Work:
        - Files to modify:
          - backend credential store
          - encrypted-local vault/session types
        - Scope notes:
          - keep encrypted-local stable as the portable/exportable foundation
          - keep OS store pluggable for Windows/Linux follow-up
      - Done when:
        - core still supports both storage implementations, but selection is machine-scoped
    - [ ] `B-004` Add focused compatibility tests
      - Dependencies: `B-002`, `B-003`
      - Work:
        - Files to create/modify:
          - core/local-state tests
          - access persistence tests
        - Scope notes:
          - cover first-save mode lock-in
          - cover reset clearing mode
          - cover mixed-state detection if needed
      - Done when:
        - automated tests prove machine-level mode enforcement and compatibility boundaries
  - [ ] Verification
    - [ ] `V-001` Prove core machine-mode enforcement
      - Dependencies: `B-004`
      - Steps:
        - `npm run typecheck`
        - run focused core credential/storage tests
        - inspect temp persistence state to confirm secrets still stay out of SQLite/preferences
      - Expected outcome:
        - machine-level storage mode is enforced, secrets stay out of forbidden stores, and compatibility failures are recoverable
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
    - [ ] `PC-101` Audit all desktop save/import/update entry points that still choose or forward storage backend independently.
    - [ ] `PC-102` Confirm how reset currently clears local renderer preferences, vault state, and saved connections so storage-mode lock can rely on one consistent reset contract.
  - [ ] Build
    - [ ] `B-101` Replace “default backend” with machine storage mode preference/state
      - Dependencies: `PC-102`, `core/credential-storage-backends:B-001`
      - Work:
        - Files to modify:
          - desktop preferences/state readers
          - settings page storage section
          - quick setup storage step
        - Scope notes:
          - storage mode is chosen once on first save
          - after first saved connection exists, UI becomes read-only
      - Done when:
        - renderer/main share one machine storage mode concept instead of a default-plus-overrides model
    - [ ] `B-102` Unify all desktop save/import flows on machine-mode semantics
      - Dependencies: `PC-101`, `B-101`, `core/credential-storage-backends:B-002`
      - Work:
        - Files to modify:
          - add connection
          - quick setup
          - agent-page `Save to Nile`
          - connection edit/import/update affordances
        - Scope notes:
          - remove per-connection backend selectors where they no longer make sense
          - the first credential-bearing save can still present a mode choice screen
      - Done when:
        - all desktop flows either establish the machine mode once or reuse the locked mode consistently
    - [ ] `B-103` Keep encrypted-local unlock on-demand and action-scoped
      - Dependencies: `B-102`, `core/credential-storage-backends:B-003`
      - Work:
        - Files to modify:
          - unlock dialog orchestration
          - action-level refresh/save/import gates
          - header warning affordance copy
        - Scope notes:
          - no startup auto-unlock
          - only actions that actually need encrypted-local secrets should prompt
      - Done when:
        - locked encrypted-local mode blocks the right actions with a clear unlock dialog, while system-secure mode remains unaffected
    - [ ] `B-104` Lock mode changes behind reset and explain recovery path
      - Dependencies: `B-101`, `B-102`
      - Work:
        - Files to modify:
          - settings explanatory copy
          - reset flow
          - any machine-state banners/tooltips
        - Scope notes:
          - reset must explicitly clear storage mode, vault state, and related local markers
          - no silent “convert existing connections” path
      - Done when:
        - users can see that changing mode requires reset, and reset actually restores first-run choice behavior
  - [ ] Verification
    - [ ] `V-101` Prove desktop machine-mode behavior
      - Dependencies: `B-104`
      - Steps:
        - `npm run typecheck`
        - run focused desktop tests for settings/preferences/connection flows
        - manual check:
          - first saved connection asks for storage mode
          - subsequent saves/imports do not offer conflicting per-connection storage choices
          - encrypted-local locked actions prompt unlock on demand
          - reset reopens first-run storage selection
      - Expected outcome:
        - desktop behaves like a single-mode machine, not a mixed-backend connection bag
- Execution logs:
  - Build log: [./features/surfaces/desktop-credential-storage-choice/build.md](./features/surfaces/desktop-credential-storage-choice/build.md)
  - Verify log: [./features/surfaces/desktop-credential-storage-choice/verify.md](./features/surfaces/desktop-credential-storage-choice/verify.md)

## 5) Checkpoints

- Checkpoint 1:
  - core no longer depends on mutable connection-level backend selection for new writes
- Checkpoint 2:
  - desktop first-save flow establishes machine storage mode exactly once
- Checkpoint 3:
  - all desktop save/import/update paths reuse the same locked machine mode
- Checkpoint 4:
  - reset fully reopens the initial storage-mode decision

## 6) Risks / Spikes

- Spike 1:
  - decide how to interpret already-saved mixed backend metadata from pre-release local builds
  - output:
    - accepted compatibility behavior
    - whether to tolerate read-only mixed state or force reset
- Risk 2:
  - several legacy desktop entry points still bypass the newer quick-setup flow
  - mitigation:
    - finish `PC-101` before assuming machine-mode enforcement is complete
- Risk 3:
  - future export/import may need additional vault metadata guarantees
  - mitigation:
    - keep encrypted-local format versioned and avoid OS-store-specific assumptions in the portable path
