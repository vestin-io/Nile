# Gemini Connection And Usage

## Implementation Update

### Workstream A status

Implemented.

Gemini is now a first-class preset-backed connection surface for current-session onboarding:

- added `gemini` connection preset
- Gemini agent capability now allows `configure_or_import`
- desktop add-connection flow now accepts `gemini_cli_session`
- CLI add flow now accepts:
  - `--preset gemini`
  - `--auth-mode gemini_cli_session`
  - `--from-gemini-current`
- desktop renderer now shows Gemini as a real add method, not import-only

### Workstream A files changed

- `packages/core/src/models/connection/preset/Gemini.ts`
- `packages/core/src/models/connection/preset/Modules.ts`
- `packages/core/src/models/agent/registry/Declarations.ts`
- `packages/agents/gemini/src/Manifest.ts`
- `packages/connections/src/setup/Gemini.ts`
- `packages/connections/src/setup/Modules.ts`
- `apps/desktop/src/electron/connections/DesktopConnectionManager.ts`
- `apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`
- `apps/desktop/src/renderer/connections/ConnectionFormParts.tsx`
- `apps/desktop/src/renderer/connections/add/Page.tsx`
- `apps/desktop/src/renderer/connections/add/PresetCard.tsx`
- `apps/desktop/src/renderer/connections/add/useForm.test.ts`
- `apps/desktop/src/renderer/connections/add/usePageState.ts`
- `apps/desktop/src/renderer/shared/i18n/en.ts`
- `apps/desktop/src/renderer/shared/i18n/zh.ts`
- `apps/cli/src/CliCatalog.ts`
- `apps/cli/src/commands/CredentialResolver.ts`
- `apps/cli/src/NileCli.test.ts`
- `packages/core/src/models/agent/registry/Capabilities.test.ts`
- `packages/core/src/models/agent/registry/Manifest.test.ts`
- `packages/core/src/models/connection/Catalog.test.ts`

### Verification

- `npm run typecheck`
- `npm run test:cli`
- `npm run test:desktop`

### Remaining gap

Workstream B is still open:

- Gemini usage / quota remains unsupported until a stable source is identified

## Current State

Gemini is now a preset-backed connection surface with two onboarding paths:

- `Sign in with Gemini`
- `Import local Gemini CLI session`

What exists today:

- Gemini current-session detection
- Gemini current-session import
- Gemini interactive sign-in from desktop and CLI
- Gemini apply / rollback
- Gemini connection-family semantics under:
  - `packages/connections/src/families/gemini-cli-session`
- a generic preset-backed `Add connection` path

What does not exist today:

- a Gemini usage / quota reader

## Evidence

### No Gemini usage / quota path

- `packages/core/src/actions/usage/Usage.ts`
  - only registers readers for:
    - `openai_session`
    - `openclaw_openai_session`
    - `claude_session`
    - extra cursor readers
  - no `gemini_cli_session` reader exists
- repository search shows no Gemini quota or usage reader implementation

## Conclusion

Gemini is intentionally staged as:

- local session detection/import/apply first
- no generic manual creation yet
- no usage/quota support yet

That means the current missing behavior is real, not just a surface bug.

## Workstream A: Gemini Add Connection

### Goal

Let users create or adopt a Gemini connection from the standard connection surfaces without routing through a Gemini-specific import-only path.

### Implemented direction

Gemini now uses a dual-path add flow:

- `Sign in with Gemini`
- `Import local Gemini CLI session`

The desktop sign-in path opens a visible Terminal window because Gemini CLI does not expose a dedicated non-interactive auth subcommand. Nile then waits for a new local Gemini session to appear before completing the add flow.

### Scope

- add a `gemini` preset
- wire onboarding text and default enabled agents
- support interactive Gemini sign-in from generic add surfaces
- keep manual token entry out of scope

### Files likely involved

- `packages/core/src/models/connection/preset/*`
- `apps/desktop/src/electron/connections/DesktopConnectionManager.ts`
- `apps/cli/src/commands/ConnectionAddFlow.ts`
- `apps/cli/src/commands/ConnectionOnboardingPrompts.ts`
- renderer connection add flow tests
- CLI add flow tests

### Risks

