# Connection Family Package Migration Build Log

## Family-owned source ownership pass

### Tasks completed

- Extended the connection family manifest shape so session families can explicitly own:
  - interactive login sources
  - local model catalog sources
- Moved interactive login ownership from the agent module registry to the connection family registry:
  - OpenAI session now declares its Codex-backed login source on the family manifest
  - Claude session now declares its Claude-backed login source on the family manifest
- Moved local model catalog source ownership from the agent module registry to the connection family registry:
  - Claude session now declares the Claude gateway cache model-catalog source on the family manifest
- Updated shared registries to read those sources from connection family manifests instead of `AGENT_MODULES`:
  - [packages/core/src/session/Login.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Login.ts)
  - [packages/core/src/application/local/ModelCatalogSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ModelCatalogSource.ts)
- Reduced `AgentModule` back to agent-owned concerns:
  - manifest
  - runtime factory
  - projection
  - current session source

### Files changed

- [packages/core/src/models/connection/family/ManifestTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ManifestTypes.ts)
- [packages/core/src/models/connection/family/OpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenAiSession.ts)
- [packages/core/src/models/connection/family/ClaudeSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ClaudeSession.ts)
- [packages/core/src/session/Login.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Login.ts)
- [packages/core/src/application/local/ModelCatalogSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ModelCatalogSource.ts)
- [packages/core/src/models/agent/module/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/module/Types.ts)
- [packages/agents/codex/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src/Module.ts)
- [packages/agents/claude/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/Module.ts)

### Decisions

- Kept the actual source implementations in the existing agent packages for now.
  The change in this pass is ownership, not physical location.
- Treated interactive login as family-owned because the deciding question is:
  - "how does this credential family sign in?"
  not:
  - "which agent package happens to implement the local helper?"
- Treated Claude gateway cache model discovery as family-owned because it is part of the family’s model-catalog behavior, even though today it reuses Claude-local files.
- Did not move current-session source ownership in this pass; family manifests already own current-session source ids, and the remaining manifest object ownership can move separately.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/session/Login.test.ts packages/core/src/application/local/ModelCatalogSource.test.ts packages/core/src/models/connection/family/Registry.test.ts`

### Result

- `session/Login` and `ModelCatalogSource` are now family-driven registries instead of agent-driven registries.
- `AgentModule` is narrower and more aligned with truly agent-owned concerns.
- The next family-owned migration targets should be:
  - `ConnectionModelCatalog`
  - `EndpointBuilder`
  - `GatewayProbe`
  - `IdentityKeyResolver`

## Family-owned identity and session catalog rules

### Tasks completed

- Added explicit family-owned behavior slots for:
  - identity key resolution
  - session-backed OpenAI model-catalog authorization and route selection
- Moved identity key rules for session-style families onto the family manifests:
  - `openai-session`
  - `openclaw-openai-session`
  - `claude-session`
  - `cursor-session`
  - `gemini-cli-session`
- Reduced `ConnectionIdentityKeyResolver` to a thin family-driven dispatcher instead of a hard-coded auth-mode switch.
- Moved session-backed model-catalog special cases out of `ConnectionModelCatalog`:
  - OpenAI session and OpenClaw OpenAI session now provide their own
    - authorization extraction
    - Codex-catalog vs `/models` route preference

### Files changed

- [packages/core/src/models/connection/family/BehaviorTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/BehaviorTypes.ts)
- [packages/core/src/models/connection/family/ManifestTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ManifestTypes.ts)
- [packages/core/src/models/connection/family/OpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenAiSession.ts)
- [packages/core/src/models/connection/family/OpenClawOpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenClawOpenAiSession.ts)
- [packages/core/src/models/connection/family/ClaudeSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ClaudeSession.ts)
- [packages/core/src/models/connection/family/CursorSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/CursorSession.ts)
- [packages/core/src/models/connection/family/GeminiCliSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/GeminiCliSession.ts)
- [packages/core/src/models/connection/setup/IdentityKeyResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/IdentityKeyResolver.ts)
- [packages/core/src/application/local/ConnectionModelCatalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ConnectionModelCatalog.ts)
- [packages/core/src/models/connection/IdentityKeyResolver.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/IdentityKeyResolver.test.ts)
- [packages/core/src/models/connection/family/Registry.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.test.ts)

### Decisions

- Treated identity-key rules as family-owned because they are credential-shape semantics, not agent runtime semantics.
- Treated OpenAI-session model-catalog authorization as family-owned because it depends on session credential structure and family-specific routing rules.
- Kept generic API-key authorization and generic `/models` probing in `ConnectionModelCatalog` for now.
  Those rules currently behave more like shared transport logic than family-private behavior.
- Did **not** move `EndpointBuilder` and `GatewayProbe` in this pass.
  After review, they currently mix:
  - preset-owned decisions
  - shared gateway transport/detection
  - family-owned protocol semantics
  so forcing them into the family layer now would create worse ownership, not better.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/family/Registry.test.ts packages/core/src/models/connection/IdentityKeyResolver.test.ts packages/core/src/application/local/ConnectionModelCatalog.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts`

### Result

- `ConnectionIdentityKeyResolver` is now family-driven instead of central-switch-driven.
- The session-specific part of `ConnectionModelCatalog` is now family-driven.
- The remaining connection setup residue is narrower and more clearly split into:
  - family-owned credential/session semantics
  - preset/shared transport semantics

## Connection setup ownership split

### Tasks completed

- Split `ConnectionEndpointBuilder` into smaller class-owned builders:
  - `OpenAiEndpointBuilder`
  - `GatewayEndpointBuilder`
  - `AnthropicEndpointBuilder`
- Reduced `ConnectionEndpointBuilder` to a preset dispatcher.
- Kept `GatewayProbe` as shared transport/detection instead of forcing it into the family layer.

### Files changed

- [packages/core/src/models/connection/setup/OpenAiEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/OpenAiEndpointBuilder.ts)
- [packages/core/src/models/connection/setup/GatewayEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/GatewayEndpointBuilder.ts)
- [packages/core/src/models/connection/setup/AnthropicEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/AnthropicEndpointBuilder.ts)
- [packages/core/src/models/connection/setup/EndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/EndpointBuilder.ts)

### Decisions

- Treated endpoint shaping as primarily preset-owned:
  - OpenAI official
  - Azure OpenAI
  - Anthropic official / anthropic-compatible
  - generic gateway
- Treated `GatewayProbe` as shared transport/detection infrastructure.
  It is consumed by preset shaping, but its semantics are not owned by a single family.
