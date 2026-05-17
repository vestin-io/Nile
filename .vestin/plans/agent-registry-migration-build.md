# Agent Registry Migration Build Log

## Phase 1-4 and Phase 6

### Tasks completed

- Added a browser-safe `AgentRegistry` as the single manifest-owned source for:
  - agent id
  - label
  - icon key
  - apply requirements
  - managed env support
  - supported connection family ids
  - auto selection sync
  - connection entry mode
- Moved `AgentCapabilities` to derive from registry-owned manifest data instead of a hardcoded map.
- Updated `Types.ts` to derive supported ids and labels from the registry-owned manifests.
- Exported the registry through `packages/core` build/package surfaces.
- Added registry-focused tests and updated capability tests to verify manifest-owned capability reads.
- Added `ConnectionFamilyManifest` / `ConnectionFamilyRegistry` as the shared source for:
  - auth mode
  - protocol ownership
  - selectable presets
  - current local session source ownership
- Moved `ConnectionSupportKinds` to derive from the family registry instead of hand-maintained switch logic.
- Added `CurrentSessionSourceRegistry` as the single source for:
  - current session source id
  - family ownership
  - auth mode
  - resolver behavior
- Moved `CurrentSessionResolver` to delegate through the current-session source registry instead of keeping one branch per source.
- Updated `LocalCredentialResolver` and `LocalCredentialRequestBuilder` so current-session sources are handled through shared source shapes instead of ad hoc per-agent branching.
- Extracted current-session behavior out of `application/local` into a dedicated [packages/core/src/session](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session) module with:
  - [Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Types.ts)
  - [Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Registry.ts)
  - [Resolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Resolver.ts)
  - [index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/index.ts)
- Reduced `application/local` ownership so it now consumes session-source behavior instead of owning its registry and resolver types directly.
- Added `AgentFactoryRegistry` so runtime adapter construction is no longer a hardcoded list inside `BuiltInAdapters`.
- Removed remaining shared-core deep imports into agent-private files for runtime wiring and connection model catalog reads.

### Files changed

