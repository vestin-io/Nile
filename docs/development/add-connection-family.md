# Add A New Connection Family

Use this guide when the new work is not just “another agent”, but a new provider/auth family.

Examples:
- a new session format
- a new API-key family with a new protocol shape
- a provider that needs new live probe rules

This is more invasive than adding a new agent that reuses existing connection kinds.

## Goal

Add a new connection family without scattering family-specific rules across:
- onboarding
- compatibility
- import side effects
- model catalog probing
- renderer filtering

## Define The Family First

Decide these up front:

1. Credential shape
- `api_key`
- session credential
- something new

2. Endpoint protocol family
- OpenAI-compatible
- Anthropic-compatible
- Cursor-compatible
- new protocol family

3. Whether the family is model-driven
- yes: it needs detected model support
- no: selected model should stay out of it

4. Whether the family needs managed env-key promotion
- if yes, make that rule explicit in shared import side effects

## Core Modules You Will Touch

### Connection Definition / Preset

Update:
- [packages/core/src/models/connection/Catalog.ts](../../packages/core/src/models/connection/Catalog.ts)
- [packages/core/src/models/connection/setup/PresetTypes.ts](../../packages/core/src/models/connection/setup/PresetTypes.ts)

The family must exist as an explicit preset. Do not infer it from UI labels.

### Compatibility

Update the central compatibility flow:
- [packages/core/src/models/connection/Support.ts](../../packages/core/src/models/connection/Support.ts)
- [packages/core/src/models/agent/Capabilities.ts](../../packages/core/src/models/agent/Capabilities.ts)
- [packages/core/src/models/connection/AgentPolicy.ts](../../packages/core/src/models/connection/AgentPolicy.ts)

Rules:
- support kinds belong in `Support.ts`
- agents declare which support kinds they consume in `Capabilities.ts`
- shared selection/onboarding/saved compatibility continues to flow through `AgentPolicy.ts`

### Onboarding

Update:
- [packages/core/src/models/connection/setup/OnboardingPolicy.ts](../../packages/core/src/models/connection/setup/OnboardingPolicy.ts)

This is where:
- configurable agents
- default enabled agents
- detected compatibility
should stay coherent for the new family.

### Live Probe / Detection

If the family needs probe-based capability detection, add it in the shared setup layer instead of burying it in a UI flow.

Existing reference points:
- [packages/core/src/models/connection/setup/GatewayProbe.ts](../../packages/core/src/models/connection/setup/GatewayProbe.ts)
- [packages/core/src/application/local/ConnectionModelCatalog.ts](../../packages/core/src/application/local/ConnectionModelCatalog.ts)

### Import Side Effects

If import needs extra side effects, keep them in the import transaction path:
- [apps/desktop/src/electron/connections/Imports.ts](../../apps/desktop/src/electron/connections/Imports.ts)
- [apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.ts](../../apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.ts)

Rules:
- side effects must be rollback-aware
- single import and detected-setup import must use the same rule
- do not reintroduce per-surface post-processing

### Model Catalog

If the family is model-driven:
- keep detected models connection-level
- keep selected model agent-level

Touch:
- [packages/core/src/application/local/ConnectionModelCatalog.ts](../../packages/core/src/application/local/ConnectionModelCatalog.ts)
- [apps/desktop/src/renderer/shared/ConnectionModels.ts](../../apps/desktop/src/renderer/shared/ConnectionModels.ts)

Do not put selected model on the connection.

## Desktop Surfaces To Recheck

After adding the family, verify:
- quick setup
- agents list
- agent detail
- connections page
- menubar switching, if relevant

All surfaces should derive compatibility through the shared policy path, not new custom filters.

## Guardrails

When the family is added:
- update shared support kinds
- update capability registration
- update onboarding policy
- add probe/import tests
- keep renderer imports browser-safe

Do not:
- add new broad compatibility flags to desktop DTOs
- add family-specific UI strings as logic inputs
- special-case one surface while leaving others on old behavior

## Required Verification

At minimum:

```bash
npm run typecheck
./node_modules/.bin/vitest run packages/core/src/models/connection/Architecture.test.ts
```

Then add focused tests for:
- support kinds
- compatibility policy
- onboarding defaults
- live probe behavior
- import side effects / rollback
- model catalog behavior if applicable