- Did not move `GatewayProbe` into the family registry.
  That would blur family ownership with generic runtime HTTP probing.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/GatewayProbe.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts packages/core/src/models/connection/family/Registry.test.ts packages/core/src/models/connection/IdentityKeyResolver.test.ts packages/core/src/application/local/ConnectionModelCatalog.test.ts`

### Result

- Connection setup is now split more cleanly into:
  - family-owned credential/session semantics
  - preset-owned endpoint shaping
  - shared gateway transport/detection
- This is a better fit than trying to force every setup concern into connection family ownership.

## Connection model catalog orchestration split

### Tasks completed

- Split `ConnectionModelCatalog` transport work into dedicated classes:
  - `OpenAiModelCatalogReader`
  - `CodexModelCatalogReader`
- Kept `ConnectionModelCatalog` as the orchestration layer that:
  - reads connection metadata
  - asks the family layer for session-specific semantics
  - merges local cached models with remotely fetched models

### Files changed

- [packages/core/src/application/local/ConnectionModelCatalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ConnectionModelCatalog.ts)
- [packages/core/src/application/local/ConnectionModelCatalogTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ConnectionModelCatalogTypes.ts)
- [packages/core/src/application/local/OpenAiModelCatalogReader.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/OpenAiModelCatalogReader.ts)
- [packages/core/src/application/local/CodexModelCatalogReader.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/CodexModelCatalogReader.ts)

### Decisions

- Treated remote `/models` probing and Codex catalog fetches as shared transport readers, not family-owned classes.
- Kept the family layer responsible only for:
  - session authorization semantics
  - route preference semantics
- Kept local cached model sources outside the transport readers because they belong to the orchestration layer that merges multiple sources.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/application/local/ConnectionModelCatalog.test.ts packages/core/src/models/connection/family/Registry.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts`

### Result

- `ConnectionModelCatalog` is thinner and more obviously orchestration-focused.
- The transport-level logic for remote model reads is now reusable without dragging along connection-level branching.

## Connection create/update preparation split

### Tasks completed

- Extracted shared connection create/update preparation into:
  - `ConnectionPreparationSupport`
- Reduced `ConnectionCreator` and `ConnectionUpdater` to orchestration classes that:
  - read current records
  - delegate endpoint/onboarding/identity preparation
  - persist updated access/endpoint state

### Files changed

- [packages/core/src/models/connection/Preparation.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Preparation.ts)
- [packages/core/src/models/connection/Creator.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Creator.ts)
- [packages/core/src/models/connection/Updater.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Updater.ts)

### Decisions

