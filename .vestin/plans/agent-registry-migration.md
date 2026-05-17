# Agent Registry Migration

## Goal

Move Nile toward a structure where adding a new agent mostly means implementing one agent-owned module and registering it in one place.

The target is:

- one agent-owned implementation boundary per agent
- one shared registry for agent metadata and runtime wiring
- one shared registry for connection-family metadata and local session sources

This is a migration plan, not a big-bang rewrite.

Backward compatibility with older internal structure is not a goal for this plan.
The priority is the clean target structure, not preserving transitional abstractions longer than necessary.

## Why This Plan Exists

Gemini proved that Nile is extendable, but it also exposed three costs that are still too high:

1. adding one session agent still touches too many shared switches
2. agent entry semantics are still partly inferred instead of declared
3. hybrid session/backend logic still starts life inside one agent and only later gets pulled out

The current repository is good enough to ship new agents.
It is not yet optimized for low-friction, low-surprise agent bring-up.

## Target State

### 1. Agent-owned implementation boundary

Each agent should own:

- local stores
- current-state reader/detector
- import
- apply
- rollback
- tests

This boundary can stay under `packages/core/src/agents/<agent>/` during migration.
It does not need to become its own workspace package on day one.

This boundary should become stable before any physical package split is considered.
Registry work must not depend on agent-internal file layout or deep private imports long-term.

### 2. Agent manifest

Each agent should declare one manifest that owns:

- `agentId`
- label
- icon key
- default home resolver key
- supported connection family ids
- apply requirements
- auto selection sync behavior
- connection entry mode
- adapter factory

This manifest should replace scattered knowledge in:

- `Capabilities`
- default ordering helpers
- agent entry-mode assumptions in desktop
- explicit CLI agent allowlists

The agent manifest must not redefine family-level protocol or auth rules.
It should answer:

- who the agent is
- which families it supports
- how it enters connection flows
- how runtime wiring is constructed

`supported connection family ids` should come from the family registry source of truth.
Do not introduce a long-lived compatibility bridge just to preserve old internal ownership.

### 3. Connection-family manifest

Each shared connection family should declare one manifest that owns:

- auth mode
- endpoint family/profile/protocol
- identity key rules
- label rules
- matching/upsert rules
- current local session source id if applicable

The connection-family manifest is the single truth for family behavior.
The agent manifest only references family ids from this registry.

This is especially important for session families:

- `openai_session`
- `claude_session`
- `cursor_session`
- `gemini_cli_session`
- `openclaw_openai_session`

### 4. Shared local-session source registry

Current local session sources should register through one shared path instead of being hand-wired across:

- request types
- request builder
- resolver
- surface labels

This registry should be owned by the connection-family layer, not by agents directly.
It exists to describe import/read sources for session families, not as a second independent truth about family behavior.

The intended relationship is:

- `ConnectionFamilyManifest`
  - may declare zero or more local session source ids
- `LocalSessionSourceRegistry`
  - resolves those source ids into:
    - display label
    - resolver
    - auth mode

So the source registry is a helper indexed by family-owned source ids.
It is not a peer registry that independently decides which families exist.

The registry should own:

- source id
- auth mode
- display label
- resolver

### 5. Shared session-backend abstraction

Session credential backend policy should live in shared code when the pattern is generic.

Today Gemini already needs:

- preferred backend
- fallback backend
- snapshot / restore
- write target selection

If another hybrid session agent appears, this should already be a shared tool, not another local reinvention.

## Non-Goals

- Do not physically split agents into separate workspace packages yet.
- Do not redesign all connection UI flows during this migration.
- Do not change saved connection semantics.
- Do not change explicit-switch behavior.
- Do not merge unrelated endpoint/provider refactors into this plan.

## Migration Principles

1. Replace inference with declaration.
2. Migrate one seam at a time.
3. Keep each phase shippable.
4. Prefer adapter-preserving refactors before moving files.
5. Do not extract a package boundary before the internal boundary is already clean.
6. Prefer one ownership chain:
   - connection-family registry defines family behavior
   - agent registry declares which families an agent supports
   - local-session source registry hangs off connection-family behavior
7. Treat a stable agent public surface as a precondition for registry success, not a late cleanup.
   Registry work should narrow agent boundaries as it goes instead of postponing boundary cleanup until package-readiness.
8. Prefer target-state replacement over compatibility layering.
   If an old internal shape conflicts with the target structure, replace it instead of keeping both.

## Proposed Phases

### Phase 1: Agent manifest over existing structure

Introduce an `AgentManifest` layer without moving agent directories.

#### Scope

- define a manifest shape
- register all current agents in one registry
- move existing agent-owned metadata into manifest-owned fields
- make shared consumers read the registry instead of fixed sets where possible

#### Done when

- agent metadata no longer needs to be declared in more than one shared place
- desktop and CLI can derive default agent lists from one registry
- registry wiring no longer requires new consumers to read deep agent-private files directly

### Phase 2: Connection-family manifest and registry

Define one shared ownership point for family behavior before adding a separate source registry.

#### Scope

- define `ConnectionFamilyManifest`
- define `ConnectionFamilyRegistry`
- move stable family-owned rules under this registry:
  - auth mode
  - endpoint family/profile/protocol
  - identity-key rules
  - label rules
  - matching/upsert rules
- start with session families first, because they currently cost the most to add

#### Done when

