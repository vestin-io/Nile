# Core Endpoint Capability Refactor

## Goal

Refactor `packages/core` so Nile naturally supports:

- one endpoint
- one credential
- multiple agent types

The target model should be built around:

- `Endpoint`
- `Access`
- `AgentProjection`

This replaces the current design where `provider family` implicitly owns:

- endpoint identity
- protocol shape
- auth semantics
- compatible agents
- apply behavior

## User-Facing Vocabulary

To avoid future confusion, product language and core language must stay intentionally different.

### Product Language

The user should continue to see and use the term:

- `Connection`

Examples:

- add a connection
- remove a connection
- use a connection
- saved connections

This keeps the surface simple and familiar.

### User Input Model

When the user adds a connection, they are not choosing a protocol-bearing provider family.

They are providing:

- `Endpoint URL`
- `Auth Mode`
- `Credential`
- optional `Label`

Conceptually:

- adding a connection means adding one way to access one endpoint

### Core Language

Inside `packages/core`, the persisted concepts should be:

- `Endpoint`
- `Access`

And the runtime concept should be:

- `AgentProjection`

### Mapping

The mapping should be treated as a fixed rule:

- user-facing `Connection` maps to core `Access`
- user-provided endpoint input maps to core `Endpoint`
- agent-specific local config is produced by `AgentProjection`

### Terminology Rules

To avoid drift:

- do not use `Connection` as the name of the protocol-bearing core entity
- do not expose `Access` as the primary product term
- do not ask the user to choose a synthetic `provider family`
- do not let UI wording drive the core model

### Surface Implication

For surfaces, `Add Connection` should mean:

1. accept endpoint information
2. accept auth mode
3. accept credential material
4. create or reuse an `Endpoint`
5. create or reuse an `Access`

The user still experiences this as creating one saved connection, but core should model it as endpoint plus access.

## Concept Boundaries

To keep the architecture stable, these concepts must stay separate.

### 1. Auth Mode

`Auth Mode` answers:

- how does the user authenticate to this backend

Examples:

- `api_key`
- `openai_session`
- `claude_session`
- `cursor_session`

Rules:

- auth mode is about credential semantics
- auth mode is not about endpoint shape
- auth mode is not about protocol capability
- auth mode is not about which agent can consume the endpoint

### 2. Endpoint Capability

`Endpoint Capability` answers:

- what protocols does this backend expose
- what path and auth rules apply for each protocol

Examples:

- `openai`
- `anthropic`
- `cursor`

Example capability shape:

```ts
endpoint.protocols = {
  openai: {
    basePath: "/v1",
    wireApis: ["chat", "responses"],
    authSchemes: ["bearer"]
  },
  anthropic: {
    basePath: "/v1",
    authSchemes: ["bearer"]
  }
};
```

Rules:

- capability is the core source of truth
- capability drives projection
- capability determines whether an agent can be supported
- capability should be explicit, not inferred from marketing names

### 3. Endpoint Preset / Profile

`Endpoint Preset` or `Endpoint Profile` answers:

- what common starting shape should Nile assume when the user creates or imports an endpoint

Examples:

- `Azure OpenAI`
- `Generic Gateway`
- `OpenAI Official`
- `Anthropic Official`

Rules:

- preset is a convenience concept
- preset is not the core truth
- preset may prefill capability defaults
- preset may guide detection or setup UX
- preset must not replace explicit endpoint capability

### Azure OpenAI In This Model

`Azure OpenAI` is:

- not an auth mode
- not a top-level protocol
- not the core architecture center

It is best treated as:

- an endpoint preset/profile
- plus an endpoint whose capabilities include OpenAI-style protocol with Azure-specific path defaults

Typical example:

```ts
endpoint.protocols = {
  openai: {
    basePath: "/openai/v1",
    wireApis: ["chat", "responses"],
    authSchemes: ["bearer"]
  }
};
```

### Generic Gateway In This Model

`Generic Gateway` is:

- not an auth mode
- not a special saved connection type

It is best treated as:

- an endpoint preset/profile
- plus an endpoint that may expose multiple protocol capabilities at once

Typical example:

```ts
endpoint.protocols = {
  openai: {
    basePath: "/v1",
    wireApis: ["chat", "responses"],
    authSchemes: ["bearer"]
  },
  anthropic: {
    basePath: "/v1",
    authSchemes: ["bearer"]
  }
};
```