- [packages/core/src/models/agent/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Registry.ts)
- [packages/core/src/models/agent/Registry.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Registry.test.ts)
- [packages/core/src/models/agent/Capabilities.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Capabilities.ts)
- [packages/core/src/models/agent/Capabilities.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Capabilities.test.ts)
- [packages/core/src/models/agent/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Types.ts)
- [packages/core/src/models/agent/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/index.ts)
- [packages/core/src/models/connection/FamilyTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/FamilyTypes.ts)
- [packages/core/src/models/connection/FamilyRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/FamilyRegistry.ts)
- [packages/core/src/models/connection/FamilyRegistry.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/FamilyRegistry.test.ts)
- [packages/core/src/models/connection/SourceTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/SourceTypes.ts)
- [packages/core/src/models/connection/Support.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/Support.ts)
- [packages/core/src/models/connection/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/index.ts)
- [packages/core/src/application/local/CurrentSessionSourceRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/CurrentSessionSourceRegistry.ts)
- [packages/core/src/application/local/CurrentSessionSourceRegistry.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/CurrentSessionSourceRegistry.test.ts)
- [packages/core/src/application/local/CredentialRequest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/CredentialRequest.ts)
- [packages/core/src/application/local/CurrentSessionResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/CurrentSessionResolver.ts)
- [packages/core/src/application/local/LocalCredentialRequestBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/LocalCredentialRequestBuilder.ts)
- [packages/core/src/application/local/LocalCredentialResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/LocalCredentialResolver.ts)
- [packages/core/src/application/local/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/index.ts)
- [packages/core/src/runtime-local/AgentFactoryRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentFactoryRegistry.ts)
- [packages/core/src/runtime-local/AgentFactoryRegistry.test.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentFactoryRegistry.test.ts)
- [packages/core/src/runtime-local/BuiltInAdapters.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/BuiltInAdapters.ts)
- [packages/core/src/runtime-local/SessionRuntime.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/SessionRuntime.ts)
- [packages/core/src/runtime-local/SessionWorkspaceResources.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/SessionWorkspaceResources.ts)
- [packages/core/src/runtime-local/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/index.ts)
- [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- [packages/core/build.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/build.mjs)

### Decisions

- Kept `Types.ts` as the renderer-safe/public narrow surface for now, but made it derive from `Registry.ts` instead of owning its own agent list.
- Kept `AgentIcons.ts` unchanged. The metadata source is now centralized, but the worktree still resolves workspace packages through a mixed local/shared dependency setup. Pulling renderer icon lookup through a new package subpath would have mixed this migration with unrelated worktree module-resolution friction.
- Kept `Homes.ts` outside the first registry extraction. Home resolution is not browser-safe and does not belong in the initial manifest/family/source ownership cleanup.
- Treated `CurrentSessionSourceRegistry` as an application-layer consumer of family-owned source ids, while keeping the source id type itself in `models/connection` so family ownership does not depend on `application/local`.
- After the first pass, promoted current-session registry/resolver behavior into a dedicated `session/` module because it had become a cross-cutting boundary rather than an `application/local` detail.
- Used a separate runtime `AgentFactoryRegistry` rather than forcing adapter factories into the browser-safe manifest file. This keeps the agent metadata registry renderer-safe while still removing hardcoded runtime adapter lists.
- Did not start Phase 5. The start condition is still not met: Gemini currently owns the only hybrid session backend with stable preferred/fallback semantics.

### Follow-up fixes during verification

- Updated the Gemini live-setup reader expectation to match the current shared endpoint/access shape:
  - endpoint uses `rootUrl`
  - detected endpoint uses `baseUrl`
  - stored Gemini credential now carries optional `tokenType`, `scope`, and `expiryDate` fields when present
- Fixed the desktop Claude current-session test to pass the explicit `claudeSessionSource: "current_claude"` source instead of relying on earlier implicit behavior.
- Hardened `GeminiKeychainCredentialStore` so keychain "invalid parameters" errors are treated as backend unavailability whether they appear in `stderr` or `errorMessage`.
  This preserves the intended Gemini backend fallback behavior: current-session reads may fall back to `~/.gemini/oauth_creds.json` when the keychain backend is unavailable.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/agent/Registry.test.ts packages/core/src/models/agent/Capabilities.test.ts packages/core/src/models/connection/FamilyRegistry.test.ts packages/core/src/models/connection/Support.test.ts packages/core/src/application/local/CurrentSessionSourceRegistry.test.ts packages/core/src/application/local/LocalCredentialRequestBuilder.test.ts packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/application/local/ConnectionModelCatalog.test.ts packages/core/src/runtime-local/AgentFactoryRegistry.test.ts apps/desktop/src/renderer/CoreImportBoundaries.test.ts apps/desktop/src/state/Surface.test.ts apps/desktop/src/electron/profiles/Manager.test.ts apps/cli/src/NileCli.test.ts`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Verification notes

- `typecheck`, `test:core`, `test:cli`, and `test:desktop` all pass when run sequentially in the worktree.
- Running `typecheck`, `test:cli`, and `test:desktop` in parallel against the same worktree can produce a false-negative `build:core` failure because each command rebuilds `packages/core/dist` and the macOS keychain helper slices in place. That is a worktree-local verification hazard, not a registry-migration regression.

### Completion notes

- The remaining intentional non-goals are still non-goals:
  - Phase 5 shared session-backend extraction is deferred until a second agent shares Gemini's backend semantics.
  - Phase 7 physical package split remains optional.
- The remaining low-priority cleanup after this migration is:
  - align renderer icon lookup with manifest-owned metadata once workspace/package resolution is less noisy in the worktree
  - evaluate whether `Homes.ts` should join a later registry/public-surface cleanup pass
- The main remaining structural gap before “mostly implement one agent module and register it” is:
  - session-backend sharing still only exists for Gemini semantics
  - family-level modeling still spans registry plus projection/strategy ownership
  - physical package split has not been attempted because internal boundaries only just became package-like

## Additional structure pass

### Tasks completed

- Reorganized agent metadata ownership into a dedicated [packages/core/src/models/agent/registry](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry) directory:
  - [Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Manifest.ts)
  - [Capabilities.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Capabilities.ts)
  - [index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/index.ts)
- Reorganized connection-family ownership into a dedicated [packages/core/src/models/connection/family](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family) directory:
  - [Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.ts)
  - [Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Types.ts)
  - [index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/index.ts)
- Moved runtime adapter construction knowledge into agent-owned files:
  - [packages/core/src/agents/codex/RuntimeFactory.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/codex/RuntimeFactory.ts)
  - [packages/core/src/agents/claude/RuntimeFactory.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/claude/RuntimeFactory.ts)
  - [packages/core/src/agents/cursor/RuntimeFactory.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/cursor/RuntimeFactory.ts)
  - [packages/core/src/agents/gemini/RuntimeFactory.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/gemini/RuntimeFactory.ts)
  - [packages/core/src/agents/openclaw/RuntimeFactory.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/openclaw/RuntimeFactory.ts)
- Moved current-session source resolution knowledge into agent-owned files:
  - [packages/core/src/agents/codex/CurrentSessionSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/codex/CurrentSessionSource.ts)
  - [packages/core/src/agents/claude/CurrentSessionSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/claude/CurrentSessionSource.ts)
  - [packages/core/src/agents/cursor/CurrentSessionSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/cursor/CurrentSessionSource.ts)
  - [packages/core/src/agents/gemini/CurrentSessionSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/gemini/CurrentSessionSource.ts)
- Reduced the shared registries to aggregation-only roles:
  - [packages/core/src/runtime-local/AgentFactoryRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentFactoryRegistry.ts) now aggregates agent-owned runtime factory registrations.
  - [packages/core/src/session/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Registry.ts) now aggregates agent-owned current-session source manifests.
- Added shared runtime-factory types in [packages/core/src/runtime-local/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/Types.ts) so agent-owned runtime factory files do not need to import or define registry internals.
- Updated [vitest.config.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/vitest.config.ts) so worktree test aliasing matches the new public subpath `@nile/core/models/agent/capabilities`.

### Decisions

- Kept `AgentManifest` central for now. The runtime and current-session logic moved into agent-owned files, but metadata still lives in one registry because:
  - it remains browser-safe
  - desktop/CLI surfaces still benefit from one narrow manifest-owned source
  - the next step toward per-agent packages should happen after the runtime/session ownership stops leaking outward
- Kept `CurrentSessionSourceId` in connection-owned shared types rather than deriving it directly from per-agent files. That keeps family ownership and request typing stable while the registry becomes a pure aggregation layer.
- Did not yet split `ApplySelection` / `ImportCurrentConnection` / `RollbackLatestMutation` into even smaller subpackages. Those files are already agent-owned and do not currently block the “one agent boundary” direction.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## Session request cleanup

### Tasks completed

- Removed the remaining handwritten `current_*` switch from `packages/core/src/session/RequestBuilder.ts`.
- Changed current-session request construction to derive `authMode` directly from `CURRENT_SESSION_SOURCE_REGISTRY`.
- Simplified Codex current-session resolution to use the shared optional `authJsonPath` field directly.
- Deleted the legacy named session helpers from `LocalCredentialRequestBuilder`:
  - `buildOpenAiSession`
  - `buildClaudeSession`
  - `buildCursorSession`
  - `buildGeminiSession`
- Updated CLI credential resolution to use the generic `build({ authMode, sessionSource })` path instead of agent-named helper methods.

### Key findings

- The meaningful ownership is now:
  - current-session source manifest owns `authMode`
  - session request builder derives from registry state
  - local application and CLI callers only pass generic session source selection
- The remaining central session debt is now mostly in shared credential unions, not in request-construction branching.

### Verification

- `npm run typecheck`
- `npm run test:cli`

## SessionRuntime cleanup

### Tasks completed

- Removed `packages/core/src/runtime-local/SessionRuntime.ts` as a pure forwarding layer.
- Rewired `NileSession` to own:
  - database open/close
  - local credential resolver creation
  - `SessionResources` composition
- Moved the environment-injected Codex login verification onto `NileSession`'s public local-connection path and deleted the old `SessionRuntime`-owned test.

### Key findings

- `SessionRuntime` was not adding a meaningful responsibility boundary. It only forwarded calls into `SessionResources` while also housing the `LocalCredentialResolver` factory and database close call.
- Deleting the extra layer shortened the most obvious runtime-local delegation chain without changing public `NileSession` behavior.
- `SessionResources` and `SessionWorkspaceResources` still have room to be reorganized later, but removing `SessionRuntime` is a safe first step that reduces one whole hop immediately.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/runtime-local/NileSession.test.ts`

## Usage registry cleanup

### Tasks completed

- Replaced the `authMode + protocol` hardcoded dispatch inside `packages/core/src/actions/usage/Usage.ts` with a `UsageReaderRegistry`.
- Added auth-mode-owned reader adapters for:
  - `openai_session`
  - `openclaw_openai_session`
  - `claude_session`
  - `cursor_session`
- Kept the existing reader implementations stable while moving selection ownership out of the central `Usage` class.

### Key findings

- The main problem in `Usage.ts` was not the remote reader implementations themselves; it was the central `if endpoint.protocols.X && authMode === Y` matrix.
- A small registry is enough to remove that matrix without forcing a larger package move in the same step.
- `Usage.ts` is now an orchestrator over:
  - access lookup
  - endpoint lookup
  - registry-driven reader dispatch
  rather than owning all per-family branching directly.

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/actions/usage/Usage.test.ts`

### Remaining gaps

- `AgentManifest` is still central, not agent-declared. We are closer to “one agent module plus one registration,” but metadata is not yet emitted from each agent module.
- `ConnectionFamilyRegistry` is central and still coexists with family behavior in projection/strategy code.
- `session backend` sharing is still Gemini-only. There is no repo-wide shared hybrid session backend abstraction yet.
- Physical workspace package split (`packages/agents/*`) has still not started. The code is now visibly more package-like, but the actual workspace/package boundary has not been exercised.

## Local support boundary cleanup

### Tasks completed

- Replaced the shared-core `LocalCursorOps` / `CursorSessionTypes` surface with generic local connection support contracts in `packages/core/src/runtime-local/LocalConnectionSupport.ts`.
- Removed cursor-specific local usage methods from `NileSession`, `SessionResources`, and `SessionWorkspaceResources`.
- Moved explicit cursor usage bind/auto-bind/follow-up flows behind `@nile/agent-cursor/usage` workspace helpers so CLI and desktop surfaces call the cursor package directly instead of routing through core.
- Updated workspace usage aggregation so local supports contribute readers and cleanup through `LocalConnectionSupport`.
- Replaced the central preset branch in `packages/connections/src/setup/EndpointBuilder.ts` with per-preset endpoint modules plus one aggregation list.
- Broadened connection preset onboarding config to consume the full `EndpointProtocols` shape instead of a handwritten subset.
- Synced the checked-in declaration files and usage tests with the new public surface.

### Key findings

- Core no longer leaks cursor-specific local usage APIs. The remaining `cursor`-named bind/auto-bind entry points are user-facing desktop/CLI operations or cursor-package-local implementation details.

## OpenClaw session reuse fix

### Tasks completed

- Taught `LiveSetupMatcher` to treat an incoming `openclaw_openai_session` live state as compatible with an existing saved `openai_session` access when:
  - the endpoint matches
  - the identity key matches
- Added a preference rule so OpenClaw resolves to the standard saved `openai_session` access when both:
  - a legacy `openclaw_openai_session` duplicate
  - and a standard `openai_session`
  exist for the same account.
- Prevented matched imports from overwriting a saved `openai_session` credential with an `openclaw_openai_session` credential shape.
- Removed `modelId` from OpenClaw OAuth session connection labels so agent-specific model settings do not leak into shared connection naming.

### Key findings

- The duplicate `openai.shared@example.test` vs `openai.shared@example.test gpt-5.3-codex` state was caused by two layers of separation:
  - `ConnectionUpsert` only reuses accesses inside the same `authMode`
  - `LiveSetupMatcher` only matched saved accesses inside the same `authMode`
- OpenClaw OAuth sessions and Codex OAuth sessions can identify the same OpenAI account via the same `identityKey`, but they do not share the same stored credential shape.
- The safe fix is:
  - let OpenClaw match and reuse a saved Codex/OpenAI session access
  - but do not replace the stored `openai_session` credential with the OpenClaw-specific credential shape

### Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/agents/openclaw/src/live-setup/Detector.test.ts packages/agents/openclaw/src/ImportCurrentConnection.test.ts packages/core/src/actions/live-setup/Matcher.test.ts`
- Adding a new preset still requires one registration in `CONNECTION_PRESET_MODULES`, but the build/onboarding behavior is no longer owned by a central `switch`.
- This repo treats many `.d.ts` files under `packages/core/src` as source artifacts. Boundary changes are not complete unless the matching declaration files move with the `.ts` files.
- A small naming residue remains in `packages/agents/cursor/src/usage/LocalCursorOpsImpl.ts`. It is local to the cursor package and no longer part of the shared-core contract, so I left it out of this fix.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## Review follow-up fixes

### Tasks completed

- Reworked `packages/connections/src/setup/Modules.ts` so endpoint setup modules are ordered and completeness-checked from `CONNECTION_PRESET_MODULES` instead of maintaining a second full preset list by hand.
- Synced `@nile/connections/setup`'s public declaration file with the runtime surface by exporting `ConnectionEndpointBuildInput` and `ConnectionEndpointModule`.
- Added CLI and desktop regression coverage for cursor-session import flows to verify usage auto-bind still runs after follow-up behavior moved out of `NileSession`.

### Key findings

- The remaining preset edit points are now split along responsibility rather than duplication:
  - core owns the preset manifest aggregation list
  - connections owns the per-preset setup implementation map
- The checked-in package `types/` entrypoints can drift even when internal source compiles cleanly. Public-surface review needs to inspect exported declaration files directly, not just `tsc`.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## Preset declaration derivation pass

### Tasks completed

- Made connection preset manifests and modules preserve their literal preset ids through the declaration chain instead of widening them back to `string`.
- Derived `ConnectionPresetFamily` and `SUPPORTED_CONNECTION_PRESET_FAMILIES` from `CONNECTION_PRESET_MODULES` instead of maintaining a separate handwritten id tuple.
- Tightened preset registry and shared preset support to return manifests keyed by `ConnectionPresetFamily`, so internal consumers no longer erase the derived union.
- Synced the checked-in preset declaration files with the broadened onboarding protocol shape and the new derived preset-id exports.
- Updated local connection input typing to consume `ConnectionPresetFamily` directly instead of duplicating the preset literal union in `CreateLocalConnectionInput`.

### Key findings

- The previous attempt only changed the manifest type, which was not enough: `ConnectionPresetModule` and preset constant annotations were still widening ids back to `string`.
- `packages/core/src/models/connection/preset/Registry.ts` and `packages/core/src/models/connection/PresetSupport.ts` were also re-widening the derived ids by returning generic `ConnectionPresetManifest` values.
- Running `npm run test:cli` and `npm run test:desktop` in parallel can race inside the macOS `lipo` step in `@nile/core` build output assembly. The desktop failure in that configuration was a build concurrency issue, not a preset regression.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## Agent-owned manifest pass

### Tasks completed

- Moved agent metadata declarations out of the central manifest file into agent-owned files:
  - [packages/core/src/agents/codex/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/codex/Manifest.ts)
  - [packages/core/src/agents/claude/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/claude/Manifest.ts)
  - [packages/core/src/agents/cursor/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/cursor/Manifest.ts)
  - [packages/core/src/agents/gemini/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/gemini/Manifest.ts)
  - [packages/core/src/agents/openclaw/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/openclaw/Manifest.ts)
- Reduced [packages/core/src/models/agent/registry/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Manifest.ts) to a pure aggregation layer over agent-owned manifests.
- Added [packages/core/src/models/agent/registry/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Types.ts) so manifest definitions can be typed without importing the aggregation layer itself.
- Narrowed central aggregation imports:
  - runtime registry imports direct `RuntimeFactory.ts` files
  - session registry imports direct `CurrentSessionSource.ts` files
  - manifest registry imports direct `Manifest.ts` files
  This removes the accidental cycles that came from importing full agent `index.ts` surfaces back into central registries.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated remaining gaps

- `AgentManifest` ownership is now agent-local, but `ConnectionFamilyRegistry` is still central and still shares ownership with projection/strategy code.
- `CurrentSessionSource` and runtime factory ownership are now agent-local, but session backend behavior is still only generalized enough for Gemini.
- The code now has visible package-like structure at:
  - [packages/core/src/agents](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents)
  - [packages/core/src/session](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session)
  - [packages/core/src/models/agent/registry](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry)
  - [packages/core/src/models/connection/family](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family)
- The biggest remaining step before a real `packages/agents/*` split is still:
  - finish shrinking family ownership into registries plus agent-local logic
  - decide whether shared session backend semantics are now stable enough to extract

## Family-owned manifest pass

### Tasks completed

- Moved connection family declarations out of the central family registry file into family-owned files:
  - [OpenAiApiKey.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenAiApiKey.ts)
  - [AnthropicApiKey.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/AnthropicApiKey.ts)
  - [CursorApiKey.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/CursorApiKey.ts)
  - [OpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenAiSession.ts)
  - [OpenClawOpenAiSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/OpenClawOpenAiSession.ts)
  - [ClaudeSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ClaudeSession.ts)
  - [CursorSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/CursorSession.ts)
- [GeminiCliSession.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/GeminiCliSession.ts)

## Repetition reduction pass

### Tasks completed

- Added a shared class-based indexed registry helper so registry modules stop rebuilding their own `Map` indexes and repeating the same `list/read` plumbing:
  - [packages/core/src/services/IndexedRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/services/IndexedRegistry.ts)
- Rewired the shared registries to use that helper instead of duplicating one-off indexing logic:
  - [packages/core/src/runtime-local/AgentFactoryRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentFactoryRegistry.ts)
  - [packages/core/src/session/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Registry.ts)
  - [packages/core/src/session/Login.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Login.ts)
  - [packages/core/src/projection/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/Registry.ts)
- Added a shared class-oriented session credential resolver so `current_*` and `login` session flows go through one session module surface instead of leaving interactive login as a hardcoded auth-mode matrix in `LocalCredentialResolver`:
  - [packages/core/src/session/CredentialResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/CredentialResolver.ts)
  - [packages/core/src/application/local/LocalCredentialResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/LocalCredentialResolver.ts)
  - [packages/core/src/application/local/CredentialRequest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/CredentialRequest.ts)
  - [packages/core/src/application/local/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/index.ts)
- Added a shared workspace binding class to shorten the repeated `open/fromContext -> mutation history -> apply support -> matcher/import support` bootstrap chain used by agent operations:
  - [packages/core/src/runtime-local/AgentWorkspaceBinding.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentWorkspaceBinding.ts)
  - [packages/core/src/runtime-local/AbstractAgentStateDetector.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AbstractAgentStateDetector.ts)
- Moved all five agent packages to that shared workspace binding for:
  - `ApplySelection`
  - `ImportCurrentConnection`
  - `RollbackLatestMutation`
  - `live-setup/Detector`
- Kept the new sharing class-oriented:
  - `IndexedRegistry`
  - `SessionCredentialResolver`
  - `AgentWorkspaceBinding`
  rather than replacing these flows with functional helper pipelines.

### Decisions

- Did not abstract the near-identical `Module.ts` files yet. They still serve cycle-breaking lazy getters, and forcing a generic factory there is lower value than shortening operation bootstrapping and centralizing session/login resolution.
- Kept `LocalCredentialResolver` responsible for API key materialization while moving session-specific login/current-session resolution into the `session` module. This keeps the split concrete instead of creating a too-broad generic credential framework.
- Treated the repeated operation setup as a runtime composition concern, so it belongs in `runtime-local` as a class rather than as free helper functions spread across agent packages.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Verification notes

- `npm run test:desktop` and `npm run test:cli` both pass when run sequentially after the repetition-reduction changes.
- A parallel run of `test:cli` and `test:desktop` in the same worktree still produces the known false-negative `lipo` race while rebuilding the macOS keychain helper inside `packages/core/dist`. That is a verification hazard in the worktree, not a regression from these refactors.

### Updated result

- The longest repeated agent operation bootstrap chains are now centralized behind a shared class.
- Interactive login no longer remains a second-class hardcoded branch outside the session module.
- Shared registries no longer each carry their own one-off index-building implementation.
- The code remains class-oriented; these reductions did not turn the structure into function-pipeline-style programming.
- Added [ManifestTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/ManifestTypes.ts) so family-owned declaration files can share one typing surface without importing the central registry.
- Reduced [Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.ts) to a pure aggregation and lookup layer over family-owned manifest files.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated remaining gaps

- Both `agent` and `connection family` manifests are now locally declared and centrally aggregated.
- Runtime adapter factories and current-session sources are agent-local.
- The biggest remaining ownership gap is now:
  - family behavior still spans central registry plus projection/strategy classes
  - shared session backend semantics are still Gemini-only
  - physical workspace package split is still untested

## Agent-owned projection pass

### Tasks completed

- Removed the central `projection/strategies/` ownership split by moving projection behavior into agent-owned files:
  - [packages/core/src/agents/codex/Projection.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/codex/Projection.ts)
  - [packages/core/src/agents/claude/Projection.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/claude/Projection.ts)
  - [packages/core/src/agents/cursor/Projection.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/cursor/Projection.ts)
  - [packages/core/src/agents/gemini/Projection.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/gemini/Projection.ts)
  - [packages/core/src/agents/openclaw/Projection.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/openclaw/Projection.ts)
- Added [packages/core/src/projection/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/Registry.ts) so shared projection ownership is now:
  - registration and lookup in central projection registry
  - actual projection logic in agent-owned files
- Reduced [packages/core/src/projection/Resolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/Resolver.ts) to a thin delegator over the central projection registry.
- Deleted the old central strategy files under `packages/core/src/projection/strategies/`.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`

## Gemini physical package spike

### Tasks completed

- Added a real workspace package at [packages/agents/gemini](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini).
- Moved Gemini's package-like surface files out of `packages/core/src/agents/gemini` and into the new package:
  - [Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/Manifest.ts)
  - [RuntimeFactory.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/RuntimeFactory.ts)
  - [CurrentSessionSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/CurrentSessionSource.ts)
  - [Projection.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/Projection.ts)
- Reduced the shared registries to consume Gemini through package subpaths instead of local core files:
  - [packages/core/src/models/agent/registry/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Manifest.ts)
  - [packages/core/src/runtime-local/AgentFactoryRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentFactoryRegistry.ts)
  - [packages/core/src/session/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Registry.ts)
  - [packages/core/src/projection/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/Registry.ts)
- Added package-aware resolution for the spike:
  - root workspace entry in [package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/package.json)
  - TS path aliases in [tsconfig.base.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.json)
  - Vitest aliases in [vitest.config.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/vitest.config.ts)
  - core build aliases in [packages/core/build.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/build.mjs)

### Key finding

- A single wide package entry (`@nile/agent-gemini`) immediately reintroduced cycles:
  - manifest registry loaded runtime factory
  - runtime factory loaded `Homes.ts`
  - `Homes.ts` loaded agent types
  - agent types read manifest registry before it finished initializing
- The workable shape is:
  - package root may exist for convenience
  - shared registries must import **narrow package subpaths**
    - `@nile/agent-gemini/manifest`
    - `@nile/agent-gemini/runtime-factory`
    - `@nile/agent-gemini/current-session-source`
    - `@nile/agent-gemini/projection`

### Build-system decision

- `@nile/core` declaration build still assumes `rootDir = packages/core/src`, so importing external package source directly breaks declaration generation.
- For this spike, the workable compromise is:
  - JS bundling resolves Gemini package subpaths to real source through esbuild alias
  - core declaration build resolves Gemini package subpaths through local shims under [packages/core/src/shims](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/shims)
- This is intentionally a spike-level solution, not the final multi-package publish graph.

### Verification

- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/models/agent/registry/Manifest.test.ts packages/core/src/runtime-local/AgentFactoryRegistry.test.ts packages/core/src/session/Registry.test.ts packages/core/src/projection/Resolver.test.ts packages/core/src/agents/gemini/ImportCurrentConnection.test.ts packages/core/src/agents/gemini/ApplySelection.test.ts`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Result

- The repository can now tolerate **one real agent package** without losing typecheck or test stability.
- The spike also clarified the next structural truth:
  - package split is viable
  - but shared registries must depend on **narrow surfaces**
  - and the final multi-package build graph will need a cleaner solution than declaration shims if we split more agents

## Full agent surface package move

### Tasks completed

- Added real workspace packages for the remaining agent-owned registry surfaces:
  - [packages/agents/codex](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex)
  - [packages/agents/claude](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude)
  - [packages/agents/cursor](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/cursor)
  - [packages/agents/openclaw](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/openclaw)
- Moved the registry-owned surfaces out of `packages/core/src/agents/*` for those agents:
  - `Manifest.ts`
  - `RuntimeFactory.ts`
  - `CurrentSessionSource.ts` where applicable
  - `Projection.ts`
- Updated shared registries so all agent-owned registry surfaces now come from `packages/agents/*` package subpaths instead of `packages/core/src/agents/*`:
  - [packages/core/src/models/agent/registry/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Manifest.ts)
  - [packages/core/src/runtime-local/AgentFactoryRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentFactoryRegistry.ts)
  - [packages/core/src/session/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Registry.ts)
  - [packages/core/src/projection/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/Registry.ts)
- Expanded build/test/package resolution support for all agent packages:
  - [tsconfig.base.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.json)
  - [vitest.config.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/vitest.config.ts)
  - [packages/core/build.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/build.mjs)
  - [packages/core/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.build.json)

### Key findings

- The narrow-subpath rule is not just a Gemini quirk. It is the general requirement for package-like agent surfaces:
  - registries must import `manifest`, `runtime-factory`, `current-session-source`, and `projection` separately
  - they must not import a wide package root that re-exports everything
- Once all five agents follow that rule, the repo can keep:
  - browser-safe metadata ownership
  - runtime factory ownership
  - current-session source ownership
  - projection ownership
  outside `@nile/core` implementation directories without destabilizing typecheck or tests

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- The repository now has a visible physical package structure for agent-owned registry surfaces:
  - `packages/agents/codex`
  - `packages/agents/claude`
  - `packages/agents/cursor`
  - `packages/agents/gemini`
  - `packages/agents/openclaw`
- This is closer to the target state than the earlier “package-like directories inside core” stage.
- The remaining structural gaps are now narrower:
  - deeper agent implementation files still live under `packages/core/src/agents/*`
  - declaration shims are still a spike-level workaround for `@nile/core` build output
  - shared session-backend behavior is still not a first-class repo-wide package/module
- `npm run test:desktop`

### Updated remaining gaps

- `agent` manifests, runtime factories, current-session sources, and projection logic are now agent-owned.
- `connection family` manifests are family-owned and centrally aggregated.
- The main remaining gaps before a true `packages/agents/*` split are now:
  - shared session backend semantics are still only proven for Gemini
  - connection-family ownership still has some deep behavior outside the family registry (for example endpoint/projection coupling)
  - workspace/package boundaries themselves have not yet been exercised

## Gemini full implementation move

### Tasks completed

- Moved Gemini's deeper implementation and tests out of `packages/core/src/agents/gemini` and into the real package:
  - [packages/agents/gemini/src](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src)
- Deleted the old core Gemini implementation directory so the package is now the only implementation truth source.
- Updated Gemini package code to depend on:
  - local package files for Gemini-owned implementation
  - narrow `@nile/core/...` surfaces for shared runtime, history, credential, projection, and registry concerns
- Expanded source-level package resolution so workspace code can compile against `@nile/core/*` and `@nile/agent-*/*` directly:
  - [tsconfig.base.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.json)
- Added the missing shared-core public surfaces needed by agent packages:
  - [packages/core/src/services/credential/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/services/credential/index.ts)
  - [packages/core/src/services/history/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/services/history/index.ts)
  - [packages/core/src/runtime-local/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/index.ts)
  - [packages/core/src/projection/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/index.ts)
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
  - [packages/core/build.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/build.mjs)
- Broadened core test coverage so `test:core` now runs package-owned agent tests too:
  - [package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/package.json)
  - [vitest.config.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/vitest.config.ts)
- Pinned `host-local` back to `@nile/core` dist types during its declaration build so the new source-level aliases do not violate its `rootDir`:
  - [packages/host-local/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/host-local/tsconfig.build.json)

### Key findings

- Source-level package moves need two separate dependency modes:
  - workspace source resolution for app/core/package development
  - dist-based resolution for leaf package declaration builds like `host-local`
- `@nile/core/*` source aliases are viable, but they must pin lowercase public subpaths to the exact canonical file casing or TypeScript will surface macOS-only casing drift immediately.
- `runtime-local` wide index imports were too broad for Gemini's detector path and caused a runtime cycle. Package-owned implementation works better when it consumes narrow runtime files like:
  - `@nile/core/runtime-local/AbstractAgentStateDetector`
  - `@nile/core/runtime-local/AgentWorkspaceSession`
  - `@nile/core/runtime-local/AgentWorkspaceContext`

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- Gemini is now no longer a “surface-only” package spike. It is the first agent whose full implementation has been physically moved out of core.
- The repository now proves a stronger target shape:
  - shared registries in core
  - shared family/session/runtime contracts in core
  - full agent implementation owned by `packages/agents/<agent>`
- The remaining gaps are now clearer and narrower:
  - other agents still keep their deeper implementation under `packages/core/src/agents/*`
  - declaration shims remain a transitional build-graph compromise
  - session backend sharing is still only concretely validated on Gemini

## Codex full implementation move

### Tasks completed

- Moved Codex's deeper implementation and tests out of `packages/core/src/agents/codex` and into the real package:
  - [packages/agents/codex/src](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src)
- Deleted the old core Codex implementation directory so the package is now the single implementation truth source.
- Updated Codex package code to depend on:
  - local package files for Codex-owned implementation
  - narrow `@nile/core/...` surfaces for shared runtime, history, credential, projection, and registry concerns
- Restored the package root surface so the package now exports both:
  - Codex runtime implementation like `CodexAgentAdapter` and `CodexSessionLogin`
  - registry-owned surfaces like `CODEX_MANIFEST`, `CODEX_RUNTIME_FACTORY`, `CODEX_CURRENT_SESSION_SOURCE`, and `CODEX_PROJECTION`
- Added the missing shared-core public surfaces needed by the Codex package:
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
  - [packages/core/build.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/build.mjs)
  - [packages/core/src/shims/AgentCodex.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/shims/AgentCodex.d.ts)
  - `@nile/core/agents/RollbackLatest`
- Switched the remaining shared core consumers that still expected the old in-core `CodexSessionLogin` class identity:
  - [packages/core/src/application/local/LocalCredentialResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/LocalCredentialResolver.ts)
  - [packages/core/src/runtime-local/SessionRuntime.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/SessionRuntime.ts)
  - [packages/core/src/agents/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/index.ts)

### Key findings

- Moving a deeper session agent out of core exposed a second package-split rule beyond narrow registry subpaths:
  - shared consumers must not keep typing against old in-core class identities once a runtime class moves to a package
  - otherwise TypeScript sees two incompatible `CodexSessionLogin` classes even when the runtime behavior is identical
- Session-oriented agent packages need a small set of shared-core operational surfaces that are not registry metadata:
  - `ApplyMutation`
  - `ApplySelectionValidationError`
  - `RollbackLatest`
  - `EnvironmentSource`
  - text-file helpers
  - history services
- After those exist as explicit narrow exports, a deeper agent move is much more mechanical.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- Codex is now the second agent whose full implementation has been physically moved out of core.
- The repository now proves that package-owned runtime/session agents are viable for both:
  - a new hybrid session agent (`gemini`)
  - an older, deeper existing session agent (`codex`)
- The most important remaining gaps are now:
  - Claude, Cursor, and OpenClaw deeper implementations still live under `packages/core/src/agents/*`
  - declaration shims are still a transitional build-graph compromise
  - shared session-backend behavior is still only concretely validated on Gemini

## Claude full implementation move

### Tasks completed

- Moved Claude's deeper implementation and tests out of `packages/core/src/agents/claude` and into the real package:
  - [packages/agents/claude/src](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src)
- Deleted the old core Claude implementation directory so the package is now the single implementation truth source.
- Finished normalizing Claude package imports so package-owned implementation now depends on:
  - local package files for Claude-owned logic
  - narrow `@nile/core/...` surfaces for shared runtime, history, credential, projection, and registry concerns
- Restored the package root surface so the package now exports both:
  - Claude runtime implementation like `ClaudeAgentAdapter`, `ClaudeSessionLogin`, and `ClaudeGatewayModelCatalog`
  - registry-owned surfaces like `CLAUDE_MANIFEST`, `CLAUDE_RUNTIME_FACTORY`, `CLAUDE_CURRENT_SESSION_SOURCE`, and `CLAUDE_PROJECTION`
- Added the missing root declaration shim and build-graph path needed by the new root package consumer shape:
  - [packages/core/src/shims/AgentClaude.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/shims/AgentClaude.d.ts)
  - [packages/core/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.build.json)
- Switched remaining shared-core consumers that still referenced in-core Claude classes directly:
  - [packages/core/src/agents/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/index.ts)
  - [packages/core/src/application/local/LocalCredentialResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/LocalCredentialResolver.ts)
  - [packages/core/src/application/local/ConnectionModelCatalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ConnectionModelCatalog.ts)
  - [packages/core/src/runtime-local/SessionWorkspaceResources.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/SessionWorkspaceResources.ts)

### Key findings

- Claude exposed the same package-split rule as Codex, but with one extra shared-consumer wrinkle:
  - some shared-core readers like `ConnectionModelCatalog` and `SessionWorkspaceResources` still depended on an agent-owned helper class
  - once an agent moves out of core, those consumers must switch to the package root too or the old in-core directory remains a hidden runtime truth source
- Root package shims are not only for login helpers and adapters:
  - agent-owned support classes like `ClaudeGatewayModelCatalog` can also need a root declaration surface once shared-core consumers depend on them
- Running `test:cli` and `test:desktop` in parallel still reproduces the existing universal-helper race in `@nile/core`'s macOS keychain helper build.
  - sequential verification remains the correct signal for this migration slice

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`
- `npm run test:cli`

### Updated result

- Claude is now the third agent whose full implementation has been physically moved out of core.
- The repository now proves that package-owned agent moves work for:
  - Gemini
  - Codex
  - Claude
- The remaining deeper-cutover agents are now narrower and clearer:
  - Cursor
  - OpenClaw

## Cursor full implementation move

### Tasks completed

- Moved Cursor's deeper implementation and tests out of `packages/core/src/agents/cursor` and into the real package:
  - [packages/agents/cursor/src](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/cursor/src)
- Deleted the old core Cursor implementation directory so the package is now the single implementation truth source.
- Finished normalizing Cursor package imports so package-owned implementation now depends on:
  - local package files for Cursor-owned logic
  - narrow `@nile/core/...` surfaces for shared runtime, history, credential, projection, and registry concerns
- Restored the package root surface so the package now exports both:
  - Cursor runtime implementation like `CursorAgentAdapter`, `CurrentCredentialReader`, `CursorConfigStore`, and `CursorCredentialStore`
  - registry-owned surfaces like `CURSOR_MANIFEST`, `CURSOR_RUNTIME_FACTORY`, `CURSOR_CURRENT_SESSION_SOURCE`, and `CURSOR_PROJECTION`
- Added the missing root declaration shim and build-graph path needed by the new root package consumer shape:
  - [packages/core/src/shims/AgentCursor.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/shims/AgentCursor.d.ts)
  - [packages/core/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.build.json)
- Switched the remaining shared-core root consumer:
  - [packages/core/src/agents/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/index.ts)

### Key findings

- Cursor was the cleanest proof so far that once registry ownership and package surfaces are in place, a deeper move can become mostly mechanical.
- Unlike Codex and Claude, Cursor did not need extra shared-core root consumers beyond `@nile/core/agents`.
  - That makes it a good reference for future non-login session agents.
- The remaining complexity is now concentrated in OpenClaw and shared backend behavior, not in the basic package-split pattern itself.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Updated result

- Cursor is now the fourth agent whose full implementation has been physically moved out of core.
- The remaining deeper-cutover agent is now:
  - OpenClaw

## OpenClaw full implementation move

### Tasks completed

- Moved OpenClaw's deeper implementation and tests out of `packages/core/src/agents/openclaw` and into the real package:
  - [packages/agents/openclaw/src](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/openclaw/src)
- Deleted the old core OpenClaw implementation directory so the package is now the single implementation truth source.
- Finished normalizing OpenClaw package imports so package-owned implementation now depends on:
  - local package files for OpenClaw-owned logic
  - narrow `@nile/core/...` surfaces for shared runtime, history, credential, projection, and registry concerns
- Restored the package root surface so the package now exports both:
  - OpenClaw runtime implementation like `OpenClawAgentAdapter`, `ApplySelection`, `ImportCurrentConnection`, `OpenClawConfigStore`, and `OpenClawAuthProfileStore`
  - registry-owned surfaces like `OPENCLAW_MANIFEST`, `OPENCLAW_RUNTIME_FACTORY`, and `OPENCLAW_PROJECTION`
- Added the missing root declaration shim and build-graph path needed by the new root package consumer shape:
  - [packages/core/src/shims/AgentOpenClaw.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/shims/AgentOpenClaw.d.ts)
  - [packages/core/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.build.json)
- Switched the remaining shared-core root consumer:
  - [packages/core/src/agents/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/agents/index.ts)

### Key findings

- OpenClaw confirmed that the package-split pattern also works for a more complex agent with:
  - richer projection behavior
  - agent-owned config/auth profile stores
  - no current-session registry surface
- After the earlier registry and family migration, even the most complex remaining agent still reduced to the same mechanical move:
  - normalize imports
  - expose root package surface
  - add shim
  - switch root consumer
  - delete old core directory
- At this point the main remaining complexity is no longer “can agents move out of core”, but:
  - whether shared session backend behavior should become a repo-level module
  - whether declaration shims should be replaced with a more formal multi-package build graph

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- OpenClaw is now the fifth agent whose full implementation has been physically moved out of core.
- All current agent deeper implementations now live under `packages/agents/*`.
- Empty agent-specific directories under `packages/core/src/agents/*` were removed, so `packages/core/src/agents` now only holds shared helper modules like `ApplyMutation`, `ApplySelectionValidationError`, and `RollbackLatest`.
- The remaining structural gaps are now:
  - declaration shims remain a transitional build-graph compromise
  - shared session-backend behavior is still only concretely generalized through Gemini
  - family behavior still spans registries plus some strategy/projection logic

## Remaining runtime wiring cleanup

### Tasks completed

- Added an interactive login registry under shared session ownership:
  - [packages/core/src/session/Login.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Login.ts)
- Added package-owned login surfaces:
  - [packages/agents/codex/src/LoginSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src/LoginSource.ts)
  - [packages/agents/claude/src/LoginSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/LoginSource.ts)
- Rewired `LocalCredentialResolver` so `core` no longer directly imports:
  - `CodexSessionLogin`
  - `ClaudeSessionLogin`
- Added a local model-catalog source registry:
  - [packages/core/src/application/local/ModelCatalogSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ModelCatalogSource.ts)
- Added a Claude-owned model-catalog source surface:
  - [packages/agents/claude/src/ModelCatalogSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/ModelCatalogSource.ts)
- Rewired `SessionWorkspaceResources` and `ConnectionModelCatalog` so `core` no longer directly imports:
  - `ClaudeGatewayModelCatalog`
- Updated source-level aliases, package exports, Vitest aliases, and declaration shims for the new narrow package surfaces.
- Updated unit tests so they no longer need direct runtime imports from Codex/Claude packages just to stub login or catalog behavior.

### Key findings

- The remaining agent-specific runtime wiring was small, but it exposed a useful pattern:
  - `current session` and `interactive login` are not the same registry surface
  - they should stay adjacent under `session`, but not be conflated
- Claude gateway cache behavior fits better as a local model-catalog source than as a hardcoded branch inside `ConnectionModelCatalog`.
- After this cleanup, the remaining cross-package coupling is mostly intentional registry aggregation plus transitional build shims, not ad hoc runtime imports.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- `core` no longer directly imports Codex/Claude login implementations or Claude gateway model cache logic in its runtime/local orchestration.
- The remaining structural gaps are now narrower:
  - declaration shims remain transitional
  - registry registration is still multi-point rather than single-point
  - shared session-backend behavior is still only fully validated through Gemini

## Registry cycle cleanup

### Tasks completed

- Reworked `AgentApplySupport` so agent packages inject their own projection resolver instead of routing back through the global projection registry:
  - [packages/core/src/actions/apply/Support.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/actions/apply/Support.ts)
- Updated all agent apply flows and the affected rollback/apply tests to use package-owned projection resolvers:
  - `packages/agents/*/src/ApplySelection.ts`
  - `packages/agents/*/src/*ApplySelection.test.ts`
  - `packages/agents/*/src/*RollbackLatestMutation.test.ts`
- Narrowed remaining runtime-local imports away from the wide `models/agent` barrel:
  - [packages/core/src/runtime-local/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/Types.ts)
  - [packages/core/src/runtime-local/AgentAdapterRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentAdapterRegistry.ts)
  - [packages/core/src/runtime-local/AgentFactoryRegistry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentFactoryRegistry.ts)
- Converted module/registry aggregation to lazy reads where top-level expansion of `AGENT_MODULES` caused package initialization cycles:
  - [packages/core/src/models/agent/registry/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Manifest.ts)
  - [packages/core/src/models/agent/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Types.ts)
  - [packages/core/src/projection/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/Registry.ts)
  - [packages/core/src/session/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Registry.ts)
  - [packages/core/src/session/Login.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Login.ts)
  - [packages/core/src/application/local/ModelCatalogSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ModelCatalogSource.ts)
- Changed each agent package `Module.ts` to expose manifest/runtime/session/projection through getters so the module shell itself no longer eagerly reads sibling exports during cycle-prone initialization.

### Key findings

- The biggest remaining risk after the physical package split was not “agent code still lives in core”, but “shared registries still eagerly materialize every agent surface at module load time”.
- Package-local `Module.ts` files are safe as aggregation shells only if they avoid eager reads of sibling exports during initialization.
- A single global registry layer is still viable, but it needs lazy ownership boundaries:
  - IDs from `Ids.ts`
  - manifests from package-owned `Manifest.ts`
  - runtime/projection/session surfaces only when actually read
- Running verification commands that rebuild `@nile/core` in parallel can still produce a false failure in the macOS keychain helper universal build (`lipo` missing a just-removed slice). Sequential verification remains the correct signal.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- The package-split registries now initialize cleanly without `AGENT_MODULES` / `CODEX_RUNTIME_FACTORY` circular-reference failures.
- `codex`, `claude`, `cursor`, `gemini`, and `openclaw` package surfaces can be imported through their narrow subpaths without triggering global registry initialization crashes.
- The remaining gaps are now mostly architectural polish, not broken runtime structure:
  - registration is still multi-surface rather than a single package-owned declaration
  - declaration shims are still transitional
  - session backend sharing is still only materially proven by Gemini

## Package-owned type surfaces

### Tasks completed

- Added a shared agent-package build script and a root agent-package build orchestration script:
  - [scripts/build-agent-package.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/build-agent-package.mjs)
  - [scripts/build-agent-packages.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/build-agent-packages.mjs)
- Updated each agent package to emit runtime js into `dist/` and own its package type surface under `types/index.d.ts`:
  - [packages/agents/codex/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/package.json)
  - [packages/agents/claude/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/package.json)
  - [packages/agents/cursor/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/cursor/package.json)
  - [packages/agents/gemini/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/package.json)
  - [packages/agents/openclaw/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/openclaw/package.json)
- Added package-owned declaration surfaces:
  - `packages/agents/*/types/index.d.ts`
- Reworked `@nile/core` build/declaration flow to consume:
  - agent runtime js from `packages/agents/*/dist`
  - agent type surfaces from `packages/agents/*/types/index.d.ts`
- Removed the old core-owned declaration shim layer:
  - deleted `packages/core/src/shims/*`
- Moved the Gemini hybrid session backend helper out of `services/credential` and into a repo-level session backend module:
  - [packages/core/src/session/backend/Preferred.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/backend/Preferred.ts)
  - [packages/core/src/session/backend/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/backend/index.ts)
  - [packages/agents/gemini/src/Backend.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/Backend.ts)

### Key findings

- Full per-agent `tsc` declaration builds are not a good fit yet, because agent implementations still import many `@nile/core` source contracts and TypeScript tries to absorb those into the agent package compilation unit.
- Package-owned narrow `types/index.d.ts` surfaces are a better intermediate end-state than core-owned shims:
  - ownership is with the agent package
  - `@nile/core` no longer declares agent package shapes for them
  - runtime build and type surface can evolve independently
- The Gemini work surfaced a repo-level truth:
  - `PreferredBackend` was not a credential-store concern
  - it is a session-backend concern
  - moving it under `session/backend` makes that ownership explicit
- The new package split is now materially visible on disk:
  - agent runtime js in `packages/agents/*/dist`
  - package-owned type surfaces in `packages/agents/*/types`
  - no core-owned shim directory

### Verification

- `npm run build:core`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`
- `find packages/core/src -name '*.d.ts' | wc -l` -> `0`

### Updated result

- `@nile/core` no longer depends on a core-owned agent shim layer for declaration emit.
- Each agent package now owns:
  - its runtime surface
  - its registry surface
  - its package type surface
- The remaining gap to the ideal state is now narrower:
  - registration is still multi-surface rather than one package-owned declaration
  - session backend sharing is now formalized as a module, but still only exercised by Gemini

## Package contract tightening

### Tasks completed

- Narrowed each agent package root runtime surface so `src/index.ts` only exports the intended package public API instead of leaking internal stores, readers, apply flows, and rollback implementations:
  - `packages/agents/*/src/index.ts`
- Tightened the Claude root type surface to match the narrowed runtime surface:
  - [packages/agents/claude/types/index.d.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/types/index.d.ts)
- Split agent package type ownership into:
  - package root types at `types/index.d.ts`
  - subpath-specific types at `types/*.d.ts`
- Updated each agent package export map so subpaths no longer point every `types` entry at the root declaration file:
  - `packages/agents/*/package.json`
- Updated `@nile/core` declaration build path mappings to consume those subpath-specific type files instead of one wide agent type file:
  - [packages/core/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.build.json)
- Added package-contract verification that reads each built `dist/*.js` export list and compares it with the declared `types` surface from `package.json exports`:
  - [scripts/verify-agent-package-contracts.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/verify-agent-package-contracts.mjs)
- Wired that verification into the shared agent-package build step:
  - [scripts/build-agent-packages.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/build-agent-packages.mjs)

### Key findings

- The main structural gap after physical package split was no longer “agent code still lives in core”; it was “runtime exports and declared package contract can silently drift apart”.
- Source-level `tsconfig` and Vitest aliases still intentionally point to `src/*` for development ergonomics, so they are not enough to prove package-boundary correctness on their own.
- Verifying against `package.json exports` targets is the correct place to catch:
  - root runtime export drift
  - overly wide root type files
  - subpath `types` entries that accidentally reuse the wrong declaration surface

### Verification

- `npm run build:core`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- Agent package runtime roots now match their declared public surface.
- Agent package subpaths now have narrower, accurate declaration targets.
- The build now fails if package runtime exports and package-owned declaration surfaces drift apart.
- Human-facing extension guidance now points at the package-split structure.

## Scaffold removal

### Tasks completed

- Removed the legacy `scaffold:agent` npm script from the root workspace:
  - [package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/package.json)
- Deleted the outdated scaffold implementation:
  - [scripts/scaffold-agent.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/scaffold-agent.mjs)
- Rewrote the add-agent guide to be documentation-first instead of scaffold-first:
  - [docs/development/add-agent.md](/Users/jiatwork/Works/nile/.worktrees/agent-registry/docs/development/add-agent.md)

### Key findings

- After the package split, the scaffold had become misleading rather than helpful:
  - it still described a `packages/core/src/agents/*` draft shape
  - while the real target structure is `packages/agents/*`
- The current architecture is now explicit enough that documentation is a better source of truth than a stale generator.
- Keeping a lagging scaffold would encourage reintroducing old ownership patterns during future agent bring-up.

### Verification

- `rg -n "scaffold-agent|scaffold:agent" .` no remaining matches
- `npm run build:core`

### Updated result

- Adding a new agent is now intentionally documentation-driven.
- There is no longer a stale scaffold path competing with the package-owned target structure.

## Alias and artifact cleanup

### Tasks completed

- Reduced source-level agent alias maintenance from one entry per agent/subpath to one entry per subpath shape by using wildcard subpath aliases in the generated root base config:
  - [tsconfig.base.static.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.static.json)
  - [tsconfig.base.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.json)
  - [scripts/write-agent-tsconfig-paths.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/write-agent-tsconfig-paths.mjs)
- Removed the hardcoded per-agent dist alias table from the core runtime build and replaced it with alias generation from each agent package `exports` map:
  - [scripts/agent-package-exports.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/agent-package-exports.mjs)
  - [packages/core/build.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/build.mjs)
- Replaced the hand-maintained core declaration-build agent path table with a generated file derived from the same package `exports` source:
  - [packages/core/tsconfig.agent-types.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.agent-types.json)
  - [packages/core/tsconfig.build.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.build.json)
  - [packages/core/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/package.json)
- Added explicit generated-artifact hygiene for agent packages:
  - ignore `packages/agents/*/dist/`
  - ignore generated `packages/agents/*/src/**/*.d.ts`
  - fail package verification if stray `src/**/*.d.ts` appear
  - files:
    - [.gitignore](/Users/jiatwork/Works/nile/.worktrees/agent-registry/.gitignore)
    - [scripts/build-agent-package.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/build-agent-package.mjs)
    - [scripts/verify-agent-package-contracts.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/verify-agent-package-contracts.mjs)
- Added generated tsconfig path synchronization so package `exports` are the source for:
  - root source-level agent path aliases
  - core declaration-build agent type aliases
  - files:
    - [scripts/write-agent-tsconfig-paths.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/write-agent-tsconfig-paths.mjs)
    - [tsconfig.base.static.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.static.json)
    - [tsconfig.base.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/tsconfig.base.json)
    - [packages/core/tsconfig.agent-types.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/tsconfig.agent-types.json)
    - [package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/package.json)
- Hardened the default workflow so stale generated configs are caught by the normal structure check, not only by build scripts:
  - `verify:structure` now checks:
    - structural rules
    - `write-agent-tsconfig-paths.mjs --check`
    - `verify-agent-package-contracts.mjs`
  - common build/test/typecheck entrypoints now run `sync:agent-paths` before consuming generated config state

### Key findings

- The remaining alias/typing repetition after package split was mostly tooling-owned, not runtime-owned:
  - source tsconfig aliases
  - core declaration-build aliases
  - core runtime build aliases
- Wildcard subpath aliases are good enough in the root source config, but the core declaration build still needs explicit path entries. Those explicit entries are now generated from package `exports` instead of being maintained by hand.
- TypeScript wildcard subpath aliases are good enough for source-level development ergonomics, but not reliable enough for the core declaration build path table. That table now comes from generated explicit paths instead of a manually maintained list.
- `dist/` outputs inside `packages/agents/*` are acceptable build artifacts as long as they stay out of the normal source tree and out of diffs.
- Generated `src/**/*.d.ts` files were not part of the intended package contract. They should fail verification rather than be silently deleted.
- Ad hoc tooling still needs generated config state, so the practical fix is to make the main repo entrypoints sync it by default and make `verify:structure` catch staleness when someone bypasses those entrypoints.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Updated result

- Agent package export metadata is now the main source for:
  - core runtime alias wiring
  - core declaration-build alias wiring
- Source-level alias maintenance is reduced to stable subpath patterns instead of one block per agent.
- Core declaration-build alias maintenance is no longer manual; it is regenerated from package `exports`.
- Generated agent artifacts no longer belong to the day-to-day source tree:
  - `dist/` is ignored
  - stray `src/**/*.d.ts` fail package verification and are ignored if they do appear locally
- The normal repo workflow now self-heals generated config state more reliably:
  - build/test/typecheck scripts sync agent paths first
  - `verify:structure` fails on stale generated config or drifted package contracts

## Workflow hardening follow-up

### Tasks completed

- Tightened the root `runtime-local` public surface back to its intended narrow export set:
  - [packages/core/src/runtime-local/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/index.ts)
- Updated agent package type entrypoints to reference the narrow runtime-local type owner instead of the wide root export:
  - `@nile/core/runtime-local/Types`
- Hardened common repo entrypoints so generated agent path config is synchronized before ordinary build/test/typecheck flows:
  - [package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/package.json)
- Hardened structural verification so stale generated config and drifted agent package contracts fail fast in the default `verify:structure` workflow:
  - [scripts/write-agent-tsconfig-paths.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/write-agent-tsconfig-paths.mjs)
  - [scripts/verify-agent-package-contracts.mjs](/Users/jiatwork/Works/nile/.worktrees/agent-registry/scripts/verify-agent-package-contracts.mjs)

### Key findings

- The new package split had allowed one accidental regression: `runtime-local/index.ts` had widened again during the refactor. `verify:structure` correctly caught it.
- Agent package `types/index.d.ts` files had also drifted to a too-broad `@nile/core/runtime-local` import, which would have weakened the package boundary over time.
- Generated config freshness is acceptable as long as:
  - common entrypoints sync by default
  - `verify:structure` checks for staleness when someone bypasses those entrypoints

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## 2026-05-16 - OpenAI/OpenClaw session canonicalization

### What changed

- Added a shared compatibility helper for `openai_session` and `openclaw_openai_session` access reuse:
  - `packages/core/src/models/connection/OpenAiSessionCompatibility.ts`
- Let connection upsert reuse and canonicalize an existing OpenClaw-only OpenAI session into the standard `openai_session` shape when Codex imports the same account later:
  - `packages/core/src/models/connection/Upsert.ts`
  - `packages/core/src/models/connection/AccessMatch.ts`
  - `packages/core/src/models/access/Types.ts`
  - `packages/core/src/models/access/Builder.ts`
- Made matched import refresh merge `enabledAgents` so OpenClaw reusing a standard Codex session also records `openclaw` on the shared access:
  - `packages/core/src/actions/live-setup/Import.ts`
- Added regression coverage for both directions:
  - `packages/agents/openclaw/src/ImportCurrentConnection.test.ts`
  - `packages/agents/codex/src/import/ImportCurrentConnection.test.ts`

### Key findings

- Fixing only the OpenClaw detector/matcher was not enough; the system still split if OpenClaw imported first and Codex imported later.
- The correct cleanup point is the connection upsert path: when the same OpenAI account is already represented by an OpenClaw-only access, Codex import should reuse that row and migrate it to the canonical `openai_session` auth mode and credential shape.
- OpenClaw reusing a Codex-owned session also needs to merge `enabledAgents`, otherwise the shared row remains marked as Codex-only even though OpenClaw is now using it.

### Verification

- `./node_modules/.bin/vitest run packages/agents/openclaw/src/ImportCurrentConnection.test.ts packages/agents/codex/src/import/ImportCurrentConnection.test.ts packages/core/src/actions/live-setup/Matcher.test.ts`

## 2026-05-16 - Builtins app-facing bridge cleanup

### What changed

- Added explicit app-facing builtins bridge surfaces for local credential/state helpers and session login registry:
  - `packages/builtins/src/local/index.ts`
  - `packages/builtins/src/session/index.ts`
  - `packages/builtins/types/local/index.d.ts`
  - `packages/builtins/types/session/index.d.ts`
- Expanded the builtins connection bridge so apps no longer import shared connection catalog/policy directly from core:
  - `packages/builtins/src/connections/index.ts`
  - `packages/builtins/types/connections/index.d.ts`
- Added the new builtins subpath exports to the builtins package build and export map:
  - `packages/builtins/build.mjs`
  - `packages/builtins/package.json`
- Switched CLI and desktop app code from core-local/session runtime entrypoints to builtins bridges:
  - `apps/cli/src/commands/CredentialResolver.ts`
  - `apps/cli/src/commands/ConnectionAddFlow.ts`
  - `apps/cli/src/commands/ConnectionAgentSelectionFlow.ts`
  - `apps/cli/src/commands/ConnectionCommands.ts`
  - `apps/cli/src/commands/ResetCommands.ts`
  - `apps/cli/src/NileCli.ts`
  - `apps/desktop/src/electron/connections/DesktopConnectionManager.ts`
  - `apps/desktop/src/electron/connections/DesktopConnectionGateway.ts`
  - `apps/desktop/src/electron/ipc/DesktopIpcConnectionRoutes.ts`
  - `apps/desktop/src/electron/shell/DesktopMain.ts`
  - `apps/desktop/src/electron/state/DesktopStateStore.ts`
- Updated related tests and type imports to match the new app-facing bridge paths.

### Key findings

- Apps were no longer directly importing agents or connections, but they were still reaching into `@nile/core/application/local` and `@nile/core/session` for concrete runtime helpers. Adding explicit builtins bridges makes the intended dependency direction visible in imports instead of relying on discipline alone.
- `SHARED_CONNECTION_CATALOG` and `SHARED_CONNECTION_AGENT_POLICY` are better treated as app-facing builtins connection surfaces than as direct app imports from core.
- The known `lipo` collision on the macOS keychain helper is still a verification concern; `test:cli` and `test:desktop` must be run sequentially.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:cli`
- `npm run test:desktop`

## 2026-05-16 - Renderer builtins registration fix

### What changed

- Registered builtin modules in desktop renderer entrypoints before any UI code reads agent manifests/capabilities:
  - `apps/desktop/src/renderer/app/settings.tsx`
  - `apps/desktop/src/renderer/app/menubar.ts`

### Key findings

- Moving builtin registration out of core means every runtime entrypoint that reads module-backed registries must ensure builtins are registered first. CLI main and Electron main were already doing this, but the desktop renderer was not.
- `AGENT_CAPABILITIES` currently reads through the registered module graph, so renderer code like quick setup will throw `Unsupported agent manifest: codex` if builtins are not registered before the first render.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

## 2026-05-16 - Core-owned agent declarations and architecture doc refresh

### What changed

- Split browser-safe agent declaration metadata away from node-only full manifests:
  - `packages/core/src/models/agent/registry/Declarations.ts`
  - `packages/core/src/models/agent/registry/Types.ts`
  - `packages/core/src/models/agent/registry/Capabilities.ts`
  - `packages/core/src/models/agent/Definitions.ts`
  - `packages/core/src/models/agent/registry/index.ts`
- `AGENT_CAPABILITIES`, `formatAgentLabel`, and agent definition reads now come from a core-owned declaration list instead of depending on builtin runtime module registration.
- Removed the temporary desktop renderer-side `registerBuiltins()` workaround after the declaration split:
  - `apps/desktop/src/renderer/app/settings.tsx`
  - `apps/desktop/src/renderer/app/menubar.ts`
- Refreshed architecture docs to reflect the current package graph and ownership model:
  - `.vestin/architect.md`
  - `.vestin/plans/plan.md`
  - `.vestin/specs/core/module.md`
  - `.vestin/specs/surfaces/module.md`

### Key findings

- Full agent manifests are not browser-safe because home candidates are currently defined in agent packages using `node:os` and `node:path`. Renderer code cannot depend on those packages directly.
- Renderer-visible agent metadata belongs in `@nile/core` as a stable declaration layer, separate from node-only manifest details like home candidate discovery.
- This split is cleaner than making renderer entrypoints call `registerBuiltins()`, because renderer no longer depends on builtin runtime composition just to read agent labels and capabilities.

### Verification

- `npm run typecheck`
- `npm run build -w @nile/desktop`
- `npm run dev -w @nile/desktop` (verified it reaches watch mode without the previous `Could not resolve "node:os"` build failure)

## 2026-05-16 - Builtins runtime extraction

### What changed

- Moved the concrete `NileSession` runtime composition out of `@nile/core/runtime-local` into `@nile/builtins/runtime`:
  - `packages/builtins/src/runtime/NileSession.ts`
  - `packages/builtins/src/runtime/SessionResources.ts`
  - `packages/builtins/src/runtime/SessionWorkspaceResources.ts`
  - `packages/builtins/src/runtime/SessionHistoryResources.ts`
  - `packages/builtins/src/runtime/SessionWork.ts`
- Updated app-facing imports to use `@nile/builtins/runtime` instead of `@nile/core/runtime-local`:
  - `apps/cli/src/commands/SessionRunner.ts`
  - `apps/desktop/src/electron/connections/DesktopConnectionGateway.ts`
  - `apps/desktop/src/electron/connections/DesktopConnectionManager.ts`
  - `apps/desktop/src/electron/connections/Imports.ts`
  - `apps/desktop/src/electron/connections/ManagedApiKeyEnvironment.ts`
  - `apps/desktop/src/electron/connections/SessionRunner.ts`
  - `apps/desktop/src/state/HistoryQuery.ts`
  - `apps/desktop/src/state/MenubarQuery.ts`
  - `apps/desktop/src/state/SettingsQuery.ts`
  - `apps/desktop/src/state/Surface.ts`
  - `apps/desktop/src/state/Surface.test.ts`
  - `apps/desktop/src/state/UsageCache.ts`
- Removed the obsolete `@nile/core` root runtime-local export and deleted the old concrete runtime files from `packages/core/src/runtime-local`.
- Moved the `NileSession` behavioral test into `packages/builtins/src/runtime/NileSession.test.ts`.
- Updated `test:core` so builtins runtime tests are part of the default verification pass.

### Key findings

- The package graph does not become truly clean until `core` stops exporting the old concrete runtime root alongside the new builtins-owned runtime.
- `runtime-local` still belongs in `@nile/core` for agent workspace primitives and contracts, but not for the top-level session/workspace composition shell.
- The runtime extraction is only complete when the test ownership moves with it; leaving `NileSession` tests in core would keep the old ownership story alive.
- Workspace package discovery has to include `packages/builtins`, otherwise source-path aliasing and Vitest will fail to resolve `@nile/builtins/runtime` even when the package export is correct.
- `@nile/builtins/runtime` should expose only runtime values in its package-owned declaration surface; leaking extra type-only names makes the contract drift from the real runtime export set and breaks contract verification.

## Post-merge cleanup

### Tasks completed

- Removed the last session-domain re-exports from [packages/core/src/application/local/index.ts](/Users/jiatwork/Works/nile/packages/core/src/application/local/index.ts) so `application/local` no longer acts as a historical alias surface for:
  - `CurrentSessionSourceRegistry`
  - `InteractiveSessionLoginRegistry`
  - `CurrentSessionResolver`
  - session manifest/request types

### Key findings

- The merged main branch no longer has the empty `packages/core/src/models/connection/setup` or `packages/core/src/projection/strategies` directories that showed up during the pre-merge worktree review.
- App and package consumers were already importing session-domain contracts from `@nile/core/session`, so the alias exports in `application/local` had become dead compatibility surface rather than an actively used public API.

### Verification

- `npm run typecheck`
- `npm run test:core`

## Agent id and local credential request cleanup

### Tasks completed

- Replaced the standalone hardcoded `SUPPORTED_AGENT_IDS` tuple with a lightweight declaration-owned source:
  - [packages/core/src/models/agent/registry/Declarations.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Declarations.ts)
  - [packages/core/src/models/agent/Ids.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Ids.ts)
- Kept `AgentId`, `SUPPORTED_AGENT_IDS`, and `isAgentId(...)` on the lightweight declaration path instead of deriving them from runtime agent modules.
- Split session request construction out of `LocalCredentialRequestBuilder` into a session-owned builder:
  - [packages/core/src/session/RequestBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/RequestBuilder.ts)
  - [packages/core/src/application/local/LocalCredentialRequestBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/LocalCredentialRequestBuilder.ts)

### Key findings

- `AgentId` still benefits from a central lightweight owner, but that owner should be declaration metadata, not a second handwritten id tuple and not the runtime module registry.
- `LocalCredentialRequestBuilder` still has legacy surface-specific input shapes, but the auth-mode-to-session-source knowledge now lives in the session domain builder instead of the local application layer.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Notes

- Parallel `test:cli` / `test:desktop` runs in this worktree can still hit the known macOS `lipo` race while both rebuild `@nile/core`.
- Final acceptance should continue to use sequential results for now.

## Review-driven agent cleanup

### Tasks completed

- Removed the duplicate `isAgentId(...)` implementation from the manifest registry and kept `Ids.ts` as the single runtime owner.
- Relaxed `iconKey` from a central hardcoded union to manifest-owned string metadata and updated the desktop renderer to resolve SVGs from `AGENT_CAPABILITIES` instead of an `agentId` if-chain:
  - [packages/core/src/models/agent/registry/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Types.ts)
  - [apps/desktop/src/renderer/agents/AgentIcons.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/desktop/src/renderer/agents/AgentIcons.ts)
- Removed desktop and CLI interactive login bridge special-casing. Both surfaces now inject the shared interactive login registry contract instead of hardwiring `CodexSessionLogin` / `ClaudeSessionLogin`:
  - [apps/desktop/src/electron/connections/DesktopConnectionManager.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/desktop/src/electron/connections/DesktopConnectionManager.ts)
  - [apps/cli/src/commands/CredentialResolver.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/CredentialResolver.ts)
  - [apps/cli/src/NileCli.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/NileCli.ts)
- Replaced CLI `openclaw`-specific selected-model checks with capability-driven logic based on `requiredApplyRequirements.includes("selected-model")`:
  - [apps/cli/src/commands/ConnectionAgentSelectionFlow.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/ConnectionAgentSelectionFlow.ts)
  - [apps/cli/src/commands/ConnectionCommands.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/ConnectionCommands.ts)
- Deduplicated the shared PATH merge logic used by Codex and Claude login flows:
  - [packages/core/src/services/ShellPath.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/services/ShellPath.ts)
  - [packages/agents/codex/src/CodexSessionLogin.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src/CodexSessionLogin.ts)
  - [packages/agents/claude/src/ClaudeSessionLogin.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/ClaudeSessionLogin.ts)

### Key findings

- The interactive login registry is now mature enough that desktop and CLI no longer need agent-specific login adapters in their own composition roots.
- `selected-model` really is an agent capability, not an `openclaw` concept. Moving the CLI flow to capability-driven checks removed the last obvious surface leak for that rule.
- `SUPPORTED_AGENT_IDS` remains a central constant. It was left in place for now because deriving it directly from module registry ownership still needs careful cycle handling.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## Review follow-up cleanup

### Tasks completed

- Replaced the `openclaw`-specific api-key live-setup match rule with a capability-driven `selected-model` requirement check:
  - [packages/core/src/actions/live-setup/Matcher.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/actions/live-setup/Matcher.ts)
- Removed the exact-reexport `ConnectionFamilyManifest` alias and kept the manifest definition type as the only owner:
  - [packages/core/src/models/connection/family/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/Registry.ts)
  - [packages/core/src/models/connection/family/index.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/connection/family/index.ts)
- Replaced the CLI router's hardcoded `cursor usage` branch with an app-owned agent command extension registry:
  - [apps/cli/src/commands/agent/Registry.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/agent/Registry.ts)
  - [apps/cli/src/commands/agent/CursorUsage.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/commands/agent/CursorUsage.ts)
  - [apps/cli/src/NileCliCommandRouter.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/NileCliCommandRouter.ts)
  - [apps/cli/src/ArgumentParser.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/ArgumentParser.ts)
  - [apps/cli/src/CliCatalog.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/cli/src/CliCatalog.ts)
- Reduced repeated `open(...) / fromContext(...)` and `try/finally close()` wiring across agent adapters with a shared runtime helper:
  - [packages/core/src/runtime-local/AgentOperationRuntime.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/runtime-local/AgentOperationRuntime.ts)
  - [packages/agents/codex/src/CodexAgentAdapter.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src/CodexAgentAdapter.ts)
  - [packages/agents/claude/src/ClaudeAgentAdapter.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/ClaudeAgentAdapter.ts)
  - [packages/agents/cursor/src/CursorAgentAdapter.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/cursor/src/CursorAgentAdapter.ts)
  - [packages/agents/gemini/src/GeminiAgentAdapter.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/GeminiAgentAdapter.ts)
  - [packages/agents/openclaw/src/OpenClawAgentAdapter.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/openclaw/src/OpenClawAgentAdapter.ts)

### Key findings

- The last `openclaw` string check in live-setup matching was really another selected-model capability leak, not a genuine agent identity rule.
- CLI-only agent subcommands fit better as app-owned extensions than as extra fields on `@nile/core` agent modules. This removes router branching without pushing UI concerns back into core.
- The adapter boilerplate problem was smaller than a full operation-framework refactor. A narrow runtime helper was enough to collapse the repeated `open/fromContext` and close lifecycle code while keeping class-oriented composition.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## Review-driven ownership cleanup

### Tasks completed

- Moved agent home discovery out of a central handwritten table and into manifest-owned declarations:
  - [packages/core/src/models/agent/registry/Declarations.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/registry/Declarations.ts)
  - [packages/core/src/models/agent/Homes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Homes.ts)
  - [packages/agents/codex/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src/Manifest.ts)
  - [packages/agents/claude/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/Manifest.ts)
  - [packages/agents/cursor/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/cursor/src/Manifest.ts)
  - [packages/agents/gemini/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/Manifest.ts)
  - [packages/agents/openclaw/src/Manifest.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/openclaw/src/Manifest.ts)
- Moved concrete projection shapes out of `@nile/core` and back into the owning agent packages:
  - [packages/core/src/projection/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/projection/Types.ts)
  - [packages/agents/codex/src/ProjectionTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src/ProjectionTypes.ts)
  - [packages/agents/claude/src/ProjectionTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/ProjectionTypes.ts)
  - [packages/agents/cursor/src/ProjectionTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/cursor/src/ProjectionTypes.ts)
  - [packages/agents/gemini/src/ProjectionTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/gemini/src/ProjectionTypes.ts)
  - [packages/agents/openclaw/src/ProjectionTypes.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/openclaw/src/ProjectionTypes.ts)
- Restored `current-session` and `interactive login` ownership symmetry to the agent module boundary:
  - `CurrentSessionSource` remains agent-owned through the session registry.
  - `interactiveSessionLogin` and `localModelCatalogSources` now come from `AgentModule` instead of connection-family behavior.
  - [packages/core/src/models/agent/module/Types.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/module/Types.ts)
  - [packages/core/src/session/Login.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/Login.ts)
  - [packages/core/src/application/local/ModelCatalogSource.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/ModelCatalogSource.ts)
  - [packages/agents/codex/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/codex/src/Module.ts)
  - [packages/agents/claude/src/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/agents/claude/src/Module.ts)
  - [packages/connections/src/families/openai-session/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/families/openai-session/Module.ts)
  - [packages/connections/src/families/claude-session/Module.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/src/families/claude-session/Module.ts)
- Removed the last `@nile/connections -> @nile/agent-*` dependency edge by dropping agent-owned login/catalog behavior from connection family modules:
  - [packages/connections/package.json](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/connections/package.json)
- Replaced the remaining handwritten `SUPPORTED_AGENT_IDS` tuple with declaration-owned ids:
  - [packages/core/src/models/agent/Ids.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/models/agent/Ids.ts)
- Split session request construction out of the local application layer and renamed the surface fields to generic session terms:
  - [packages/core/src/session/RequestBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/session/RequestBuilder.ts)
  - [packages/core/src/application/local/LocalCredentialRequestBuilder.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/packages/core/src/application/local/LocalCredentialRequestBuilder.ts)
  - [apps/desktop/src/electron/connections/contracts.ts](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/desktop/src/electron/connections/contracts.ts)
  - [apps/desktop/src/renderer/connections/ConnectionFormParts.tsx](/Users/jiatwork/Works/nile/.worktrees/agent-registry/apps/desktop/src/renderer/connections/ConnectionFormParts.tsx)

### Key findings

- Agent metadata now has a cleaner split:
  - manifest/declaration owns ids, labels, icons, and home candidates
  - runtime module owns runtime wiring plus agent-local session/login/catalog surfaces
- Projection ownership was a real architectural leak. Moving concrete projection types back into agent packages removed the last large agent-specific shape union from `@nile/core`.
- The meaningful dependency direction is now:
  - `@nile/core` depends on agent and connection package surfaces
  - `@nile/connections` does not depend on agent packages
- `LocalCredentialRequestBuilder` is now thin enough that the remaining legacy is in UI/input naming only, not in auth-mode/session ownership.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Notes

- Sequential verification remains the acceptance path in this worktree because parallel `test:cli` / `test:desktop` runs can still trip the known macOS `lipo` race while both rebuild shared packages.

## Cursor usage cleanup

### Tasks completed

- Moved Cursor usage runtime ownership out of `@nile/core` and into `@nile/agent-cursor/usage`.
- Added the new agent package surface:
  - `@nile/agent-cursor/usage`
- Updated CLI, desktop, and core runtime callers to depend on the agent-owned usage surface instead of the old core-local files.
- Deleted the old core-owned Cursor usage implementation cluster:
  - `packages/core/src/actions/usage/cursor/*`
  - `packages/core/src/application/local/CursorUsageAutoBinder.ts`
  - `packages/core/src/application/local/CursorUsageSessionProbe.ts`
  - `packages/core/src/runtime-local/CursorUsageConnectionFollowUp.ts`
- Removed the old `@nile/core/actions/usage/cursor` export and the leftover session alias exports from `packages/core/src/application/local/index.ts`.

### Key findings

- Cursor usage was the clearest remaining agent-owned residue in `@nile/core`.
- Moving the whole Cursor usage cluster as a single `usage` surface was cleaner than keeping partial re-export wrappers in core.
- `@nile/core` can still orchestrate generic connection usage while depending on the agent-owned Cursor usage primitives.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

## Runtime and session cleanup

### Tasks completed

- Removed the extra `SessionRuntime` pass-through layer and made `NileSession` own `SessionResources` directly:
  - `packages/core/src/runtime-local/NileSession.ts`
  - deleted `packages/core/src/runtime-local/SessionRuntime.ts`
- Replaced the central connection-usage `authMode + protocol` switch with a registry-backed reader dispatch:
  - `packages/core/src/actions/usage/Usage.ts`
  - `packages/core/src/actions/usage/Registry.ts`
- Simplified current-session credential requests into a single shape and derived `authMode` from the current-session source registry instead of a handwritten source switch:
  - `packages/core/src/session/Types.ts`
  - `packages/core/src/session/RequestBuilder.ts`
  - `packages/core/src/application/local/LocalCredentialRequestBuilder.ts`
  - `apps/cli/src/commands/CredentialResolver.ts`
- Fixed the gateway onboarding ownership follow-up:
  - `packages/core/src/models/connection/preset/ModuleTypes.ts`
  - `packages/core/src/models/connection/preset/OnboardingSupport.ts`
  - `packages/core/src/models/connection/preset/Gateway.ts`
  - `packages/connections/src/support/OnboardingPolicy.ts`
- Stopped rebuilding agent manifest lookups on every access by indexing the declaration-owned manifest list once:
  - `packages/core/src/models/agent/registry/Manifest.ts`
- Tightened `formatAgentLabel(...)` to use the same cached manifest index instead of scanning the declaration list each call:
  - `packages/core/src/models/agent/registry/Manifest.ts`
- Renamed the misnamed agent facade file from `Types.ts` to `Definitions.ts` and aligned internal/package-facing imports:
  - `packages/core/src/models/agent/Definitions.ts`
  - `packages/core/src/models/agent/index.ts`
  - `packages/core/package.json`
  - `tsconfig.base.json`
  - repo consumers now import `@nile/core/models/agent/definitions`

### Key findings

- `SessionRuntime` had become a pure forwarding layer. Removing it shortened the runtime-local chain without changing external behavior.
- Usage dispatch belongs behind a registry, not inside one central `if` matrix, even when the underlying readers stay auth-mode specific.
- Current-session request ownership is cleaner when the source registry owns `authMode`; the request builder should not hardcode source ids.
- The `gateway` onboarding override fits naturally in the preset module surface through `resolveOnboardingConfig(...)`, instead of living as a preset-id special case in shared support.
- Agent manifest metadata is better treated as declaration-owned data than inferred back from runtime modules.
- `models/agent/Types.ts` had become a pure definitions facade; renaming it to `Definitions.ts` made the file responsibility match its contents without changing the surrounding contract surface.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `./node_modules/.bin/vitest run packages/core/src/runtime-local/NileSession.test.ts`
- `./node_modules/.bin/vitest run packages/core/src/actions/usage/Usage.test.ts`
- `./node_modules/.bin/vitest run packages/connections/src/support/OnboardingPolicy.test.ts packages/core/src/models/connection/Catalog.test.ts packages/core/src/models/connection/AgentPolicy.test.ts packages/core/src/models/agent/registry/Manifest.test.ts packages/core/src/models/agent/registry/Capabilities.test.ts`

## 2026-05-16 - Builtins runtime registration and app build fixes

### What changed

- Fixed the post-cycle-removal runtime registration bug by making dependent registries rebuild from the current agent module registry instead of snapshotting an empty module list at import time:
  - `packages/core/src/runtime-local/AgentFactoryRegistry.ts`
  - `packages/core/src/session/Registry.ts`
  - `packages/core/src/session/Login.ts`
  - `packages/core/src/projection/Registry.ts`
- Restored missing `@nile/core` public subpath exports used by agent packages:
  - `packages/core/package.json`
  - `packages/core/build.mjs`
- Added explicit workspace-tsconfig resolution to CLI and desktop esbuild entrypoints so app builds resolve workspace packages from source instead of stale `node_modules` dist artifacts:
  - `apps/cli/build.mjs`
  - `apps/desktop/build.ts`
- Simplified `@nile/builtins` into a runtime-only package with a package-owned declaration file instead of a declaration build that pulled in the full core/agents/connections graph:
  - `packages/builtins/package.json`
  - `packages/builtins/types/index.d.ts`
- Reinstated cleanup of stray `src/**/*.d.ts` workspace-package artifacts before package builds:
  - `scripts/build-workspace-package.mjs`
- Removed recursive `build:core` triggering from `@nile/host-local` package scripts and moved that ownership back to the root build flow to avoid duplicate macOS helper builds during app prebuild:
  - `packages/host-local/package.json`
  - `package.json`
  - `apps/cli/package.json`
  - `apps/desktop/package.json`

### Key findings

- Moving builtin module registration out of core is not sufficient by itself; any singleton registry that snapshots agent modules at import time becomes stale unless it also moves to dynamic lookup or explicit refresh.
- App esbuild entrypoints must read the workspace tsconfig paths directly after the split, otherwise they resolve partially built `node_modules` package artifacts and surface missing export errors that do not reflect the intended source graph.
- `@nile/builtins` does not need a declaration build; a small package-owned `.d.ts` surface is enough because it only exports `registerBuiltins()`.
- The macOS keychain helper build is sensitive to duplicate `build:core` invocations; centralizing core build ownership avoids avoidable `lipo` collisions.

### Verification

- `npm run build -w @nile/core`
- `npm run build -w @nile/builtins`
- `npm run build -w @nile/desktop`
- `npm run build -w @nile/cli`

## 2026-05-16 - Core/Connections package-edge cleanup

### What changed

- Moved the connection runtime contract surface into `@nile/core` so core-owned orchestration no longer imports connection implementations directly:
  - `packages/core/src/models/connection/Runtime.ts`
  - `packages/core/src/models/connection/index.ts`
- Replaced every remaining core-side `@nile/connections` runtime import with `CONNECTION_RUNTIME_REGISTRY` lookups:
  - `packages/core/src/application/local/WorkspaceState.ts`
  - `packages/core/src/application/local/ConnectionWorkflows.ts`
  - `packages/core/src/runtime-local/SessionWorkspaceResources.ts`
  - `packages/core/src/runtime-local/NileSession.ts`
  - `packages/core/src/models/connection/SavedConnections.ts`
  - `packages/core/src/actions/live-setup/Import.ts`
  - `packages/core/src/models/connection/AgentPolicy.ts`
  - `packages/core/src/models/connection/PresetSupport.ts`
- Registered the concrete builtin connection services in `@nile/builtins`:
  - `packages/builtins/src/index.ts`
- Removed the forbidden `agent-openclaw -> connections` edge by making OpenClaw live-setup depend on the core-owned identity resolver contract instead of importing `@nile/connections/support`:
  - `packages/agents/openclaw/src/live-setup/Resolver.ts`
  - `packages/agents/openclaw/src/live-setup/StateFactory.ts`
- Removed `@nile/connections` from `@nile/core` package dependencies:
  - `packages/core/package.json`
- Cleared stray generated declaration files from `packages/core/src/**/*.d.ts`.

### Key findings

- The cleanest first step to eliminate the cycle was not moving every concrete session/workspace class immediately, but moving the connection operation contracts into core and pushing concrete connection construction behind a builtins-owned registry.
- `agent-openclaw` did not need direct access to connection-family code; it only needed an identity-resolution contract. That contract belongs in core, while the concrete resolver remains in connections and is registered by builtins.
- Generated `src/**/*.d.ts` files inside `packages/core/src` were still polluting the source tree even after the package split; they needed an explicit cleanup pass after the build fixes.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`
## 2026-05-17 - Cursor preset surfaced as first-class provider

- Added a dedicated `cursor` connection preset for `cursor_session`.
- Kept `gateway` selectable for Cursor API-key/gateway cases, so Cursor can still use compatible gateway endpoints.
- Agent-scoped add-connection from Cursor detail now shows a real `Cursor` provider instead of only `Gateway`.
- Fixed the agent-detail add-connection wiring so the selected agent id is preserved when opening the add page:
  - `apps/desktop/src/renderer/app/settings/PageContent.tsx`
- Added the missing fixed endpoint module for the new `cursor` preset so setup/build flows no longer fail with `Missing connection endpoint module for preset: cursor`:
  - `packages/connections/src/setup/Cursor.ts`
  - `packages/connections/src/setup/Modules.ts`

### Key findings

- Cursor had always been stored as its own connection family, but product surfaces exposed it only through the `gateway` preset.
- The clean fix was to add a dedicated preset, not to special-case renderer labels.
- The original "all providers still show from agent detail" symptom had two separate causes: the page was dropping the scoped `agentId`, and the new Cursor preset was only half implemented, which made the scoped flow degrade back into broken setup behavior.

### Verification

- `./node_modules/.bin/vitest run apps/desktop/src/renderer/shared/DesktopData.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts packages/core/src/models/connection/Catalog.test.ts packages/core/src/models/connection/Support.test.ts packages/core/src/models/agent/registry/Capabilities.test.ts`
- `npm run typecheck`

## 2026-05-17 - Review-driven plugin metadata cleanup

### What changed

- Moved builtin agent declaration ownership out of `@nile/core` and into the agent packages themselves:
  - `packages/agents/*/src/Declaration.ts`
  - `packages/agents/*/src/Manifest.ts`
  - `packages/agents/*/package.json`
  - `packages/agents/*/types/declaration.d.ts`
- Replaced the core-owned hardcoded declaration table with a registry-only aggregation layer:
  - `packages/core/src/models/agent/registry/Declarations.ts`
- Added a renderer-safe builtin declaration registration surface and used it from desktop renderer entrypoints so agent capabilities remain available without importing node-heavy runtime modules:
  - `packages/builtins/src/agents/index.ts`
  - `packages/builtins/package.json`
  - `packages/builtins/build.mjs`
  - `apps/desktop/src/renderer/app/settings.tsx`
  - `apps/desktop/src/renderer/app/menubar.ts`
- Centralized session add-connection method behavior in the builtins session catalog and removed the remaining duplicated session branching from desktop and CLI consumers:
  - `packages/builtins/src/session/MethodCatalog.ts`
  - `apps/desktop/src/renderer/connections/ConnectionFormParts.tsx`
  - `apps/desktop/src/renderer/connections/add/useForm.ts`
  - `apps/desktop/src/renderer/connections/add/usePageState.ts`
  - `apps/desktop/src/renderer/connections/add/Page.tsx`
  - `apps/cli/src/commands/CredentialResolver.ts`
- Centralized provider icon metadata so add-connection preset cards and connection toolbar/provider displays no longer maintain separate icon switch tables:
  - `apps/desktop/src/renderer/connections/ProviderDisplay.tsx`
  - `apps/desktop/src/renderer/connections/add/PresetCard.tsx`
- Extended connection definitions with preset `iconKey` and updated supporting tests/fixtures:
  - `packages/core/src/models/connection/preset/ManifestTypes.ts`
  - `packages/core/src/models/connection/PresetSupport.ts`
  - `apps/desktop/src/renderer/connections/add/useForm.test.ts`

### Key findings

- The cleanest way to remove core-owned agent metadata was not another central builtins table; it was moving declaration files into each agent package and letting builtins perform the single aggregation step.
- Renderer-safe builtin setup needs a narrower surface than main-process builtin registration. `@nile/builtins/agents` is intentionally declaration-only so desktop renderer can use agent capabilities without importing node-only runtime code.
- Session add-flow behavior still benefits from one shared catalog even when the underlying registries stay in core. The biggest drift source was not runtime session resolution, but repeated method-selection rules in CLI and renderer consumers.
- `ConnectionDefinition.iconKey` is enough to eliminate duplicated preset icon switches in renderer surfaces without forcing saved connection endpoint families to share the same label semantics as preset cards.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `./node_modules/.bin/vitest run apps/desktop/src/renderer/shared/DesktopData.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts packages/core/src/models/connection/Catalog.test.ts packages/core/src/models/connection/Support.test.ts packages/core/src/models/agent/registry/Capabilities.test.ts apps/cli/src/NileCli.test.ts`

## 2026-05-17 - Performance and runtime hygiene cleanup

### What changed

- Removed repeated agent-manifest registry reconstruction on every read by caching the manifest index behind the agent-module registry revision:
  - `packages/core/src/models/agent/module/Registry.ts`
  - `packages/core/src/models/agent/registry/Manifest.ts`
- Moved builtin usage-reader registration out of the shared `Usage` constructor and into builtins-owned registration:
  - `packages/core/src/actions/usage/Registry.ts`
  - `packages/core/src/actions/usage/Usage.ts`
  - `packages/core/src/actions/usage/index.ts`
  - `packages/core/src/runtime-local/LocalConnectionSupport.ts`
  - `packages/builtins/src/runtime/Usage.ts`
  - `packages/builtins/src/index.ts`
- Added Gemini sign-in wrapper-directory cleanup so login attempts no longer leave `nile-gemini-open-*` temp directories behind:
  - `packages/agents/gemini/src/GeminiSessionLogin.ts`
  - `packages/agents/gemini/src/GeminiSessionLogin.test.ts`

### Key findings

- The simplest fix for manifest lookup churn was not another explicit builtins registration list, but a revision-aware cache hanging off the existing module registry. That keeps the current initialization model and removes the hot-path `IndexedRegistry` rebuild.
- Usage dispatch was mainly a maintenance hotspot, not a runtime hotspot. The important cleanup was shifting builtin reader ownership out of the shared `Usage` constructor so new builtin session families do not require editing the consumer orchestration class.
- Gemini Terminal login needs two cleanup strategies: synchronous cleanup for attached-terminal runs, and shell-level `trap` cleanup for Electron-launched Terminal flows where the parent process cannot safely delete the wrapper directory immediately.

### Verification

- `npm run verify:structure`
- `npm run typecheck`
- `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run packages/core/src/actions/usage/Usage.test.ts packages/agents/gemini/src/GeminiSessionLogin.test.ts packages/core/src/models/agent/registry/Manifest.test.ts`

## 2026-05-17 - Personal test data sanitization

### What changed

- Replaced real personal email addresses in Gemini/OpenClaw tests with stable fake addresses:
  - `gemini.primary@example.test`
  - `gemini.secondary@example.test`
  - `openai.shared@example.test`
- Updated derived test ids and expected labels so the test fixtures no longer carry personal identifiers:
  - `gemini-primary-example-test`
  - `openai-shared-example-test`
- Sanitized the matching build-log note that previously referenced a real OpenAI/OpenClaw duplicate account label.

### Key findings

- The personal data had mostly drifted into tests and build notes rather than runtime code. The right cleanup was fixture-wide replacement, not adding another abstraction layer.
- Derived ids in assertions were just as important to clean as the emails themselves; otherwise the repository would still retain personal identifiers in slugs even after the visible addresses were removed.

### Verification

- `rg -n "<sanitized personal identifiers>" .vestin apps packages --glob '!dist/**'`
