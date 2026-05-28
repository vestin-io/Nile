# OpenCode Adapter Build Log

## 2026-05-28

### Step 1: Research OpenCode Config Semantics

- Verified against `research/cc-switch` and the current OpenCode docs that Nile should target the global config file at `~/.config/opencode/opencode.json`.
- Confirmed that the active model is controlled by the top-level `model = "provider/model"` string, while provider definitions live under the `provider` object.
- Chose a Phase 1 scope that only manages the global config file and env-backed API-key providers, leaving `auth.json` and project-local overrides out of this batch.

### Step 2: Add The OpenCode Agent Package

- Added a new `packages/agents/opencode` package and registered it through builtins.
- Implemented OpenCode-specific:
  - projection
  - apply
  - import
  - rollback
  - live-setup read/detect
- Kept provider/account persistence separate from agent apply logic by writing only provider metadata plus `{env:ENV_VAR}` placeholders into OpenCode config.

### Step 3: Register OpenCode In Shared Connection Policy

- Added `opencode` to the shared agent registry and builtins aggregation.
- Exposed `opencode` as a configurable agent for compatible OpenAI, Azure OpenAI, Anthropic, and generic gateway API-key presets.
- Updated connection-policy and catalog tests so the new agent participates in the same capability-driven flows as OpenClaw.

### Step 4: Surface OpenCode In Desktop And CLI

- Added the OpenCode icon and surfaced the agent in desktop state and renderer lists.
- Generalized several OpenClaw-only desktop messages so env-backed API-key and model-unavailable guidance can render correctly for OpenCode too.
- Added OpenCode-specific live-state issue parsing and managed-environment preservation for Nile-owned env keys referenced from OpenCode config.
- Updated CLI test expectations so unscoped import/rollback help and JSON output include the new agent.

### Step 5: Verification

- Verified with:
  - `npm run test:core`
  - `npm run test:desktop`
  - `/Users/jiatwork/Works/nile/node_modules/.bin/vitest run apps/cli/src/NileCli.test.ts`
  - `npm run typecheck`

### Step 6: Align Agent-List Configure Flow With Existing Connections

- Reused the existing quick-setup connection-choice dialog from the agents list page so `Configure Now` no longer jumps straight into add-connection when the agent already has compatible saved connections.
- Kept the explicit add-connection toolbar/button flow unchanged; the new prompt only applies to the local-setup recovery path where Nile already knows there are reusable saved connections.
- Wired the fallback action to the same add-connection flow as before when no compatible saved connection exists.
- Verified with:
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`
  - `npm run test:desktop -- --run apps/desktop/src/state/Surface.test.ts apps/desktop/src/state/DesktopPreferences.test.ts`

### Step 7: Add Official OpenAI Session Support For OpenCode

- Added OpenCode auth-store support at `~/.local/share/opencode/auth.json` so Nile can apply, detect, import, and roll back official OpenAI session-backed setups.
- Limited the new session path to the official OpenAI provider only. API-key providers keep using the existing Nile-managed `provider` entries in `opencode.json`.
- Updated shared-connection policy and saved-connection coverage so existing `openai_session` connections that already work for Codex/OpenClaw are also reusable for OpenCode.
- Verified with:
  - `./node_modules/.bin/vitest run packages/agents/opencode/src/ApplySelection.test.ts packages/agents/opencode/src/ImportCurrentConnection.test.ts packages/agents/opencode/src/live-setup/Detector.test.ts packages/agents/opencode/src/RollbackLatestMutation.test.ts packages/core/src/models/connection/AgentPolicy.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`
  - `./node_modules/.bin/vitest run apps/desktop/src/state/Surface.test.ts apps/desktop/src/state/DesktopPreferences.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit`

### Step 8: Align OpenCode Apply With Agent Overrides And Provider Allowlists

- Investigated a real local OpenCode state where Nile had switched the top-level `model` to `openai/...` but `agent.build/general/plan.model` still pointed at `azure/...`, and `enabled_providers` still only allowed `azure`.
- Updated OpenCode apply so Nile now keeps the built-in primary agent model overrides aligned with the selected connection and narrows `enabled_providers` to the active provider.
- Updated OpenCode detect so these split-brain configs are now surfaced as invalid semantics instead of being misreported as a healthy current selection.
- Verified with:
  - `./node_modules/.bin/vitest run packages/agents/opencode/src/ApplySelection.test.ts packages/agents/opencode/src/live-setup/Detector.test.ts`
  - `./node_modules/.bin/tsc -p tsconfig.node.json --noEmit`

#### Key findings

- Phase 1 only manages the global OpenCode config file. Project-level `opencode.json` overrides are still out of scope, so Nile can report a correct global state while a project-local override changes the effective runtime model.
- Nile now manages OpenCode `auth.json` only for the official OpenAI session flow. Anthropic/Claude session auth is still out of scope because current OpenCode official support does not expose an equivalent supported Claude subscription path.
- Importing an existing OpenCode OpenAI session reconstructs a Nile `openai_session` credential from the OAuth access/refresh tokens plus `accountId`. OpenCode does not persist a separate `idToken`, so Nile reuses the access token in that field for compatibility with the existing credential shape.
- OpenCode’s effective runtime is influenced not just by the top-level `model`, but also by built-in `agent.*.model` overrides and `enabled_providers`. Only switching `model` is not sufficient when those keys already exist.
- `npm run test:cli` is currently blocked in this repo by an unrelated `lipo` failure while building `packages/core/dist/services/credential/KeychainGenericPasswordHelper`. The CLI behavior changed in this batch was verified by running the CLI Vitest file directly instead of the wrapper script.

### Step 9: Isolate OpenCode Runtime State For Custom Homes

- Investigated a release-blocking CLI test regression and found that the CLI test helper only overrode OpenCode's config home, while the runtime still fell back to the real `~/.local/share/opencode/auth.json` for OAuth state.
- Updated the OpenCode runtime adapter to derive a sibling data-home when Nile is pointed at a custom OpenCode config root such as `<tmp>/.config/opencode` or `<tmp>/.opencode`.
- Extended the CLI test fixture to create isolated OpenCode config and auth stores under the temp workspace so local-setup scans no longer depend on the developer machine's real OpenCode state.
- Verified with:
  - `./node_modules/.bin/vitest run apps/cli/src/NileCli.test.ts`
  - `npm run desktop:build`

#### Key findings

- Before this fix, CLI tests could read the developer machine's real OpenCode OAuth state even though the rest of the agent homes were isolated. That violated the repo rule against tests depending on personal machine state and only surfaced after adding OpenCode as a built-in agent.

### Step 10: Fix Case-Sensitive Agent Home Imports For Linux CI

- Investigated the rerun desktop release failure and found that multiple agent packages imported `@nile/core/models/agent/homes` while the actual source file is `Homes.ts`.
- Local macOS development had hidden the mismatch because the filesystem is case-insensitive, but the GitHub Actions Linux runner failed module resolution during the test suite.
- Switched repo-internal imports over to the stable `@nile/core/models/agent` root export so tests and workspace builds no longer depend on lowercase package subpaths resolving through an unbuilt `dist/` tree on Linux.
- Verified with:
  - `npm run test:core`
  - `npm run desktop:build`

#### Key findings

- This was not an OpenCode-only runtime bug. The new release path surfaced an existing cross-platform import-case defect shared by several agent packages, and Linux CI was the first environment strict enough to fail it.