### Summary Rule

Use this mental model consistently:

- `Auth Mode` = how access is authorized
- `Endpoint Capability` = what protocol surface exists
- `Endpoint Preset/Profile` = a setup shortcut or classification hint

Only endpoint capability should drive core apply and compatibility decisions.

## Design Decision

Use the simplest durable structure that can support future protocol and agent changes.

Core persistent entities:

- `Endpoint`
- `Access`

Core runtime strategy:

- `AgentProjection`

Do not keep `Connection` as a separate core domain center in the refactor plan. If a user-facing saved label is still needed later, it should be layered on top of `Access`, not treated as a protocol-bearing object.

## Why The Current Model Breaks

Today, `provider family` is overloaded.

It acts as:

- backend classifier
- protocol selector
- auth constraint
- compatibility matrix
- apply strategy selector

That works for single-purpose backends, but it fails for gateway endpoints that can expose:

- OpenAI-compatible APIs
- Anthropic-compatible APIs
- shared bearer auth
- different local projections per agent

The result is that one endpoint cannot naturally serve both Claude and Codex through the same structural model.

## Target Domain Model

### 1. Endpoint

Represents a real backend endpoint.

It is agent-independent.

Suggested fields:

- `id`
- `label`
- `rootUrl`
- `protocols`
- `createdAt`
- `updatedAt`

Suggested shape:

```ts
type Endpoint = {
  id: string;
  label: string;
  rootUrl: string;
  protocols: {
    openai?: {
      basePath?: string;
      wireApis?: Array<"chat" | "responses">;
      authSchemes: Array<"bearer">;
      envKeyOverride?: string;
    };
    anthropic?: {
      basePath?: string;
      authSchemes: Array<"bearer" | "x_api_key">;
      envKeyOverride?: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN";
    };
    cursor?: {
      backendPath?: string;
    };
  };
};
```

Rules:

- `Endpoint` stores backend capability only
- `Endpoint` does not store agent compatibility directly
- supported agents are derived from available projection strategies plus endpoint protocols

### 2. Access

Represents authorized access to an endpoint.

This combines the concerns previously spread across binding and saved connection.

Suggested fields:

- `id`
- `endpointId`
- `authMode`
- `credentialRef`
- `label`
- `identityKey`
- `createdAt`
- `updatedAt`

Suggested shape:

```ts
type Access = {
  id: string;
  endpointId: string;
  authMode: "api_key" | "openai_session" | "claude_session" | "cursor_session";
  credentialRef: string;
  label: string;
  identityKey?: string;
};
```

Rules:

- `Access` is the user-facing saved thing in the simplified model
- `Access` owns dedupe and refresh identity
- `Access` does not encode wire protocol choice

### 3. AgentProjection

Represents how an `Endpoint + Access + Credential` combination is applied to one agent.

This is a runtime strategy, not a persisted entity.

Suggested interface:

```ts
resolve(agentId, endpoint, access, credential) => ApplySpec
```

Rules:

- projection is agent-aware
- projection is capability-aware
- projection is the only place that decides local config shape

## Core Principles

1. Endpoint capability is the source of truth for protocol support.
2. Access is the source of truth for authorized use of an endpoint.
3. Agent projection is the source of truth for apply behavior.
4. Agent compatibility is derived, not stored as a primary field.
5. Future protocol changes should modify endpoint capability or projection logic, not force a new provider family abstraction.

## Apply Model

### Current Problem

Current apply logic is effectively:

- load provider family
- infer protocol semantics from family
- generate apply spec

That prevents one endpoint from naturally producing:

- OpenAI-style config for Codex
- Anthropic-style config for Claude

### Target Apply Flow

1. user selects `accessId`
2. load `access`
3. load `endpoint`
4. load credential from `credentialRef`
5. call `AgentProjectionResolver.resolve(agentId, endpoint, access, credential)`
6. receive `ApplySpec`
7. write agent-local state
8. record mutation history and selection state

### Projection Responsibilities

#### CodexProjectionStrategy

Consumes:

- endpoint OpenAI protocol capability
- access auth mode
- credential

Produces:

- normalized base URL
- chosen wire API
- env key
- config block information

#### ClaudeProjectionStrategy

Consumes:

- endpoint Anthropic protocol capability
- access auth mode
- credential

Produces:

- normalized base URL
- auth env semantics
- whether to use `ANTHROPIC_API_KEY`
- whether to use `ANTHROPIC_AUTH_TOKEN`