- forcing Gemini into the same UX as API-key providers may create a confusing fake "manual add"
- if surfaced too early, the form may imply users can enter Gemini credentials directly, which is not true

## Workstream B: Gemini Usage / Quota

### Goal

Expose Gemini connection usage/quota in the same shared usage flow used by OpenAI, Claude, and Cursor.

### Unknowns

This needs source discovery first:

- Does Gemini CLI expose quota locally?
- Is there a stable Google/Gemini API endpoint for usage quotas tied to the saved session credential?
- Is quota user-visible in a durable machine-readable format, or only in interactive CLI output?

### Required spike

Before implementation, run a source spike to answer:

1. Can quota be read from local files?
2. Can quota be read from a remote endpoint using the saved `gemini_cli_session` credential?
3. What is the shape of the quota windows?
   - daily?
   - rolling?
   - plan limits?
4. Can we normalize it into:
   - `ConnectionUsageResult`

### Implementation target if feasible

- add `GeminiSessionUsageReader`
- register it in `packages/core/src/actions/usage/Usage.ts`
- expose the same usage UI in:
  - CLI `nile usage <connectionId>`
  - desktop saved-connection usage views

### Files likely involved

- `packages/core/src/actions/usage/*`
- possibly `packages/connections/src/families/gemini-cli-session/*` if family-specific auth helpers are needed
- CLI presenter tests
- desktop usage state tests

### Risks

- quota may not be available from any stable supported source
- the Gemini source may exist but not map cleanly to current shared usage windows

## Recommended order

1. Gemini add connection
   - implemented
2. Gemini usage/quota source spike
   - still open

## Build updates

### 2026-05-16 - Gemini sign-in parity

Implemented a real Gemini interactive login path so `Add connection` can create a new Gemini connection instead of only re-importing the current local session.

### 2026-05-17 - Desktop Gemini sign-in flow fixed

Fixed the desktop Gemini sign-in path so it no longer hangs on `Signing in...` with no visible prompt.

- `GeminiSessionLogin` now chooses between:
  - attached terminal execution in CLI/TTY contexts
  - opening `Terminal.app` in desktop/non-TTY contexts
- `GEMINI_LOGIN_SOURCE` now waits for a new Gemini local session to appear after Terminal launch before returning a saved credential
- added strategy coverage in:
  - `packages/agents/gemini/src/GeminiSessionLogin.test.ts`

Verification:

- `npm run typecheck`
- `vitest run packages/agents/gemini/src/GeminiSessionLogin.test.ts packages/core/src/session/Login.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts`

### 2026-05-17 - Gemini add flow simplified to sign-in only

Removed `Import local Gemini CLI session` from the generic `Add connection` flow.

Reason:

- `Add connection` should default to adding a new Gemini account
- importing the already active local Gemini session is redundant in this surface
- the lower-level `current_gemini` capability still exists for explicit import-oriented flows, but it is no longer exposed as a parallel method in the main add flow

Updated:

- desktop add-connection methods now only show `Sign in with Gemini`
- CLI interactive add for `gemini_cli_session` now goes straight to sign-in instead of prompting between sign-in and current-session import

### 2026-05-17 - Agent-scoped Gemini provider filtering

Fixed the agent-detail `Add connection` path so Gemini no longer expands back to the full provider list.

Implemented:

- `ConnectionDefinition` now carries `selectableAgents`, computed in core from preset + auth mode policy.
- desktop renderer agent-scoped filtering now reads `definition.selectableAgents` instead of recomputing family support in the renderer.
- `gemini-cli-session` is now marked selectable from the `gemini` preset, so Gemini is treated as a real addable provider instead of an import-only residue.

Key findings:

- renderer filtering cannot depend on builtins-backed family registries; it needs a definition-level source of truth from the main process
- `configurableAgents` is intentionally broader than "agents that can actually add this provider", so it is the wrong field for agent-detail scoping

### 2026-05-17 - Unified effective Gemini home resolution

Gemini CLI sometimes writes the active OAuth session into a nested home:

- `~/.gemini/.gemini`

while older Nile paths still read:

- `~/.gemini`

This caused desktop sign-in to succeed in Terminal but remain stuck in Nile because the new session landed outside the path Nile was polling.