- Kept onboarding suggestion, endpoint candidate building, identity-key resolution, and label suggestion together because they are all preparation concerns for connection mutation flows.
- Did not push this preparation logic into connection families.
  It still combines:
  - preset-owned endpoint shaping
  - family-owned identity/session semantics
  - shared onboarding policy

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts packages/core/src/application/local/ConnectionModelCatalog.test.ts`

### Result

- `ConnectionCreator` and `ConnectionUpdater` now have less direct dependency fan-out.
- Shared connection mutation preparation lives in one class instead of being reassembled in each mutation flow.

## Connection ownership final cleanup

### Tasks completed

- Moved connection-owned support contracts fully into `@nile/connections`:
  - `ConnectionOnboardingSuggestion`
  - `ConnectionLabeler`
- Switched repo-internal connection consumers to depend on `@nile/connections` surfaces instead of broad `@nile/core` runtime exports.
- Narrowed `@nile/core/models/connection` so it no longer re-exports connection runtime classes that now belong to `@nile/connections`.
- Removed obsolete thin wrapper files from `@nile/core`:
  - `ConnectionModelCatalog`
  - `ConnectionCreator`
  - `ConnectionUpdater`
  - `ConnectionLabeler`
  - setup-layer wrapper files for endpoint building, gateway probe, identity key resolution, and onboarding policy
- Moved connection-owned tests out of `packages/core/src/...` and into `packages/connections/src/...` so test location matches implementation ownership.

### Files changed

- [packages/connections/src/support/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/Types.ts)
- [packages/connections/src/labeling/Labeler.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/labeling/Labeler.ts)
- [packages/connections/src/catalog/Catalog.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/catalog/Catalog.test.ts)
- [packages/connections/src/mutations/Creator.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Creator.test.ts)
- [packages/connections/src/mutations/Updater.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Updater.test.ts)
- [packages/connections/src/setup/GatewayProbe.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/GatewayProbe.test.ts)
- [packages/connections/src/labeling/Labeler.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/labeling/Labeler.test.ts)
- [packages/connections/src/support/IdentityKeyResolver.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/IdentityKeyResolver.test.ts)
- [packages/connections/src/support/OnboardingPolicy.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/OnboardingPolicy.test.ts)
- [packages/core/src/models/connection/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/index.ts)

### Decisions

- Stopped preserving `@nile/core` as a historical alias layer for new internal code.
  New repo-internal imports should prefer `@nile/connections/*` for connection-domain runtime behavior.
- Treated test placement as part of ownership, not just implementation location.
  If a test primarily validates `@nile/connections`, it now lives under the connections package even when it still uses `@nile/core` fixtures and persistence primitives.
- Kept cross-domain contracts, registries, and persistence records in `@nile/core`.
  The cleanup in this pass only removes connection-domain runtime residue from `core`.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Result

- `@nile/connections` is now the clear owner of:
  - family implementations
  - catalog
  - setup
  - mutations
  - support
  - labeling
- `@nile/core` is reduced to:
  - contracts
  - registries
  - persistence
  - cross-domain orchestration
- The remaining `core` connection surface is now intentionally narrow instead of being a compatibility umbrella for connection runtime behavior.

## Connections package directory normalization

### Tasks completed

- Grouped all connection family implementations under:
  - `packages/connections/src/families/*`
- Grouped all connection family declaration surfaces under:
  - `packages/connections/types/families/*`
- Kept package exports stable, so external specifiers remain unchanged:
  - `@nile/connections/openai-session`
  - `@nile/connections/openai-session/module`
  - `@nile/connections/openai-session/manifest`
- Regenerated workspace source/type path mappings so the new internal structure is reflected in:
  - `tsconfig.base.json`
  - `packages/core/tsconfig.workspace-package-types.json`

### Files changed

- [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- [tsconfig.base.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.json)
- [packages/core/tsconfig.workspace-package-types.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.workspace-package-types.json)

### Decisions

- Treated `families` as a first-class internal grouping because `packages/connections/src` contains two different kinds of things:
  - family implementations
  - connection-domain shared subsystems (`catalog`, `setup`, `mutations`, `support`, `labeling`)
- Mirrored the same grouping under `types/` so the declaration structure matches the source structure.
- Did not change public import specifiers. This pass is internal package structure cleanup, not API redesign.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Result

- `packages/connections/src` now reads more clearly as:
  - `families/*`
  - shared connection-domain subsystems
- `packages/connections/types` now mirrors the same ownership model.
- The package is easier to navigate without increasing workspace package count or changing public API.

## Connection endpoint update split

### Tasks completed

- Extracted endpoint-update-specific rules from `ConnectionUpdater` into:
  - `ConnectionEndpointUpdateSupport`
- Moved these rules behind one class:
  - read default preparation URL for an existing endpoint
  - validate that an endpoint family supports auth updates
  - resolve whether an update should:
    - mutate the current endpoint
    - merge into an existing compatible endpoint
    - create a new endpoint
  - remove orphaned endpoints after a move

### Files changed

- [packages/core/src/models/connection/EndpointUpdate.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/EndpointUpdate.ts)
- [packages/core/src/models/connection/Updater.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Updater.ts)

### Decisions

- Treated endpoint replacement/merge/orphan cleanup as endpoint-domain behavior, not updater-specific behavior.
- Reused the existing shared endpoint URL helper instead of creating a second URL-building path.
- Kept this support in `core` because it coordinates shared endpoint and access registries rather than one family or one agent.

## Connection package consolidation

### Tasks completed

- Replaced the per-family workspace package layout under `packages/connections/*` with a single workspace package:
  - [packages/connections](</Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections>)
- Moved all family-owned source files into family directories inside that package:
  - `src/<family>/...`
  - `types/<family>/...`
- Updated the connection family registry to import family modules from:
  - `@nile/connections/<family>/module`
  instead of:
  - `@nile/connection-<family>/module`
- Updated workspace/package tooling so generated path aliases, contract verification, and workspace builds all understand:
  - grouped agent packages under `packages/agents/*`
  - one consolidated connections package at `packages/connections`

### Files changed

- [package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/package.json)
- [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
- [scripts/workspace-package-exports.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/workspace-package-exports.mjs)
- [scripts/verify-workspace-package-contracts.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/verify-workspace-package-contracts.mjs)
- [vitest.config.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/vitest.config.ts)
- [.gitignore](/Users/jiatwork/Works/nile/.worktrees/agent-registry/.gitignore)

### Decisions

- Kept agents as separate workspace packages because their runtime, apply, rollback, and local-state boundaries are materially different.
- Consolidated connection families into one package because the per-family workspace split created too much build/export/type wiring for relatively small family modules.
- Preserved family-owned source ownership inside the consolidated package by keeping one directory per family.
- Adjusted package-contract verification so it can validate workspace exports from `src/` when `dist/` is not built yet.
  `verify:structure` should remain a structure guard, not a hidden build prerequisite.

### Verification

- `npm run sync:package-paths`
- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`

### Result

- Connection family code remains family-owned, but the workspace/package story is less fragmented.
- Adding a new connection family now primarily means:
  - add a new family directory under `packages/connections/src`
  - add matching `types/<family>` declarations
  - register its exports in the single `packages/connections/package.json`
- The connection layer now matches the intended structure better than the per-family workspace split.

## Connection model catalog moved into connections package

### Tasks completed

- Moved connection model-catalog implementation out of `@nile/core` and into:
  - [packages/connections/src/catalog](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/catalog)
- Added a dedicated `@nile/connections/catalog` package surface.
- Kept the existing `@nile/core/application/local` public API stable by turning:
  - [packages/core/src/application/local/ConnectionModelCatalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ConnectionModelCatalog.ts)
  into a thin re-export.
- Removed the old core-owned implementation files:
  - `ConnectionModelCatalogTypes.ts`
  - `OpenAiModelCatalogReader.ts`
  - `CodexModelCatalogReader.ts`

### Files changed

- [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- [packages/connections/src/catalog/Catalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/catalog/Catalog.ts)
- [packages/connections/src/catalog/OpenAiReader.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/catalog/OpenAiReader.ts)
- [packages/connections/src/catalog/CodexReader.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/catalog/CodexReader.ts)
- [packages/connections/src/catalog/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/catalog/Types.ts)
- [packages/connections/src/catalog/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/catalog/index.ts)
- [packages/connections/types/catalog/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/types/catalog/index.d.ts)
- [packages/core/src/application/local/ConnectionModelCatalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ConnectionModelCatalog.ts)

### Decisions

- Treated connection model-catalog reading as connection-domain orchestration, not repo-global core behavior.
- Kept the existing core export path stable for downstream callers, so this ownership move does not force immediate surface churn in desktop/runtime code.
- Left `LocalModelCatalogSourceRegistry` in `@nile/core` for now because it still serves as a cross-domain registry view over family behaviors.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/application/local/ConnectionModelCatalog.test.ts packages/core/src/application/local/ModelCatalogSource.test.ts`
- `npm run test:core`
- `npm run test:desktop`

### Result

- `ConnectionModelCatalog` is now owned by `@nile/connections`.
- `@nile/core` keeps the stable export path but no longer owns the implementation.
- The next clean ownership targets are:
  - endpoint shaping (`EndpointBuilder` cluster)
  - gateway probing (`GatewayProbe`)
  - connection mutation preparation/update orchestration

## First physical connection-family package spike

### Tasks completed

- Generalized workspace-package tooling so it no longer assumes only `packages/agents/*` exist:
  - path sync
  - package build
  - package contract verification
  - core dist alias generation
- Split connection-family contract more cleanly into:
  - `manifest` for metadata
  - `behaviors` for runtime semantics
- Moved `gemini-cli-session` out of `packages/core/src/models/connection/family` into the first real connection package:
  - [packages/connections/gemini-cli-session](</Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session>)
- Updated the family registry to consume the Gemini family through:
  - `@nile/connection-gemini-cli-session/module`
- Updated Vitest workspace aliasing so tests derive package aliases from package `exports`, instead of maintaining a second hand-written agent alias table.

### Files changed

- workspace tooling
  - [scripts/workspace-package-exports.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/workspace-package-exports.mjs)
  - [scripts/write-workspace-tsconfig-paths.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/write-workspace-tsconfig-paths.mjs)
  - [scripts/build-workspace-package.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/build-workspace-package.mjs)
  - [scripts/build-workspace-packages.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/build-workspace-packages.mjs)
  - [scripts/verify-workspace-package-contracts.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/verify-workspace-package-contracts.mjs)
- workspace wiring
  - [package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/package.json)
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
  - [packages/core/build.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/build.mjs)
  - [packages/core/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.build.json)
  - [packages/core/tsconfig.workspace-package-types.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.workspace-package-types.json)
  - [tsconfig.base.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.json)
  - [vitest.config.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/vitest.config.ts)
  - [.gitignore](/Users/jiatwork/Works/nile/.worktrees/agent-registry/.gitignore)
- connection family contract
  - [packages/core/src/models/connection/family/BehaviorTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/BehaviorTypes.ts)
  - [packages/core/src/models/connection/family/ManifestTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ManifestTypes.ts)
  - [packages/core/src/models/connection/family/ModuleTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ModuleTypes.ts)
  - [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
  - [packages/core/src/models/connection/family/OpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenAiSession.ts)
  - [packages/core/src/models/connection/family/OpenClawOpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenClawOpenAiSession.ts)
  - [packages/core/src/models/connection/family/ClaudeSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ClaudeSession.ts)
  - [packages/core/src/models/connection/family/CursorSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/CursorSession.ts)
  - [packages/core/src/models/connection/family/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/index.ts)
- new connection package
  - [packages/connections/gemini-cli-session/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/package.json)
  - [packages/connections/gemini-cli-session/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/src/Manifest.ts)
  - [packages/connections/gemini-cli-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/src/Module.ts)
  - [packages/connections/gemini-cli-session/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/src/index.ts)
  - [packages/connections/gemini-cli-session/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/types/index.d.ts)
  - [packages/connections/gemini-cli-session/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/types/module.d.ts)
  - [packages/connections/gemini-cli-session/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/types/manifest.d.ts)

### Decisions

- Chose `gemini-cli-session` as the first physical split because it is self-contained:
  - no interactive login source
  - no local model-catalog source
  - limited behavior surface
- Did not introduce a big `packages/connections` monolith.
  The first split follows the same direction as agents:
  - one family package
  - one registry surface
- Kept `manifest` and `behaviors` separate.
  The package now owns a real `ConnectionFamilyModule` surface, instead of asking the registry to reconstruct behavior from a wider manifest object.
- Generalized Vitest aliasing from package `exports` so package-split growth does not create a second hand-maintained alias table.

### Verification

- `npm run sync:package-paths`
- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Result

- The repo now has the first real `packages/connections/*` package.
- `@nile/core` no longer owns `gemini-cli-session` family implementation.
- Workspace tooling now understands both:
  - `packages/agents/*`
  - `packages/connections/*`
- The next connection-family package can follow the same package contract without reworking the registry shape again.

## Second physical connection-family package spike

### Tasks completed

- Moved `claude-session` out of `packages/core/src/models/connection/family` into:
  - [packages/connections/claude-session](</Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session>)
- Updated the family registry to consume Claude session through:
  - `@nile/connection-claude-session/module`
- Verified that the family-package contract is strong enough for a more complex family than Gemini:
  - interactive session login
  - local model catalog sources
  - identity key matching
  - access reuse matching

### Files changed

- new package
  - [packages/connections/claude-session/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/package.json)
  - [packages/connections/claude-session/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/src/Manifest.ts)
  - [packages/connections/claude-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/src/Module.ts)
  - [packages/connections/claude-session/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/src/index.ts)
  - [packages/connections/claude-session/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/types/index.d.ts)
  - [packages/connections/claude-session/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/types/module.d.ts)
  - [packages/connections/claude-session/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/types/manifest.d.ts)
- registry wiring
  - [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- removed core-owned implementation
  - [packages/core/src/models/connection/family/ClaudeSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ClaudeSession.ts)

### Decisions

- Kept the package root surface narrow:
  - root exports only `manifest` and `module` via `index.ts`
  - internal behavior constants stay package-private
- Reused the existing agent package surfaces:
  - `@nile/agent-claude/login-source`
  - `@nile/agent-claude/model-catalog-source`
  instead of duplicating Claude-local integration logic in the connection package.
- Treated this as the first real test of the family contract for runtime-owned behavior beyond simple identity/access semantics.

### Verification

- `npm run sync:package-paths`
- `npm run typecheck`
- `npm run test:core`

### Result

- `claude-session` is no longer core-owned.
- The connection-family package contract now covers both:
  - simple session families like Gemini
  - richer session families like Claude
- The next likely candidate package is now one of:
  - `openai-session`
  - `openclaw-openai-session`
  depending on whether we want to validate shared OpenAI-session behavior next or keep peeling off smaller families first.

## Third physical connection-family package spike

### Tasks completed

- Moved `openai-session` out of `packages/core/src/models/connection/family` into:
  - [packages/connections/openai-session](</Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session>)
- Updated the family registry to consume OpenAI session through:
  - `@nile/connection-openai-session/module`
- Verified that the family-package contract also covers the shared OpenAI session path:
  - Codex-backed interactive login
  - identity-key resolution from OpenAI session credential semantics
  - OpenAI-session access reuse matching
  - OpenAI-session model-catalog authorization and Codex-route preference

### Files changed

- new package
  - [packages/connections/openai-session/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/package.json)
  - [packages/connections/openai-session/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/src/Manifest.ts)
  - [packages/connections/openai-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/src/Module.ts)
  - [packages/connections/openai-session/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/src/index.ts)
  - [packages/connections/openai-session/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/types/index.d.ts)
  - [packages/connections/openai-session/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/types/module.d.ts)
  - [packages/connections/openai-session/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/types/manifest.d.ts)
- registry wiring
  - [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- removed core-owned implementation
  - [packages/core/src/models/connection/family/OpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenAiSession.ts)

### Decisions

- Kept the package root surface narrow again:
  - root exports only `manifest` and `module`
- Reused the agent-owned Codex login surface:
  - `@nile/agent-codex/login-source`
  instead of duplicating CLI login ownership inside the connection package.
- Treated this as the main test of whether shared OpenAI-session semantics belong cleanly in connection-family packages instead of `@nile/core`.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Result

- `openai-session` is no longer core-owned.
- The family-package contract now holds for:
  - Gemini session
  - Claude session
  - OpenAI session
- The next likely candidate is now:
  - `openclaw-openai-session`
  which would validate the remaining OpenAI-derived session family with different credential semantics.

## Fourth physical connection-family package spike

### Tasks completed

- Moved `openclaw-openai-session` out of `packages/core/src/models/connection/family` into:
  - [packages/connections/openclaw-openai-session](</Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session>)
- Updated the family registry to consume the family through:
  - `@nile/connection-openclaw-openai-session/module`
- Verified that the package contract also holds for the second OpenAI-derived session family:
  - OpenClaw-specific identity-key rules
  - OpenClaw-specific access reuse matching
  - OpenClaw session model-catalog authorization
  - Codex-catalog route preference for official OpenAI endpoints

### Files changed

- new package
  - [packages/connections/openclaw-openai-session/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/package.json)
  - [packages/connections/openclaw-openai-session/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/src/Manifest.ts)
  - [packages/connections/openclaw-openai-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/src/Module.ts)
  - [packages/connections/openclaw-openai-session/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/src/index.ts)
  - [packages/connections/openclaw-openai-session/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/types/index.d.ts)
  - [packages/connections/openclaw-openai-session/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/types/module.d.ts)
  - [packages/connections/openclaw-openai-session/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/types/manifest.d.ts)
- registry wiring
  - [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- removed core-owned implementation
  - [packages/core/src/models/connection/family/OpenClawOpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenClawOpenAiSession.ts)

### Decisions

- Kept the family package independent from agent packages.
  Unlike `openai-session`, this family has no interactive login ownership, so it only depends on `@nile/core`.
- Reused the same package contract shape as the previous families:
  - package root stays narrow
  - manifest + module are the only public surfaces

### Verification

- `npm run typecheck`
- `npm run test:core`

### Result

- `openclaw-openai-session` is no longer core-owned.
- All session-style OpenAI-derived families now live outside `@nile/core`.
- The main remaining core-owned connection families are now the simpler ones:
  - API-key families
  - `cursor-session`

## Fifth physical connection-family package spike

### Tasks completed

- Moved `cursor-session` out of `packages/core/src/models/connection/family` into:
  - [packages/connections/cursor-session](</Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session>)
- Updated the family registry to consume the family through:
  - `@nile/connection-cursor-session/module`
- Verified that the package contract also holds for a lightweight session family with only:
  - identity-key semantics
  - current-session-source metadata

### Files changed

- new package
  - [packages/connections/cursor-session/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/package.json)
  - [packages/connections/cursor-session/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/src/Manifest.ts)
  - [packages/connections/cursor-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/src/Module.ts)
  - [packages/connections/cursor-session/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/src/index.ts)
  - [packages/connections/cursor-session/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/types/index.d.ts)
  - [packages/connections/cursor-session/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/types/module.d.ts)
  - [packages/connections/cursor-session/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/types/manifest.d.ts)
- registry wiring
  - [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- removed core-owned implementation
  - [packages/core/src/models/connection/family/CursorSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/CursorSession.ts)

### Decisions

- Kept the same package contract shape even though this family is simpler.
  The goal is consistency across families, not micro-optimizing each package layout.
- Treated `cursor-session` as the last session-family proof point before considering whether the remaining API-key families are worth physical split.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Result

- `cursor-session` is no longer core-owned.
- All session-style connection families now live in `packages/connections/*`.
- The remaining core-owned families are now the simpler API-key families:
  - `openai-api-key`
  - `anthropic-api-key`
  - `cursor-api-key`

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/Updater.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/application/local/ConnectionModelCatalog.test.ts`

### Result

- `ConnectionUpdater` is more clearly an orchestration class.
- Endpoint mutation rules now live behind one class instead of a long private-method chain on the updater.

## Connection access match split

### Tasks completed

- Added family-owned access reuse matching support for session-style families:
  - OpenAI session
  - OpenClaw OpenAI session
  - Claude session
  - Gemini CLI session
- Extracted the access matching dispatcher into:
  - `ConnectionAccessMatchSupport`
- Reduced `ConnectionUpsert` so it no longer hard-codes session credential-kind comparison rules directly.

### Files changed

- [packages/core/src/models/connection/family/BehaviorTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/BehaviorTypes.ts)
- [packages/core/src/models/connection/family/ManifestTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ManifestTypes.ts)
- [packages/core/src/models/connection/family/OpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenAiSession.ts)
- [packages/core/src/models/connection/family/OpenClawOpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenClawOpenAiSession.ts)
- [packages/core/src/models/connection/family/ClaudeSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ClaudeSession.ts)
- [packages/core/src/models/connection/family/GeminiCliSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/GeminiCliSession.ts)
- [packages/core/src/models/connection/AccessMatch.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/AccessMatch.ts)
- [packages/core/src/models/connection/Upsert.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Upsert.ts)

### Decisions

- Treated "does this saved access represent the same credential/session?" as family-owned semantics for session families.
- Kept generic API-key matching in shared core support because it is not tied to one family-private credential shape.
- Kept cursor-session on identity-key fallback for now because it did not previously have extra credential-shape matching rules to preserve.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts packages/core/src/application/local/ConnectionModelCatalog.test.ts`

### Result

- `ConnectionUpsert` now delegates session-specific access reuse rules instead of owning a growing credential-kind switch.
- Family manifests now own one more piece of session semantics: access reuse identity.

## Connection preset support split

### Tasks completed

- Added `ConnectionPresetSupport` as the single class that owns:
  - preset definition seeds
  - env-key support derivation
  - onboarding suggestions from detected protocols
- Reduced `ConnectionCatalog` to a thin compatibility wrapper over preset support.
- Reduced `ConnectionOnboardingPolicy` to a thin compatibility wrapper over preset support.

### Files changed

- [packages/core/src/models/connection/PresetSupport.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/PresetSupport.ts)
- [packages/core/src/models/connection/Catalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Catalog.ts)
- [packages/core/src/models/connection/setup/OnboardingPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/OnboardingPolicy.ts)
- [packages/core/src/models/connection/Architecture.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Architecture.test.ts)

### Decisions

- Treated preset definitions and onboarding suggestions as one shared preset-knowledge surface instead of two classes rebuilding the same singleton knowledge.
- Kept `ConnectionCatalog` and `ConnectionOnboardingPolicy` as compatibility shells so surface consumers do not need to change all at once.
- Kept `ConnectionAgentPolicy` separate because it still owns agent compatibility policy, while preset support orchestrates definition + onboarding behavior on top of that policy.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/Catalog.test.ts packages/core/src/models/connection/setup/OnboardingPolicy.test.ts packages/core/src/models/connection/Architecture.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts`

### Result

- Preset-owned knowledge now lives in one class instead of being rebuilt separately by `ConnectionCatalog` and `ConnectionOnboardingPolicy`.
- The remaining connection orchestration classes now sit on thinner preset/catalog wrappers.

## Connection family module registry shape

### Tasks completed

- Introduced an explicit `ConnectionFamilyModule` shape as the future package-facing public surface for connection families.
- Added a `Modules.ts` aggregation layer that wraps existing family manifests into modules without changing each family implementation file yet.
- Updated `ConnectionFamilyRegistry` to index modules and expose manifests as a derived view.

### Files changed

- [packages/core/src/models/connection/family/ModuleTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ModuleTypes.ts)
- [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
- [packages/core/src/models/connection/family/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.ts)
- [packages/core/src/models/connection/family/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/index.ts)

### Decisions

- Did not rewrite each family file into a new module format in this pass.
  The goal here is to stabilize the registry shape first, not to churn all family implementations at once.
- Treated `manifest` as the current minimal public surface for a family module.
  This leaves room for future family-package surfaces to add more exports without forcing another registry rewrite.
- Reused `IndexedRegistry` so family registry indexing matches the agent/session registry direction.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/family/Registry.test.ts packages/core/src/models/connection/Architecture.test.ts`

### Result

- Connection families now have an explicit module layer between implementation files and the shared registry.
- This makes the future `packages/connections/*` package contract more concrete without requiring immediate physical package split.

## Connection family module behavior split

### Tasks completed

- Expanded `ConnectionFamilyModule` so it now separates:
  - `manifest` for metadata
  - `behaviors` for family-owned runtime semantics
- Moved registry consumers off the old "manifest contains all behavior" assumption:
  - interactive session login lookup
  - local model catalog source lookup
  - identity-key resolution
  - session access matching
  - session-backed OpenAI model-catalog semantics
- Kept current family implementation files unchanged by mapping manifest fields into module behaviors in `Modules.ts`.

### Files changed

- [packages/core/src/models/connection/family/ModuleTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ModuleTypes.ts)
- [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)
- [packages/core/src/models/connection/family/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.ts)
- [packages/core/src/session/Login.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Login.ts)
- [packages/core/src/application/local/ModelCatalogSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ModelCatalogSource.ts)
- [packages/core/src/models/connection/setup/IdentityKeyResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/IdentityKeyResolver.ts)
- [packages/core/src/models/connection/AccessMatch.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/AccessMatch.ts)
- [packages/core/src/application/local/ConnectionModelCatalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ConnectionModelCatalog.ts)
- [packages/core/src/models/connection/family/Registry.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.test.ts)

### Decisions

- Treated `manifest` as metadata-only directionally, even though the current family implementation files still physically declare behavior fields on the same object.
- Used `Modules.ts` as the compatibility bridge:
  - current family files stay stable
  - shared consumers move to the future module contract now
- Did not force a second round of churn across every family implementation file in this pass.
  The goal was to stabilize the registry contract first.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/family/Registry.test.ts packages/core/src/models/connection/Architecture.test.ts`

### Result

- Shared consumers now conceptually depend on `ConnectionFamilyModule`, not on manifests pretending to be full runtime packages.
- This is the clearest contract step so far toward future `packages/connections/*` package ownership.

## API-key connection families moved to packages

### Tasks completed

- Added three new package-owned connection family implementations:
  - `@nile/connection-openai-api-key`
  - `@nile/connection-anthropic-api-key`
  - `@nile/connection-cursor-api-key`
- Switched the shared family module aggregation to import those package-owned modules instead of core-owned implementation files.
- Deleted the remaining concrete API-key family implementation files from `@nile/core`.

### Files changed

- [packages/connections/openai-api-key/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-api-key/package.json)
- [packages/connections/openai-api-key/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-api-key/src/Manifest.ts)
- [packages/connections/openai-api-key/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-api-key/src/Module.ts)
- [packages/connections/openai-api-key/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-api-key/src/index.ts)
- [packages/connections/openai-api-key/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-api-key/types/index.d.ts)
- [packages/connections/openai-api-key/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-api-key/types/manifest.d.ts)
- [packages/connections/openai-api-key/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-api-key/types/module.d.ts)
- [packages/connections/anthropic-api-key/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/anthropic-api-key/package.json)
- [packages/connections/anthropic-api-key/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/anthropic-api-key/src/Manifest.ts)
- [packages/connections/anthropic-api-key/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/anthropic-api-key/src/Module.ts)
- [packages/connections/anthropic-api-key/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/anthropic-api-key/src/index.ts)
- [packages/connections/anthropic-api-key/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/anthropic-api-key/types/index.d.ts)
- [packages/connections/anthropic-api-key/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/anthropic-api-key/types/manifest.d.ts)
- [packages/connections/anthropic-api-key/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/anthropic-api-key/types/module.d.ts)
- [packages/connections/cursor-api-key/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-api-key/package.json)
- [packages/connections/cursor-api-key/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-api-key/src/Manifest.ts)
- [packages/connections/cursor-api-key/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-api-key/src/Module.ts)
- [packages/connections/cursor-api-key/src/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-api-key/src/index.ts)
- [packages/connections/cursor-api-key/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-api-key/types/index.d.ts)
- [packages/connections/cursor-api-key/types/manifest.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-api-key/types/manifest.d.ts)
- [packages/connections/cursor-api-key/types/module.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-api-key/types/module.d.ts)
- [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- [packages/core/src/models/connection/family/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Modules.ts)

### Decisions

- Kept API-key family packages intentionally thin:
  - metadata in `Manifest.ts`
  - empty `behaviors` in `Module.ts`
- Treated this as the final proof that `packages/connections/*` can own both:
  - complex session families
  - simple API-key families
- Fixed one migration regression immediately after the move:
  `Modules.ts` briefly referenced the old `_FAMILY_MODULE` constant names instead of the new package exports.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Result

- All concrete connection family implementations now live under `packages/connections/*`.
- `packages/core/src/models/connection/family/` now contains only:
  - shared types
  - module/registry orchestration
  - no concrete family implementation files

## Session access labels moved to family behaviors

### Tasks completed

- Added `accessLabelReader` to `ConnectionFamilyBehaviorSet`.
- Moved session-specific access-label rules out of `ConnectionLabeler` and into family-owned behavior implementations for:
  - `openai-session`
  - `openclaw-openai-session`
  - `claude-session`
  - `cursor-session`
  - `gemini-cli-session`
- Simplified `ConnectionLabeler` so it now:
  - keeps preset-owned endpoint/API-key label rules
  - asks the family registry for session-label behavior
  - falls back to generic session labels only when a family does not provide a label

### Files changed

- [packages/core/src/models/connection/family/BehaviorTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/BehaviorTypes.ts)
- [packages/core/src/models/connection/family/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.ts)
- [packages/core/src/models/connection/family/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/index.ts)
- [packages/core/src/models/connection/Labeler.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Labeler.ts)
- [packages/connections/openai-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/src/Module.ts)
- [packages/connections/openclaw-openai-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/src/Module.ts)
- [packages/connections/claude-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/src/Module.ts)
- [packages/connections/cursor-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/src/Module.ts)
- [packages/connections/gemini-cli-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/src/Module.ts)

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/Labeler.test.ts packages/core/src/models/connection/family/Registry.test.ts`

### Result

- Adding a new session family no longer requires editing session-label conditionals in core.
- Session naming semantics now live with the connection family package that owns the credential shape.

## Preset registry and module split

### Tasks completed

- Introduced a dedicated preset module/registry layer under `packages/core/src/models/connection/preset`.
- Moved preset definitions out of the `ConnectionPresetSupport` seed array into package-local module files:
  - `OpenAi.ts`
  - `Gateway.ts`
  - `AzureOpenAi.ts`
  - `Anthropic.ts`
- Reworked `ConnectionPresetSupport` so it reads preset definitions from the new preset registry instead of owning its own second source of truth.
- Reworked `ConnectionAgentPolicy` so it now derives static configurable/default agent sets from the preset registry instead of a hard-coded switch.
- Removed `setup/PresetTypes.ts` and switched callers to the new `models/connection/preset` entrypoint.

### Files changed

- [packages/core/src/models/connection/preset/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/Types.ts)
- [packages/core/src/models/connection/preset/ManifestTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/ManifestTypes.ts)
- [packages/core/src/models/connection/preset/ModuleTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/ModuleTypes.ts)
- [packages/core/src/models/connection/preset/OpenAi.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/OpenAi.ts)
- [packages/core/src/models/connection/preset/Gateway.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/Gateway.ts)
- [packages/core/src/models/connection/preset/AzureOpenAi.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/AzureOpenAi.ts)
- [packages/core/src/models/connection/preset/Anthropic.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/Anthropic.ts)
- [packages/core/src/models/connection/preset/Modules.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/Modules.ts)
- [packages/core/src/models/connection/preset/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/Registry.ts)
- [packages/core/src/models/connection/preset/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/index.ts)
- [packages/core/src/models/connection/PresetSupport.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/PresetSupport.ts)
- [packages/core/src/models/connection/AgentPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/AgentPolicy.ts)
- [packages/core/src/models/connection/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/index.ts)
- [packages/core/src/models/connection/Creator.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Creator.ts)
- [packages/core/src/models/connection/Preparation.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Preparation.ts)
- [packages/core/src/models/connection/Labeler.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Labeler.ts)
- [packages/core/src/models/connection/EndpointUpdate.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/EndpointUpdate.ts)
- [packages/core/src/models/connection/Support.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Support.ts)
- [packages/core/src/models/connection/family/ManifestTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ManifestTypes.ts)
- [packages/core/src/models/connection/family/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.ts)
- [packages/core/src/models/connection/setup/EndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/EndpointBuilder.ts)
- [packages/core/src/models/connection/setup/OnboardingPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/OnboardingPolicy.ts)

### Decisions

- Kept preset modules in `@nile/core` for now.
  Unlike connection families, preset ownership is still tightly coupled to generic endpoint shaping and onboarding flow, so this pass focused on registry/module structure instead of physical package split.
- Treated `Gateway` as the only preset with dynamic detected-agent defaults.
  The static fallback agent set still lives on the preset manifest, while detection stays in shared policy/orchestration.
- Used the narrow `agent/Ids` import from the gateway preset module to avoid a module-initialization cycle through the wider agent barrel.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/Catalog.test.ts packages/core/src/models/connection/setup/OnboardingPolicy.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Labeler.test.ts`

### Result

- Preset knowledge is no longer duplicated across a seed array and a switch-based agent policy.
- Adding a new preset now has a clearer single home: `models/connection/preset/*`, with shared orchestration consuming the registry instead of owning parallel tables.

## Final connection edge cleanup

### Tasks completed

- Moved the last hard-coded session fallback labels out of `ConnectionLabeler` and into family-owned behaviors via `sessionFallbackLabel`.
- Introduced `ConnectionPresetOnboardingSupport` so the dynamic gateway onboarding/default-agent rule has a single owner instead of being reimplemented in both preset support and agent policy.
- Simplified `ConnectionPreparationSupport` by:
  - collapsing duplicate create/onboarding preparation into one internal `describe(...)` step
  - deleting the stale `resolveUpdatablePreset()` method that was no longer used by the update path

### Files changed

- [packages/core/src/models/connection/family/BehaviorTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/BehaviorTypes.ts)
- [packages/connections/openai-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openai-session/src/Module.ts)
- [packages/connections/openclaw-openai-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/openclaw-openai-session/src/Module.ts)
- [packages/connections/claude-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/claude-session/src/Module.ts)
- [packages/connections/cursor-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/cursor-session/src/Module.ts)
- [packages/connections/gemini-cli-session/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/gemini-cli-session/src/Module.ts)
- [packages/core/src/models/connection/Labeler.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Labeler.ts)
- [packages/core/src/models/connection/preset/OnboardingSupport.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/OnboardingSupport.ts)
- [packages/core/src/models/connection/preset/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/preset/index.ts)
- [packages/core/src/models/connection/PresetSupport.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/PresetSupport.ts)
- [packages/core/src/models/connection/AgentPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/AgentPolicy.ts)
- [packages/core/src/models/connection/Preparation.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Preparation.ts)

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/AgentPolicy.test.ts packages/core/src/models/connection/setup/OnboardingPolicy.test.ts packages/core/src/models/connection/Labeler.test.ts packages/core/src/models/connection/Catalog.test.ts`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts packages/core/src/models/connection/setup/OnboardingPolicy.test.ts`

### Result

- `gateway` onboarding/default-agent behavior now has a single owner.
- `ConnectionLabeler` no longer hardcodes session-family fallback labels or a session-auth-mode list.
- `ConnectionPreparationSupport` is now a thinner orchestration class with one fewer duplicated flow and one fewer dead policy method.

## Connection setup moved into connections package

### Tasks completed

- Moved the endpoint shaping and gateway probe implementation cluster into `@nile/connections/setup`.
- Reduced `@nile/core/models/connection/setup` to thin compatibility exports for:
  - `ConnectionEndpointBuilder`
  - `GatewayProbe`
- Deleted the old core-owned setup implementation files:
  - `OpenAiEndpointBuilder.ts`
  - `GatewayEndpointBuilder.ts`
  - `AnthropicEndpointBuilder.ts`

### Files changed

- [packages/connections/src/setup/GatewayProbe.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/GatewayProbe.ts)
- [packages/connections/src/setup/OpenAiEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/OpenAiEndpointBuilder.ts)
- [packages/connections/src/setup/GatewayEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/GatewayEndpointBuilder.ts)
- [packages/connections/src/setup/AnthropicEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/AnthropicEndpointBuilder.ts)
- [packages/connections/src/setup/EndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/EndpointBuilder.ts)
- [packages/connections/src/setup/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/index.ts)
- [packages/connections/types/setup/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/types/setup/index.d.ts)
- [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- [packages/core/src/models/connection/setup/EndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/EndpointBuilder.ts)
- [packages/core/src/models/connection/setup/GatewayProbe.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/GatewayProbe.ts)

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/connection/GatewayProbe.test.ts packages/core/src/models/connection/Creator.test.ts packages/core/src/models/connection/Updater.test.ts`

### Result

- Connection setup ownership now matches the intended package boundary:
  - `@nile/connections` owns endpoint shaping and gateway probing
  - `@nile/core` only keeps thin compatibility exports plus the remaining shared setup policies

## Connection mutations moved into connections package

### Tasks completed

- Moved connection mutation orchestration into `@nile/connections/mutations`:
  - `ConnectionPreparationSupport`
  - `ConnectionCreator`
  - `ConnectionUpdater`
  - `ConnectionEndpointUpdateSupport`
  - `ConnectionUpdaterValidationError`
- Reduced `@nile/core/models/connection` to thin compatibility exports for:
  - `ConnectionCreator`
  - `ConnectionUpdater`
- Deleted the old core-owned mutation implementation files:
  - `Preparation.ts`
  - `EndpointUpdate.ts`
  - `Creator.ts`
  - `Updater.ts`
- Kept the existing call sites stable by preserving the core-facing class names and type exports.

### Files changed

- [packages/connections/src/mutations/Preparation.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Preparation.ts)
- [packages/connections/src/mutations/EndpointUpdate.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/EndpointUpdate.ts)
- [packages/connections/src/mutations/Creator.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Creator.ts)
- [packages/connections/src/mutations/Updater.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Updater.ts)
- [packages/connections/src/mutations/Error.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Error.ts)
- [packages/connections/src/mutations/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/index.ts)
- [packages/connections/types/mutations/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/types/mutations/index.d.ts)
- [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- [packages/core/src/models/connection/Creator.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Creator.ts)
- [packages/core/src/models/connection/Updater.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Updater.ts)
- [packages/core/src/models/connection/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/index.ts)

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Result

- Connection mutation ownership now matches the intended package boundary:
  - `@nile/connections` owns preparation, create, update, and endpoint-update logic
  - `@nile/core` keeps only the public compatibility surface and wider runtime orchestration

## Connection support ownership and final core cleanup

### Tasks completed

- Moved the last thin connection-domain support classes into `@nile/connections/support`:
  - `ConnectionOnboardingPolicy`
  - `ConnectionIdentityKeyResolver`
- Reduced the old core support files to thin compatibility exports under:
  - `@nile/core/models/connection/setup/OnboardingPolicy`
  - `@nile/core/models/connection/setup/IdentityKeyResolver`
- Unified the duplicated env-backed API key capability rule under:
  - `ConnectionEnvKeySupport`
- Updated the composition roots to instantiate connection mutations directly from:
  - `@nile/connections/mutations`
  instead of routing through core-owned wrapper implementations.
- Updated the architecture guard to reflect the final ownership model:
  - preset support remains core-owned
  - support wrappers now intentionally forward into `@nile/connections/support`

### Files changed

- [packages/connections/src/support/OnboardingPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/OnboardingPolicy.ts)
- [packages/connections/src/support/IdentityKeyResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/IdentityKeyResolver.ts)
- [packages/connections/src/support/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/index.ts)
- [packages/connections/types/support/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/types/support/index.d.ts)
- [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- [packages/connections/src/mutations/Preparation.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Preparation.ts)
- [packages/core/src/models/connection/setup/OnboardingPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/OnboardingPolicy.ts)
- [packages/core/src/models/connection/setup/IdentityKeyResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/setup/IdentityKeyResolver.ts)
- [packages/core/src/models/connection/EnvKeySupport.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/EnvKeySupport.ts)
- [packages/core/src/models/connection/PresetSupport.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/PresetSupport.ts)
- [packages/core/src/models/connection/AgentPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/AgentPolicy.ts)
- [packages/core/src/application/local/WorkspaceState.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/WorkspaceState.ts)
- [packages/core/src/models/connection/SavedConnections.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/SavedConnections.ts)
- [packages/core/src/models/connection/Architecture.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Architecture.test.ts)

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Result

- `@nile/connections` now owns the remaining connection-domain support layer:
  - onboarding policy
  - identity-key resolution
  - setup / catalog / mutations / family implementations
- `@nile/core` is now reduced to:
  - contracts
  - registries
  - cross-domain orchestration
  - thin compatibility exports where we intentionally preserve call-site stability
- The last duplicated env-key support rule is now centralized.

## Connection labeling and onboarding contract ownership

### Tasks completed

- Moved `ConnectionLabeler` into `@nile/connections/labeling` and converted the old core file into a thin compatibility export.
- Moved `ConnectionOnboardingSuggestion` to `@nile/connections/support` as the single type owner.
- Updated repo-internal consumers in CLI, desktop, agents, and core runtime to import:
  - labeling from `@nile/connections/labeling`
  - onboarding suggestion/support from `@nile/connections/support`
  - gateway probe from `@nile/connections/setup`
  - creator/updater types from `@nile/connections/mutations`
- Narrowed `@nile/core/models/connection/index.ts` so it no longer re-exports connection runtime surfaces that now belong to `@nile/connections`.
- Updated architecture and behavior tests to assert against the new ownership model instead of the old core-owned compatibility path.

### Files changed

- [packages/connections/src/labeling/Labeler.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/labeling/Labeler.ts)
- [packages/connections/src/labeling/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/labeling/index.ts)
- [packages/connections/types/labeling/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/types/labeling/index.d.ts)
- [packages/connections/src/support/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/Types.ts)
- [packages/connections/src/support/OnboardingPolicy.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/OnboardingPolicy.ts)
- [packages/connections/src/support/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/support/index.ts)
- [packages/connections/src/mutations/Creator.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Creator.ts)
- [packages/connections/src/mutations/Preparation.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/mutations/Preparation.ts)
- [packages/connections/src/setup/OpenAiEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/OpenAiEndpointBuilder.ts)
- [packages/connections/src/setup/GatewayEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/GatewayEndpointBuilder.ts)
- [packages/connections/src/setup/AnthropicEndpointBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/setup/AnthropicEndpointBuilder.ts)
- [packages/connections/types/support/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/types/support/index.d.ts)
- [packages/connections/types/mutations/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/types/mutations/index.d.ts)
- [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- [packages/core/src/models/connection/Labeler.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Labeler.ts)
- [packages/core/src/models/connection/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/index.ts)
- [apps/cli/src/commands/ConnectionOnboardingPrompts.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/ConnectionOnboardingPrompts.ts)
- [apps/cli/src/commands/ConnectionAddFlow.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/ConnectionAddFlow.ts)
- [apps/cli/src/commands/ConnectionAgentSelectionFlow.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/ConnectionAgentSelectionFlow.ts)
- [apps/desktop/src/electron/connections/DesktopConnectionManager.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/desktop/src/electron/connections/DesktopConnectionManager.ts)
- [apps/desktop/src/electron/connections/contracts.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/desktop/src/electron/connections/contracts.ts)
- [apps/desktop/src/electron/connections/DesktopPreparedDraftStore.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/desktop/src/electron/connections/DesktopPreparedDraftStore.ts)

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Result

- `ConnectionLabeler` is now connection-domain owned instead of core-owned.
- `ConnectionOnboardingSuggestion` no longer has duplicated type ownership in core.
- New repo-internal code no longer needs to go through `@nile/core/models/connection` for connection runtime surfaces.
- `@nile/core/models/connection/index.ts` is now a narrower contract/registry surface instead of a broad runtime compatibility barrel.
