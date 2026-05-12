# Pre-Extension Cleanup

## Goal

Make the current multi-agent architecture easier to extend before adding a new agent such as Gemini.

This is not a feature plan for Gemini itself.
It is a cleanup pass that reduces cross-surface drift, hardcoded agent branches, and duplicated connection/setup logic.

## Success Criteria

- Adding a new agent should not require re-deriving setup state separately in quick setup, agent detail, and connection pages.
- Agent-specific apply rules should come from one core-owned contract, not renderer conditionals.
- Shared connection compatibility should come from one policy source.
- Importing or re-saving a connection should not require each surface to re-decide side effects such as capability refresh, managed env-key promotion, or rollback behavior.
- Connection-level detected models and agent-level selected models should stay clearly separated in both data model and UI behavior.
- Browser-safe renderer code should have an explicit core boundary and should not be able to pull node-only core modules by accident.
- Expanding the agent set should not multiply local scan/probe work linearly through duplicate reads of the same local setup.
- New agent work should mostly be:
  - adapter
  - capability declaration
  - UI copy
  rather than a long chain of scattered `if agentId === ...` edits.

## Current Pain Points

1. Local setup status and onboarding scan still use adjacent but not identical state models.
2. Apply requirements are centralized, but the policy shape is still effectively OpenClaw-first.
3. Shared connection compatibility is better than before, but agent capability knowledge is still spread across connection policy and apply rules.
4. Renderer flows can still drift if they derive setup or model behavior independently.
5. Import side effects still tend to spread across “save/import/update” flows unless they are treated as one transaction boundary.
6. Model catalog behavior is now real product scope, but it is not yet called out as a first-class extension seam.
7. Browser-safe core usage has already proven fragile once, but it is not yet captured as a formal pre-extension guardrail.
8. Setup scan/probe cost becomes part of extensibility once the supported agent list grows.

## Cleanup Themes

### 1. Shared Agent Capability Contract

Define one core-owned capability description per agent for the rules that are already real today.

Current exercised concerns:

- whether the agent requires a selected model before apply
- whether the agent requires an env-backed API key when using `api_key`
- whether the agent supports managed env-backed API-key usage

This contract should stay minimal.
Do not add speculative Gemini-only fields yet.

### 2. Shared Local Setup Reconciliation

Define one core reconciliation result for:

- already saved
- new local setup
- invalid local setup
- unverified local setup
- unavailable

Both onboarding scan and agent status should derive from that same reconciliation result instead of each translating detector validity on their own.

### 3. Surface Consumption Discipline

Desktop surfaces should consume:

- shared reconciliation result for setup/new/saved UI
- shared apply requirements for switch/apply UI

They should not each re-interpret raw detector validity.

### 4. Import Side-Effect Discipline

Connection import, matched save, and detected-setup import should share one rule set for:

- capability refresh
- managed env-key promotion
- model-setting persistence
- rollback on partial failure

Surface entrypoints may trigger these flows, but they should not each decide which side effects run.

### 5. Model Catalog Discipline

Treat model discovery as its own extension seam:

- detected models are a connection-level capability snapshot
- selected model is an `(agent, connection)` setting
- catalog refresh/caching rules should be shared
- UI fallback behavior for no-catalog / stale-catalog / manual-entry cases should stay consistent

This should be explicit before adding another model-driven agent.

### 6. Browser-Safe Core Boundary

Renderer-safe code should consume only explicit browser-safe core subpaths.

This boundary should be treated as part of extensibility cleanup, not as a separate build concern, because new-agent UI work will keep crossing it.

### 7. Setup Scan and Probe Cost

Local setup scan and capability/model probes should not duplicate work across:

- quick setup
- agent status
- import flows

Extensibility includes keeping new agents from making setup refresh disproportionately slower.

### 8. Migration and Compatibility Discipline

The cleanup should preserve clarity on how old saved state evolves when new capability fields appear.

At minimum, we should be explicit about:

- what is lazily recomputed
- what is eagerly migrated
- which old fields are transitional and should be deleted after the cleanup