Implemented:

- `GeminiHomeResolver`
- `GeminiSessionStores`

All Gemini runtime entry points now read session state through the same effective-home resolution path:

- current session source
- login source
- import current connection
- live setup detection
- apply selection
- rollback latest mutation
- agent adapter runtime wiring

The login flow still performs an extra nested-home sync after Terminal-based sign-in so a newly created `~/.gemini/.gemini` session is copied back into the primary Gemini home Nile tracks.

Verification:

- `npm run typecheck`
- `vitest run packages/agents/gemini/src/ImportCurrentConnection.test.ts packages/agents/gemini/src/live-setup/Detector.test.ts packages/agents/gemini/src/ApplySelection.test.ts packages/agents/gemini/src/Reader.test.ts packages/core/src/session/Login.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts`

### 2026-05-17 - Gemini sign-in now targets a new account

Adjusted the interactive Gemini sign-in flow so `Add connection` no longer piggybacks on the user's existing local Gemini CLI state.

Implemented:

- Gemini interactive sign-in now uses a fresh temporary `GEMINI_CLI_HOME`
- the spawned browser-open path is wrapped so Google OAuth is opened with `prompt=select_account`
- the desktop success card no longer hardcodes `OpenAI authenticated`

This makes the Gemini add flow behave like a true "add a new account" flow rather than a disguised "reuse whatever is already signed in locally" flow.

Key findings:

- Gemini CLI's bundled OAuth flow does not add `prompt=select_account` itself
- on macOS it opens the browser via the `open` executable, which made it practical to inject a narrow temporary wrapper without patching the CLI itself
- the temporary Gemini login home is intentionally isolated from `~/.gemini`, so a new sign-in does not mutate or depend on the existing local Gemini session

### 2026-05-17 - Agent-scoped add-connection filtering

Fixed the desktop add-connection page so opening it from an agent detail page stays scoped to providers that the current agent can actually use.

Implemented:

- `readDefinitionsForAgent(...)` now filters by `AGENT_CAPABILITIES.supportsSelectableConnection(...)`
- scoped agent views no longer fall back to the full provider list when a broad preset happens to mention the agent in `configurableAgents`

Key findings:

- filtering by `configurableAgents.includes(agentId)` was too weak because broad presets like `gateway` can include many agents without being a valid selectable provider for all of them
- the right filter boundary is agent capability + preset/auth-mode compatibility, not the UI-facing configurable list alone

Delivered:

- added Gemini interactive login source:
  - `packages/agents/gemini/src/GeminiSessionLogin.ts`
  - `packages/agents/gemini/src/LoginSource.ts`
- registered Gemini login ownership in the agent module and package surface:
  - `packages/agents/gemini/src/Module.ts`
  - `packages/agents/gemini/package.json`
  - `packages/agents/gemini/types/*`
- expanded session login contract to include `gemini_cli_session`:
  - `packages/core/src/session/LoginTypes.ts`
- updated desktop add-connection UX to offer two Gemini methods:
  - `Sign in with Gemini`
  - `Import local Gemini CLI session`
- made Gemini sign-in the default add-connection method instead of current-session import
- updated CLI onboarding and flags so Gemini supports:
  - `--login`
  - `--from-gemini-current`

Key UX result:

- `Add connection` for Gemini now matches the intended product mental model:
  - primary path: sign in with a new Gemini account
  - secondary path: import an already signed-in local Gemini CLI session

Verification:

- `npm run typecheck`
- `./node_modules/.bin/vitest run packages/core/src/session/Login.test.ts apps/desktop/src/renderer/connections/add/useForm.test.ts apps/desktop/src/electron/connections/DesktopConnectionManager.test.ts apps/cli/src/NileCli.test.ts`

Residual gap:

- Gemini quota / usage is still unresolved and remains in Workstream B.

## Suggested next execution units

### Feature 1

- Gemini connection surface parity
- deliver:
  - product decision
  - preset/onboarding integration or explicit import-only surface hardening

### Feature 2

- Gemini usage source spike
- deliver:
  - decision: supported / unsupported / partial
  - exact source and normalization contract

### Feature 3

- Gemini usage reader
- only if Feature 2 confirms a stable source
