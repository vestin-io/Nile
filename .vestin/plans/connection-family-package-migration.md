# Connection Family Package Migration

## Goal

Move Nile toward a structure where adding a new connection family mostly means:

- implementing one family-owned package boundary
- registering that family in one shared registry
- leaving `core` responsible only for shared contracts and orchestration

This plan is intentionally narrower than a general `models/connection` rewrite.
The target is **connection family ownership**, not one giant `connections` package.

Backward compatibility with older internal structure is not a goal for this plan.
The clean target structure matters more than preserving transitional layers.

## Why This Plan Exists

The agent split proved that agent-owned packages are viable.
The next remaining complexity is that several behaviors still live in `core` even though they are really owned by one connection family:

- interactive login sources
- current local session sources
- endpoint builder/probe behavior
- identity key resolution
- model catalog resolution

If these stay in `core`, adding a new connection family will still feel scattered even after the agent split.

## What This Plan Is Not

This plan is **not**:

- moving all of `models/connection` into a single package
- moving shared saved-connection persistence out of `core`
- moving obviously agent-owned behavior into connection-family packages

Shared connection state should remain in `core`:

- saved connections
- enabled-agent policy
- requirements
- naming
- generic lifecycle orchestration

## Target State

### 1. Family-owned implementation boundary

Each non-trivial connection family should own:

- manifest
- auth mode and protocol semantics
- endpoint builder/probe logic
- identity-key rules
- label/matching/upsert rules when family-specific
- current-session source and login source when family-owned
- model catalog source when family-owned

This boundary should become stable before any physical package split is attempted.

### 2. Keep `core` small and explicit

`packages/core` should keep:

- shared connection domain types
- registries
- persistence
- orchestration
- generic validation

`core` should not keep private knowledge like:

- how Codex-backed OpenAI login works
- which URL/header shape a specific family needs
- which model catalog endpoint a specific family fetches

### 3. Family package shape

The target shape is closer to:

- `packages/connections/<family>/`

than to:

- `packages/connections/` with all families mixed together

Expected family-owned public surfaces:

- `Manifest.ts`
- `CurrentSessionSource.ts` if applicable
- `LoginSource.ts` if applicable
- `Projection.ts` only if the projection semantics are primarily family-owned
- `ModelCatalogSource.ts` if applicable
- `EndpointBuilder.ts` / `Probe.ts` / `Identity.ts` when those behaviors are family-specific

### 4. Ownership split between agent and family

Use this rule:

- if behavior is about **how a credential/protocol family works**, it is family-owned
- if behavior is about **how one agent applies or consumes that family**, it is agent-owned

Examples:

- `ConnectionModelCatalog`
  - mostly family-owned
- `session/Login`
  - family-owned source, shared session orchestration
- `CursorUsage*`
  - still agent-owned

## Ownership Map

### Should move toward family-owned packages

- `packages/core/src/application/local/ConnectionModelCatalog.ts`
- `packages/core/src/session/Login.ts`
- `packages/core/src/models/connection/setup/EndpointBuilder.ts`
- `packages/core/src/models/connection/setup/GatewayProbe.ts`
- `packages/core/src/models/connection/setup/IdentityKeyResolver.ts`

### Should remain agent-owned

- `packages/core/src/actions/usage/cursor/*`
- `packages/core/src/application/local/CursorUsageAutoBinder.ts`
- `packages/core/src/runtime-local/CursorUsageConnectionFollowUp.ts`

### Should remain in core

- `packages/core/src/models/connection/SavedConnections.ts`
- `packages/core/src/models/connection/EnabledAgentsPolicy.ts`
- `packages/core/src/models/connection/Requirements.ts`
- `packages/core/src/models/connection/Naming.ts`
- `packages/core/src/models/connection/family/Registry.ts`

## Risks To Avoid

### 1. Do not create a giant `connections` package

That would just move core sprawl into a new location.

### 2. Do not move agent-owned behavior into family packages

`CursorUsage*` is the main trap here.
It is clearly Cursor-agent behavior, not a connection-family concern.

### 3. Do not split packages before contracts are stable

First define the family-owned surfaces and registry ownership.
Only then decide whether physical workspace packages are worth it.

### 4. Do not fragment trivial API-key families too early

Simple families like:

- `openai-api-key`
- `anthropic-api-key`
- `cursor-api-key`

may not need immediate physical packages.
The first migrations should focus on complex families:

- session families
- families with custom endpoint/probe/catalog behavior

## Proposed Phases

### Phase 1: Family contract clarification

#### Scope

- define the public surface expected from a family-owned module
- make ownership explicit for:
  - login source
  - current session source
  - model catalog source
  - endpoint builder/probe
  - identity resolver
- record which current `core` files are family-owned vs shared vs agent-owned

#### Done when

- there is no ambiguity about whether a remaining file belongs to agent, family, or core

### Phase 2: Move family behavior behind registries

#### Scope

- make `ConnectionFamilyRegistry` the central registration point for family-owned surfaces
- stop hand-wiring family behavior from multiple unrelated places
- start with the most obviously family-owned behaviors:
  - login source
  - model catalog source
  - endpoint builder/probe
  - identity resolver

#### Done when

- adding a new family no longer requires broad searches across `application/local`, `session`, and `models/connection/setup`

### Phase 3: Physical package split for high-complexity families

#### Scope

- move the most complex families into `packages/connections/*`
- start with session-heavy or behavior-heavy families

Recommended first candidates:

1. `gemini-cli-session`
2. `openai-session`
3. `claude-session`

#### Done when

- at least one non-trivial family has a real package boundary and `core` consumes only its narrow public surface

### Phase 4: Reassess simple API-key families

#### Scope

- decide whether simple API-key families deserve their own physical packages
- if not, keep them registry-owned inside `core`

#### Done when

- physical package split is used only where it pays for itself

## Suggested Execution Order

1. Finish this contract/ownership clarification
2. Keep moving only clearly agent-owned residue out of `core`
   - especially Cursor usage
3. Start family migration with:
   - `ConnectionModelCatalog`
   - `session/Login`
   - `EndpointBuilder`
   - `GatewayProbe`
   - `IdentityKeyResolver`
4. Only after those are stable, decide whether to materialize `packages/connections/*`

## Success Criteria

This plan is successful when:

- new connection family work is mostly concentrated in one family-owned boundary
- `core` no longer knows family-private runtime details
- agent and family ownership are not mixed
- adding a new family no longer requires broad edits across unrelated shared modules