## State Relationship

The desktop and core setup model now deliberately distinguishes three different facts:

- `reconciliationState`
  - how the currently detected local setup relates to Nile saved state
  - examples: `already_saved`, `new`, `invalid`, `unavailable`
- `currentConnectionState`
  - whether the persisted current selection still resolves to a saved connection
  - examples: `saved`, `orphaned`, `none`
- `liveConnection`
  - the live setup currently detected from local agent state, if any

These must not collapse into one field again.
`reconciliationState` explains setup discovery and onboarding.
`currentConnectionState` explains saved selection integrity.
`liveConnection` explains what the local agent is actually using right now.

## New Agent Checklist

Before adding a new agent such as Gemini, the minimum required path should be:

1. Add the agent definition and label under `packages/core/src/models/agent/Types.ts`.
2. Register an explicit capability entry in `packages/core/src/models/agent/Capabilities.ts`.
3. Add the agent adapter under `packages/core/src/agents/<agent>/...` and wire it into the runtime adapter registry.
4. Ensure local setup detection participates in:
   - `live-setup`
   - `local-setup`
   - reconciliation
5. Reuse the central shared-connection compatibility path:
   - selectable connection support through `AgentCapabilities`
   - onboarding/saved compatibility through `SHARED_CONNECTION_AGENT_POLICY`
6. If the agent needs extra apply preconditions, express them as requirement kinds in core rather than renderer `if agentId === ...` branches.
7. If the agent is model-driven, reuse the connection-level detected model catalog and agent-level selected model setting split:
   - detected models remain connection-level capability
   - selected model remains `(agent, connection)` state
8. Keep renderer-safe desktop code on explicit browser-safe core subpaths only.
9. Update tests/guards so the new agent is covered by:
   - capability registration
   - shared compatibility policy
   - browser-safe renderer boundary where applicable

## TODO

### Phase 1: Core single-truth cleanup

- [x] Introduce a shared local-setup reconciliation reader in core.
- [x] Make onboarding scan consume reconciliation output instead of its own validity mapping.
- [x] Keep existing desktop-facing sync/current-connection DTOs stable while moving the truth source underneath.
- [x] Introduce a shared agent capability contract for current real agent requirements.
- [x] Make connection apply requirements read from that contract.
- [x] Make connection agent policy reuse that contract where applicable.

### Phase 2: Surface consolidation

- [x] Move desktop agent/onboarding presentation to explicit reconciliation labels instead of loosely coupled state strings.
- [x] Audit menubar, quick setup, and agent detail to ensure they do not reinterpret raw validity directly.
- [x] Reduce duplicated “detected setup” UI copy/state formatting where it still exists.

### Phase 2.5: Extension seam cleanup

- [x] Make import side effects a clearer single transaction boundary across single import, matched save, and detected-setup import.
- [x] Make model-catalog rules explicit enough that a new model-driven agent can reuse them without UI-specific branching.
- [x] Document the intended relationship between:
  - `reconciliationState`
  - `currentConnectionState`
  - `liveConnection`
- [x] Keep browser-safe renderer usage on explicit core subpaths only, with a guard that scales to future agent work.
- [x] Reduce repeated scan/probe work where the same local setup is read more than once per refresh path.

### Phase 3: Pre-Gemini extension guardrails

- [x] Document the minimal steps for adding a new agent:
  - adapter
  - capability declaration
  - shared-connection compatibility policy
  - optional model catalog support
- [x] Add a small architecture test or static guard for new agent capability registration coverage.
- [x] Add a guard that new renderer-safe agent work cannot import broad node-only core barrels.
- [x] Add a guard or checklist rule that new agent-specific apply requirements are expressed as requirement kinds, not renderer `if agentId === ...` branches.
- [x] Add a guard or checklist rule that new shared-connection families register compatibility through the central policy path.

## Non-Goals

- Do not implement Gemini.
- Do not add speculative provider families.
- Do not redesign all UI state names if the current DTO surface can stay stable.
- Do not rewrite stable connection/apply flows that already use the current policy system correctly.