- one family no longer needs to be modeled through a broad search across many shared files
- agent manifests refer to family ids instead of duplicating family behavior
- old scattered family ownership is deleted rather than left behind as a compatibility layer

### Phase 3: Entry-mode and surface policy cleanup

Make agent connection entry mode explicit and consume it consistently.

#### Scope

- define entry modes centrally:
  - `configure`
  - `import`
  - `configure_or_import`
- update desktop surfaces to use the explicit mode
- remove remaining “does this agent have presets?” heuristics when they are really entry-mode decisions

#### Done when

- adding an import-first agent does not require desktop-specific one-off branching

### Phase 4: Current local session source registry

Remove the remaining scattered wiring for local current-session sources.

#### Scope

- registry for:
  - source id
  - auth mode
  - display label
  - resolver
- attach each source to a connection family manifest instead of treating it as a top-level unrelated registry
- migrate:
  - `current_codex`
  - `current_claude`
  - `current_cursor`
  - `current_gemini`

#### Done when

- a new session source does not require hand edits across request type, builder, resolver, and label surfaces
- source ownership is unambiguous:
  - family manifest declares which sources belong to it
  - source registry resolves source behavior

### Phase 5: Session-backend abstraction pass

Lift hybrid/local backend patterns into shared service boundaries where proven useful.

#### Scope

- preserve the current shared `PreferredCredentialBackend`
- evaluate whether:
  - snapshot policy
  - unavailable-backend normalization
  - backend selection
  should become a formal shared session-backend package under `services/credential`

#### Done when

- a future hybrid session agent can reuse backend orchestration instead of creating a private version first

#### Start this phase when

- at least two agents share not just a similar backend count, but the same stable semantics for:
  - preferred-vs-fallback priority
  - unavailable-backend detection
  - snapshot / restore scope
  - write-target selection

### Phase 6: Agent package-readiness pass

Make each agent internally package-like before any physical split.

#### Scope

- each agent owns one clear public surface
- each agent can be wired from manifest + adapter factory
- shared core imports from agents only through stable exports
- remove remaining registry dependence on agent-internal file layout or incidental private helpers

This phase is still useful, but its boundary rules should already be partially enforced in earlier phases.
It is not permission to delay all public-surface cleanup until the end.

#### Done when

- moving an agent from `packages/core/src/agents/<agent>` to `packages/agents/<agent>` would be mostly path movement, not behavior surgery

### Phase 7: Optional physical package split

Only do this if Phases 1-6 prove the boundary is stable enough to justify extra package overhead.

#### Scope

- evaluate whether `packages/agents/<agent>` is worth:
  - extra build wiring
  - extra export surfaces
  - extra test/package complexity

#### Decision rule

Do this only if the internal registry/manifest boundaries are already clean and the physical split buys real maintainability.

Not doing a physical package split is still a successful outcome if the registry and boundary goals are met.

## Todo

### Phase 1

- [x] Define `AgentManifest`
- [x] Define `AgentRegistry`
- [x] Move agent capability metadata under manifest ownership
- [x] Replace remaining fixed agent sets with registry-derived lists where the behavior is already generic
- [x] Add manifest coverage tests

### Phase 2

- [x] Define `ConnectionFamilyManifest`
- [x] Define `ConnectionFamilyRegistry`
- [x] Migrate session-family rules first
- [x] Re-check label/upsert/identity ownership after migration

### Phase 3

- [x] Centralize agent connection entry mode
- [x] Update desktop surfaces to consume entry mode consistently
- [x] Remove remaining preset-based entry inference where it is really agent entry policy

### Phase 4

- [x] Define current local session source registry shape
- [x] Register current Codex session source
- [x] Register current Claude session source
- [x] Register current Cursor session source
- [x] Register current Gemini session source
- [x] Remove redundant builder/resolver branching that the registry replaces

### Phase 5

- [ ] Review shared session-backend abstractions after Gemini
- [ ] Extract any remaining generic hybrid-backend rules from agent-local code
- [ ] Add focused shared tests for backend fallback semantics

### Phase 6

- [x] Define one stable public surface per agent module
- [x] Remove direct shared-core knowledge of agent-internal file layout
- [x] Verify adapter wiring can be done from manifest + adapter factory only

### Phase 7

- [ ] Decide whether physical package split still buys enough value
- [ ] If yes, migrate one low-risk agent first as a spike
- [ ] Re-evaluate build/test/export cost before moving the rest

## Recommended Execution Order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. If two or more agents now share the same backend pattern, do Phase 5 before Phase 6
6. If registry work still depends on agent-private structure, do Phase 6 before considering Phase 7
7. Only then consider Phase 7

## What To Migrate First

If we start implementation immediately, the best first slice is:

1. `AgentManifest`
2. `AgentRegistry`
3. desktop/CLI consumers that currently derive from fixed agent sets

This gives us the highest leverage without forcing a large connection-model rewrite first.

## Success Criteria

We can say this migration worked when a new agent session integration mostly means:

1. implement the agent-owned module
2. register one manifest
3. register any new connection family or local session source
4. verify existing shared surfaces pick it up without a long chain of manual edits

This migration is successful even if agents remain inside `packages/core/src/agents/`.
The physical split is optional.
The real success condition is:

- one agent-owned module boundary
- one agent registry
- one connection-family registry
- no broad scattered edits for ordinary new-agent work
- no long-lived compatibility layers that keep old and new internal ownership models alive at the same time