#### CursorProjectionStrategy

Consumes:

- endpoint cursor capability
- access auth mode
- credential

Produces:

- cursor backend configuration

## Detection And Import Model

### Goal

Detect local state by identifying:

- endpoint root
- protocol style
- auth semantics
- credential identity

Do not detect primarily by provider-family label.

### Codex Detection

Infer:

- normalized endpoint root
- OpenAI protocol capability
- wire API
- auth source

Then match:

- endpoint
- access

### Claude Detection

Infer:

- normalized endpoint root
- Anthropic protocol capability
- whether auth is bearer-style or x-api-key-style
- session identity when relevant

Then match:

- endpoint
- access

### Matching Rules

Primary match dimensions:

- normalized endpoint
- protocol compatibility
- identity key

Secondary dimensions:

- auth mode
- label hints

## Usage Model

Usage dispatch should move away from provider-family branching.

Dispatch should be based on:

- credential kind
- endpoint capability
- supported usage source

Expected initial behavior:

- OpenAI session usage continues to work
- Claude session usage continues to work
- generic gateway API key usage can remain unsupported until a real usage source exists

## Recommended Core Modules

Current-aligned module layout:

- `packages/core/src/models/endpoint`
- `packages/core/src/models/access`
- `packages/core/src/projection`
- `packages/core/src/actions/current-state`
- `packages/core/src/actions/local-state`
- `packages/core/src/actions/apply`

Suggested main classes:

- `EndpointRegistry`
- `EndpointNormalizer`
- `AccessRegistry`
- `AgentProjectionResolver`
- `CodexProjectionStrategy`
- `ClaudeProjectionStrategy`
- `CursorProjectionStrategy`
- `OpenClawProjectionStrategy`
- `EndpointMatchResolver`
- `CurrentStateClassifier`

The old `actions/use` naming has since been replaced by the concrete `actions/apply` cluster so the core structure reads more like the actual saved-connection apply use case.

## What To Remove

The refactor should remove `provider family` as the center of core behavior.

That means removing or demoting:

- family-owned apply semantics
- family-owned protocol inference
- family-owned agent compatibility
- strategy classes whose real job is to simulate endpoint capability

If a compatibility label is still needed for display or heuristics, it should be secondary metadata only.

## Execution Plan

### Phase 1. Introduce Endpoint Model

Build:

- endpoint types
- endpoint registry
- protocol capability model

Exit criteria:

- core can persist backend capability without agent-specific meaning

### Phase 2. Introduce Access Model

Build:

- access registry
- endpoint-linked access records
- dedupe by endpoint plus identity
- credential refresh path

Exit criteria:

- one endpoint can have one reusable access record independent of agent choice

### Phase 3. Replace Family-Driven Apply With Projection

Build:

- `AgentProjectionResolver`
- Codex projection
- Claude projection

Exit criteria:

- same endpoint plus same key can project correctly to Codex and Claude

### Phase 4. Rebuild Creation Flow

Build:

- endpoint-first create flow
- capability-aware endpoint reuse
- access reuse independent of family semantics

Exit criteria:

- creating access no longer requires choosing a synthetic provider family

### Phase 5. Rebuild Current-State Detection And Import

Build:

- Codex endpoint inference
- Claude endpoint inference
- access matching

Exit criteria:

- local state round-trips through endpoint plus access instead of family inference

### Phase 6. Rebuild Usage Routing

Build:

- usage dispatch by credential kind plus endpoint capability

Exit criteria:

- usage behavior no longer branches mainly on provider family

### Phase 7. Remove Legacy Provider-Family Core

Remove:

- old strategy assumptions
- old family-owned apply behavior
- old family-owned compatibility truth

Exit criteria:

- endpoint capability plus projection fully replace provider-family-centered flow

## Acceptance Criteria

The refactor is complete when:

- one endpoint and one credential can be saved once and used by multiple agents
- Claude and Codex can derive different local apply configs from the same access
- adding a new agent only requires a new projection strategy
- protocol support is explicit in endpoint capability
- apply, detect, and import no longer depend primarily on `providerFamily`

## Non-Goals

Not in scope for this plan:

- CLI redesign
- desktop redesign
- migration compatibility with legacy core models
- preserving historical provider-family structure

This plan assumes a clean core refactor with no obligation to preserve the old conceptual model.
