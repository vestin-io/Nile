# Add A New Agent

This guide is the human-facing version of the pre-extension cleanup plan. Use it before adding a new agent such as Gemini.

## Goal

Add a new agent without scattering one-off logic across:
- core connection policy
- local setup scan
- quick setup
- agent detail
- menubar

The extension points are already in the repo. The work should flow through them instead of bypassing them.

## Before You Start

Decide which of these cases you are in:

1. The new agent reuses an existing connection family.
Example: it can consume an existing OpenAI-compatible API key or session.

2. The new agent requires a new connection family.
Example: it needs a new auth/session shape or a new provider protocol family.

If case `2` applies, read [add-connection-family.md](./add-connection-family.md) first.

## Fast Path

Generate the minimal agent skeleton:

```bash
npm run scaffold:agent -- --id gemini --label Gemini --dry-run
```

Then run it without `--dry-run` when the shape looks right.

The scaffold intentionally creates only the minimum files:
- `types.ts`
- `index.ts`
- `<Agent>AgentAdapter.ts`
- `live-setup/Detector.ts`
- `import/ImportCurrentConnection.ts`
- `apply/ApplySelection.ts`
- `rollback/RollbackLatestMutation.ts`

It does not auto-register the agent. Registration stays explicit.

## Required Changes

### 1. Register the Agent Identity

Update:
- [packages/core/src/models/agent/Types.ts](../../packages/core/src/models/agent/Types.ts)

Add:
- the new `AgentId`
- the display label

Then update:
- [packages/core/src/models/agent/Capabilities.ts](../../packages/core/src/models/agent/Capabilities.ts)

Every supported agent must have an explicit capability entry.

### 2. Add the Core Adapter

Wire the new agent under:
- `packages/core/src/agents/<agent-id>/...`

Export it from:
- [packages/core/src/agents/index.ts](../../packages/core/src/agents/index.ts)

Register it in:
- [packages/core/src/runtime-local/BuiltInAdapters.ts](../../packages/core/src/runtime-local/BuiltInAdapters.ts)

Do not add ad hoc runtime branching elsewhere.

### 3. Implement Live Setup Detection

Add the live-setup detector and related readers/stores under:
- `packages/core/src/agents/<agent-id>/live-setup`

The detector should produce one consistent `DetectedAgentState` with:
- `validity`
- `issues`
- detected endpoint/access
- matched connection if any

This is what feeds:
- local-setup scan
- reconciliation
- quick setup

### 4. Implement Import / Apply / Rollback

Fill in:
- `import/ImportCurrentConnection.ts`
- `apply/ApplySelection.ts`
- `rollback/RollbackLatestMutation.ts`

Rules:
- import should go through shared connection policy
- apply should respect shared apply requirements
- rollback should use the same mutation model as existing agents

Do not hide switching. Applying a connection must stay explicit.

### 5. Register Shared Connection Compatibility

If the agent can consume existing connection families, update:
- [packages/core/src/models/agent/Capabilities.ts](../../packages/core/src/models/agent/Capabilities.ts)
- [packages/core/src/models/connection/Support.ts](../../packages/core/src/models/connection/Support.ts) only if a new support kind is needed

Compatibility must continue to flow through:
- [packages/core/src/models/connection/AgentPolicy.ts](../../packages/core/src/models/connection/AgentPolicy.ts)

Do not add renderer-only filtering rules.

### 6. Register Apply Requirements

If the new agent has extra preconditions, express them as shared requirement kinds:
- [packages/core/src/models/connection/RequirementKinds.ts](../../packages/core/src/models/connection/RequirementKinds.ts)
- [packages/core/src/models/connection/Requirements.ts](../../packages/core/src/models/connection/Requirements.ts)

Examples:
- selected model required
- env-backed API key required

Do not add new `if (agentId === "...")` renderer branches for these rules.

### 7. Reuse The Model Split Correctly

If the new agent is model-driven:
- detected models stay connection-level
- selected model stays `(agentId, connectionId) -> modelId`

Reuse:
- [packages/core/src/models/agent-settings](../../packages/core/src/models/agent-settings)
- [apps/desktop/src/renderer/shared/ConnectionModels.ts](../../apps/desktop/src/renderer/shared/ConnectionModels.ts)

Do not store selected model back on the connection itself.

### 8. Wire Desktop Surfaces

Check all of these:
- quick setup
- agents list
- agent detail
- connections page if compatibility/filtering changes
- menubar if the agent is switchable there

Prefer shared helpers:
- `ApplyRequirements`
- `ConnectionModels`
- `DesktopData`
- reconciliation-driven local setup presenters

### 9. Keep Browser-Safe Boundaries Clean

Renderer code must import browser-safe core subpaths only.

Guarded by:
- [vitest.config.ts](../../vitest.config.ts)
- [apps/desktop/src/renderer/CoreImportBoundaries.test.ts](../../apps/desktop/src/renderer/CoreImportBoundaries.test.ts)

If the new agent needs renderer-safe core types, add narrow exports instead of importing broad barrels.

## Required Verification

At minimum:

```bash
npm run typecheck
./node_modules/.bin/vitest run packages/core/src/models/agent/Capabilities.test.ts
./node_modules/.bin/vitest run packages/core/src/models/connection/Architecture.test.ts
```

Also add focused tests for:
- live-setup detection
- import
- apply
- rollback
- any new requirement kind

## Common Mistakes

- Adding capability logic directly in desktop UI.
- Treating connection compatibility and selected model as the same concern.
- Importing broad `@nile/core` barrels from renderer code.
- Updating `enabledAgents` or connection labels implicitly during matched `Save to Nile`.
- Creating new DTO state strings instead of reusing reconciliation semantics.

## When You Need More Than This

If the new agent also needs a new provider/auth family, stop and follow:
- [add-connection-family.md](./add-connection-family.md)
