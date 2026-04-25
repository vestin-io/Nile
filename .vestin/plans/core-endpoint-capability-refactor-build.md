# Core Endpoint Capability Refactor Build Log

## 2026-04-30

### Step 1: Endpoint And Access Foundation

- Added a new `packages/core/src/models/endpoint` module with:
  - endpoint types
  - SQLite store
  - registry
  - focused registry tests
- Added a new `packages/core/src/models/access` module with:
  - access types
  - SQLite store
  - registry
  - focused registry tests
- Expanded credential source support so core can materialize access-scoped local secrets via `access:<id>` references alongside the legacy binding-scoped references.
- Kept the legacy `provider` / `binding` / `connection` model intact for now so the new architecture foundation can coexist while we migrate apply, detect, and import flows in later steps.
- Updated legacy test doubles that implement `CredentialSourceFactory` so the new access-scoped factory contract remains type-safe across existing core tests.

### Verification

- `npx vitest run packages/core/src/models/endpoint/Registry.test.ts packages/core/src/models/access/Registry.test.ts`
- `npm run test:core`
- `npm run typecheck`

### Step 2: Agent Projection Bridge

- Added a new `packages/core/src/projection` module with:
  - endpoint/access-to-agent projection types
  - codex / claude / cursor projection strategies
  - a shared resolver and focused projection tests
- Added a `LegacyConnectionProjectionResolver` that maps the existing `provider` / `binding` model into temporary `endpoint` / `access` shapes before resolving an `AgentProjection`.
- Rewired `AgentApplySupport` so the shared apply preparation path now emits `AgentProjection` instead of the legacy provider apply spec.
- Updated Codex apply to consume a codex projection directly when writing `config.toml`.
- Updated Claude apply so Anthropic API-key connections can now project either `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`, which is required for bearer-auth Anthropic gateways.
- Updated Cursor apply to consume cursor projections directly.
- Kept connection creation, detect, import, and status on the legacy model for now. This step only moves the apply boundary onto the new projection architecture.

### Verification

- `npx vitest run packages/core/src/projection/LegacyResolver.test.ts packages/core/src/projection/Resolver.test.ts packages/core/src/agents/codex/apply/ApplySelection.test.ts packages/core/src/agents/claude/SettingsStore.test.ts packages/core/src/agents/claude/RollbackLatestMutation.test.ts packages/core/src/agents/cursor/RollbackLatestMutation.test.ts`
- `npm run test:core`
- `npm run typecheck`

### Step 3: Endpoint And Access Dual-Write

- Added a shared `LegacyShapeMapper` that converts legacy `provider` / `binding` records into normalized `endpoint` / `access` shapes.
- Added a `LegacyConnectionMirror` that mirrors legacy records into the new `EndpointRegistry` and `AccessRegistry`, including rollback support for mirrored secrets.
- Updated `ConnectionCreator` so newly created connections now dual-write:
  - legacy `provider` / `binding` / `connection`
  - new `endpoint` / `access`
- Updated `AgentImportSupport` and the codex / claude / cursor importer composition roots so imported live setups also dual-write into `endpoint` / `access`.
- Added focused tests proving:
  - connection creation writes mirrored endpoint/access records
  - connection creation rollback removes mirrored access secrets
  - codex import writes mirrored endpoint/access records for imported Azure OpenAI setups

### Verification

- `npx vitest run packages/core/src/models/connection/ConnectionCreator.test.ts packages/core/src/agents/codex/import/ImportCurrentConnection.test.ts packages/core/src/projection/LegacyResolver.test.ts packages/core/src/projection/Resolver.test.ts`
- `npm run test:core`
- `npm run typecheck`

### Step 4: Current-State And Match Bridge

- Updated `AgentStateMatcher` so it now attempts matching through mirrored `endpoint` / `access` records before falling back to legacy `provider` / `binding` matching.
- Added endpoint capability comparisons for:
  - OpenAI official
  - OpenAI-compatible gateways
  - Azure OpenAI
  - Anthropic official and bearer-auth gateways
  - Cursor backend
- Updated codex / claude / cursor current-state detectors and importer detector roots so matcher construction now receives `EndpointRegistry` and `AccessRegistry`.
- Fixed Claude current-state env detection so `ANTHROPIC_AUTH_TOKEN` is preserved as bearer-auth semantics instead of being collapsed into `ANTHROPIC_API_KEY`.
- Added focused regression coverage proving:
  - codex can still match saved connections through mirrored endpoint/access records even when legacy provider metadata has drifted
  - claude current-state recognizes bearer-auth gateway settings correctly

### Verification

- `npx vitest run packages/core/src/agents/codex/current-state/Detector.test.ts packages/core/src/agents/claude/current-state/Reader.test.ts packages/core/src/agents/codex/import/ImportCurrentConnection.test.ts`
- `npm run test:core`
- `npm run typecheck`

### Step 5: Endpoint And Access Runtime Cutover

- Removed the runtime dependency on legacy `provider` / `binding` / `connection` records from the shared apply path.
- Rewired codex / claude / cursor apply roots so they now prepare selections from `EndpointRegistry` and `AccessRegistry` directly.
- Changed agent selection persistence so the saved runtime selection now records:
  - `connectionId`
  - `endpointId`
  - `accessId`
  instead of provider/binding identifiers.
- Reworked `Status` and `Usage` so they resolve current state and usage from endpoint/access truth instead of legacy registries.
- Simplified `SavedConnections` so the saved-connection surface is now backed by access records and endpoint capabilities.
- Updated workspace composition to treat endpoint/access registries as the runtime source of truth.
- Rebased the affected core tests onto endpoint/access-backed seeds, including:
  - selection persistence
  - apply / rollback
  - status and usage
  - current-state matching
  - saved-connections removal behavior
- At this point `packages/core` runtime behavior is validated against the new structure without relying on legacy compatibility for apply/status/usage/selection flows.

### Verification

- `npx vitest run packages/core/src/models/selection/AgentSelection.test.ts packages/core/src/actions/status/Status.test.ts packages/core/src/actions/usage/Usage.test.ts packages/core/src/models/connection/SavedConnections.test.ts packages/core/src/agents/codex/apply/ApplySelection.test.ts packages/core/src/agents/claude/RollbackLatestMutation.test.ts packages/core/src/agents/cursor/RollbackLatestMutation.test.ts`
- `npm run test:core`
- `npm run typecheck`

### Step 6: Native Endpoint And Access Creation

- Removed the last runtime dependency on legacy `provider` / `binding` / `connection` registries from:
  - workspace composition
  - shared agent adapter context
  - local scan/import surfaces
  - connection creation
- Replaced `ConnectionCreator` internals so manual connection creation now writes native `endpoint` and `access` records directly instead of dual-writing through legacy registries first.
- Deleted dead legacy bridge files that were no longer referenced after the runtime cutover:
  - `models/connection/Assembler.ts`
  - `models/connection/Mirror.ts`
  - `projection/LegacyResolver.ts`
- Updated codex detect/import regression tests so they seed and assert against native `endpoint` / `access` truth instead of mirrored legacy rows.
- Reworked scan-local matching summaries to resolve matched saved setups through `AccessRegistry`.
- Verified that after the cutover, `packages/core` runtime behavior no longer depends on legacy registries outside of isolated legacy-only modules and test helpers.

### Verification

- `npx vitest run packages/core/src/agents/codex/current-state/Detector.test.ts packages/core/src/agents/codex/import/ImportCurrentConnection.test.ts packages/core/src/models/connection/ConnectionCreator.test.ts`
- `npm run test:core`
- `npm run typecheck`

### Step 7: Preset Catalog Simplification

- Replaced `ConnectionCatalog` with a small preset-and-label helper that only serves:
  - connection family definitions for surfaces
  - preview provider labels
  - preview connection labels
- Deleted the old family-strategy implementation that was still carrying legacy `provider` / `binding` semantics:
  - `models/connection/ConnectionTypes.ts`
  - `models/connection/defaultConnectionStrategies.ts`
  - `models/connection/strategies/*`
- Reworked `ConnectionCatalog` tests so they now verify preset definitions and label inference only.
- Removed the `endpoint -> provider` type dependency by changing `EndpointShape.readFamily()` to return an endpoint-local family hint instead of importing `ProviderFamily`.
- Inlined legacy provider-family auth-mode validation into `ProviderRegistry` so the deleted connection strategy files are no longer part of provider validation.

### Verification

- `npm run typecheck`

### Step 24: Cursor Usage State DB Probe

- Replaced the assumption that Cursor usage auto-bind must come from decrypted Chromium cookies.
- Added a host-local `CursorStateDbProbe` that reads `Cursor/User/globalStorage/state.vscdb`, extracts `cursorAuth/accessToken`, derives the WorkOS user id from the JWT `sub`, and wraps it as a Cursor usage session candidate.
- Added `CursorUsageSessionSourceProbe` as the new default host-local composition:
  - try `CursorStateDbProbe` first
  - fall back to `ChromiumCursorSessionProbe`
- Generalized probe candidate/result wording from browser-only fields to source-oriented fields so auto-bind can report either:
  - `Cursor (Local session)`
  - or a browser/profile fallback
- Relaxed Cursor usage identity validation so binding accepts both:
  - web usage tokens
  - local Cursor access tokens wrapped as `user::<jwt>`
- Updated CLI and desktop composition roots to use the new default source probe instead of the Chromium-only probe.
- Added tests for:
  - Cursor state DB probe reading `cursorAuth/accessToken`
  - auto-bind using a non-browser local Cursor usage session
  - renamed source labels in existing Chromium probe tests

### Verification

- `npm run typecheck`
- `npx vitest run packages/core/src/actions/usage/cursor/Binder.test.ts packages/core/src/application/local/CursorUsageAutoBinder.test.ts apps/desktop/src/electron/ChromiumCursorSessionProbe.test.ts apps/desktop/src/electron/CursorStateDbProbe.test.ts`

### Step 25: Desktop Cursor Auto-Bind Backgrounding

- Removed Cursor usage auto-bind from the synchronous desktop add/import connection path so `Looks good` and other connection-creation actions no longer wait on usage binding before returning to the renderer.
- Added a per-connection desktop background auto-bind step in `DesktopMain`:
  - import/add returns immediately
  - the UI reloads right away with the saved connection
  - Cursor usage binding runs afterward in the background
  - a second reload is triggered only if a binding is actually created
- Extended `DesktopStateStore` with a single-connection `autoBindCursorUsage()` method so desktop can invalidate menubar/settings caches only when the background binding succeeds.
- Kept the existing startup-wide `autoBindAllCursorUsage()` path for previously saved Cursor connections.

### Verification

- `npm run typecheck`
- `npx vitest run apps/desktop/src/electron/DesktopStateStore.test.ts apps/desktop/src/electron/DesktopConnectionManager.test.ts`
- `npm run test:core`

### Step 23: Cursor Usage Host Debugging

- Traced the failing Cursor usage flow on macOS and confirmed the saved Cursor connection itself is healthy while `cursor_usage_bindings` remained empty during auto-bind.
- Fixed the Swift keychain helper compile regression in `packages/core/src/services/credential/macos/GenericPassword.swift` so manual host-side validation can run again.
- Changed `packages/core/src/services/credential/SecurityCli.ts` to prefer the system `security` CLI first and only fall back to the Swift helper when needed, which avoids brittle helper-path behavior in desktop/dev host flows.
- Verified that the old investigation session token can still pass Nile's identity gate and bind to the current Cursor connection, but the remote Cursor API now rejects that historical web session as expired.
- Confirmed that the remaining blocker is Chrome cookie extraction on this machine: Chrome's cookie DB is schema version `24`, the relevant Cursor cookies are present, but Nile's current Chromium probe cannot decrypt them with the legacy safe-storage-based logic.

### Verification

- `npm run typecheck`
- Host-side `SecurityCli` validation for `Chrome Safe Storage` and `access:jay-ji-exampleco-ai-2`
- Host-side `ChromiumCursorSessionProbe.createDefault().probe()` inspection
- Host-side bind/read experiment using the previously captured `WorkosCursorSessionToken`

### Step 17: Desktop Quick Setup Checklist Redesign

- Replaced the earlier wizard-style first-run flow with a simpler per-agent quick-setup checklist in desktop.
- Added a reusable `QuickSetupAgentCard` so quick setup now iterates over live agent state instead of hardcoding separate Codex / Claude / Cursor page sections.
- Simplified each quick-setup card to show only:
  - whether a current local setup exists
  - the detected local setup content
  - a single primary action:
    - `Looks good` when a local setup can be confirmed/imported
    - `Configure one now` when no local setup exists but the agent supports manual connection creation
- Changed quick-setup visibility from `connections.length === 0` to a dedicated renderer preference flag (`quickSetupDismissed`) so onboarding remains visible until the user explicitly finishes it.
- Wired `Done` to dismiss quick setup and return the user to the normal Connections page.
- Targeted manual configuration from quick setup now constrains the add-connection dialog to definitions that can configure the chosen agent and switches the new connection onto that agent after creation.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 44: Agent Connection Switch Feedback

- Added explicit switch feedback inside `Agent detail -> Connections` so switching a backup connection no longer feels silent.
- The `Switch` action now enters a `Switching…` loading state with a spinner while the switch is in flight.
- After a successful switch, the newly active row briefly pulses with a green highlight to make the state change visible before settling back to the normal current-connection view.
- Added `common.switching` translations across the supported desktop languages for the new in-flight action label.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 43: Agent-Sourced Connection Detail Navigation

- Preserved agent context when opening a connection detail from `Agent detail -> Connections`, so the connection page now renders an `Agents > {agent} > {connection}` breadcrumb instead of always flattening back to `Connections > ...`.
- Lifted the selected agent-detail route into the settings shell so returning from an agent-sourced connection detail lands back on the same agent detail page.
- Cleared connection selection consistently when leaving connection detail, so breadcrumb navigation does not leave stale selected-connection state behind.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 42: Agent Detail Connections Toolbar Alignment

- Reused the shared desktop `ConnectionsToolbar` inside `Agent detail -> Connections` so the action layout now matches the main connections page.
- Wired the agent-detail `Add connection` action to open the add-connection flow already targeted at the current agent.
- Kept the shared refresh control semantics and button sizing aligned with the main connections screen.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 40: Agent Connection Quota Tooltip

- Changed the desktop-table `Quota left` cell in `Agent detail -> Connections` from a static detail area into a hover-driven quota tooltip.
- The table now shows only the quota summary inline; hovering that value reveals the detailed quota windows for the hovered connection.
- Reused the shared `ConnectionQuotaSection` inside the tooltip content instead of creating a second quota detail renderer.
- Kept the mobile card layout as plain inline text for now because hover-first quota expansion is primarily useful in the desktop table view.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 39: Shared Connection Quota Section

- Extracted the duplicated connection quota UI into a shared desktop component:
  - `apps/desktop/src/renderer/ConnectionQuotaSection.tsx`
- Updated `ConnectionDetailPage` to use the shared quota section for the full connection usage view.
- Updated `AgentDetailPage` to use the same shared quota section for the current row expansion, while keeping the agent-detail view scoped to the first three usage windows.
- Preserved the behavioral differences through component props instead of maintaining two separate markup implementations:
  - full connection detail shows the plan label and all windows
  - agent current-row expansion hides unavailable states and limits the displayed windows

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 38: Agent Connection Action Column Clarification

- Clarified the final action column in the agent-detail connection view so it now behaves as an explicit status/action pair:
  - current connection: disabled `In Use`
  - standby connection: `Switch`
- Removed the old duplicated `Current` row badge from this view because the action column now carries that state more clearly.
- Added `common.switch` translations across all supported desktop languages so the new switching CTA remains localized.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 37: Agent Connection Status-Light Simplification

- Removed the `Endpoint` field from the agent-detail connection table because it does not materially help the operator in an agent-scoped switching view.
- Added the existing red/yellow/green usage status indicator ahead of each connection name so the operator can read connection health at a glance:
  - green for healthy quota
  - amber for low quota
  - red for critically low quota
  - gray when no usage signal is available
- Applied the same simplification to both the desktop table layout and the mobile card layout.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 36: Agent-Focused Connection Table Simplification

- Simplified the `Agent detail -> Connections` table again so it now focuses on the agent-to-connection decision instead of repeating global connection-management data.
- Removed the inherited `Capability` and `Selected by` columns from this page because they add little value when the operator is already scoped to a single agent.
- Kept only the fields that matter for agent switching:
  - connection name
  - endpoint
  - auth type
  - usage summary
  - inline current quota details for the active row
  - `Use` for standby connections
- Mirrored the same simplification in the mobile card layout.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 35: Agent Detail Connections Table Alignment

- Reworked the `Agent detail -> Connections` tab to use the same table/card language as the standalone `Connections` page instead of the older stacked summary blocks.
- The tab now lists all available connections for the current agent and shows:
  - current row state
  - usage summary
  - capability
  - selected-by agents
  - direct `Use` switching for non-current connections
- Moved the current connection quota details into the current row itself so the operator can see the active usage window inline while still keeping standby connections available for quick switching.
- Kept the mobile experience responsive by mirroring the same information in card form below the desktop table breakpoint.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 34: Agent Detail Header Action Cleanup

- Removed the redundant `Import current setup` button from the agent detail header because that import path already lives in Quick setup and the main agents list.
- Kept the agent detail header focused on the page-local action that still matters there: refresh.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 33: Agent Detail Header Simplification

- Removed the redundant `in use` badge from the agent detail header because the page itself already represents the active agent context.
- Removed the duplicate connection-count subtitle from the header and moved that count into the tab label so the primary navigation now reads:
  - `Connections (N)`
  - `History`
- Kept the page structure aligned with the `Connections` detail page while reducing repeated status copy in the agent detail header.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 31: About Nile Branding Polish

- Added a GitHub icon to the `Open GitHub issues` action inside the `About Nile` dialog instead of leaving it as text-only.
- Added a copyright line to the About section:
  - `Copyright © 2026 Vestin Limited, New Zealand.`
- Added the matching Chinese copyright copy for the desktop message catalog.
- Used an inline GitHub SVG in the renderer instead of depending on an unstable icon export name.

### Verification

- Confirmed `NileDialog.tsx` and `I18n.ts` changes are syntactically valid.
- Full desktop typecheck/test remains blocked by unrelated pre-existing desktop errors in:
  - `DesktopSurface.ts`
  - `DesktopConnectionManager.ts`
  - `DesktopStateStore.test.ts`
  - `SettingsApp.tsx`

### Step 30: Desktop Full Multi-Language Translation

- Replaced the temporary English fallback-only setup for the newly added desktop locales with dedicated translated message catalogs.
- Added complete desktop UI translations for:
  - Korean
  - Japanese
  - Thai
  - French
  - Spanish
  - Italian
  - German
  - Vietnamese
- Kept product names and technical tokens like `OpenAI`, `Claude`, `Cursor`, `auth.json`, and `API key` stable where translation would reduce clarity.
- Preserved the English catalog as the final hard fallback for any future missing keys while ensuring all current desktop strings now resolve to translated copy in each supported locale.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 27: Desktop Session Failure Hardening

- Fixed `ClaudeSessionLogin` so post-login credential reads now require a real `claude_session` instead of falling through to the env-based Claude state path and surfacing unrelated API-key errors.
- Hardened the Cursor current-state reader to treat keychain read failures as an invalid live state instead of throwing through desktop settings/state handlers.
- Added focused core coverage for both paths:
  - Claude login resolver path
  - Cursor current-state handling when keychain credential reads fail

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 18: Runtime Local Wiring Consolidation

- Removed the extra `runtime-local/History.ts` façade and routed `NileSession` history reads straight to `MutationHistory`, leaving mutation-history ownership in one place instead of mirroring it across session collaborators.
- Collapsed the `LocalWorkspaceState` status/scan/import assembly into one `createAgentActions()` composition point so `AgentAdapterRegistry` stops travelling through multiple factory wrappers that only re-forwarded it.
- Reduced repeated runtime-local wrapper logic by centralizing the shared local side effect path in `NileSession`, so connection create/import flows no longer each reimplement Cursor usage auto-bind handling.
- Extracted local connection input normalization into one helper inside `runtime-local/Connections.ts`, keeping credential resolution, probe credential resolution, and label/model trimming aligned between create and onboarding preview flows.
- Moved endpoint URL reconstruction into `models/connection/EndpointUrl.ts`, so saved-connection summaries and connection updates now share one rule for deriving the visible endpoint URL from endpoint protocols.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 41: Agent Connection Detail Routing And Quota Wording Alignment

- Unified the agent-detail quota tooltip wording with the rest of desktop by reusing the shared `Quota left` title instead of a one-off `Current quota window` label.
- Made agent-detail connection rows clickable so selecting a connection from an agent-focused table now opens the shared connection detail page.
- Kept row-level actions explicit by stopping row navigation when `In Use` or `Switch` buttons are pressed.
- Preserved the shared `ConnectionQuotaSection` usage so agent-detail hover content and connection detail still render from the same quota section component.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 32: Desktop Agent Detail Tabs Alignment

- Reworked the desktop `Agents` detail route to align with the `Connections` detail-page structure instead of the older split subpages.
- Added a shared tabs wrapper at `apps/desktop/src/renderer/ui/tabs.tsx` and used it to collapse the agent detail experience into two tabs only:
  - `Connections`
  - `History`
- Replaced the old agent detail surface files (`AgentHistoryView`, `AgentSwitchView`, `AgentUsageView`, `AgentSubpageHeader`) with a single `AgentDetailPage` that now owns:
  - breadcrumb navigation
  - header actions
  - connection summary and usage sections
  - history list and rollback action
- Updated `AgentPage` routing so `More` now opens the consolidated detail page instead of dispatching to separate history/switch/usage routes.
- Removed duplicated session-login resolution in `packages/core/src/runtime-local/Connections.ts` so local sign-in flows no longer resolve non-API-key credentials twice when creating or previewing a connection.
- Refreshed desktop tests to match the current connection summary shape (`endpointUrl`, `apiKeySource`, `envKey`, actual enabled agents) and verified the new detail-page route under the full desktop test suite.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 29: Desktop Language Expansion

- Expanded the desktop language preference model from two fixed choices to ten supported locales:
  - `en`
  - `zh`
  - `ko`
  - `ja`
  - `th`
  - `fr`
  - `es`
  - `it`
  - `de`
  - `vi`
- Replaced the old hardcoded language parsing branch with a shared supported-language list so persisted preferences can safely round-trip any newly added locale.
- Updated the desktop settings language selector to render from the supported-language list instead of manually listing only English and Chinese.
- Registered the new locales in the desktop message catalog and wired them to the full English fallback catalog so every UI string remains resolvable while the new locale options are available immediately.
- Added native language names for the new selector entries and Chinese labels for the localized settings picker.

### Verification

- `npm run typecheck`
- `npm run test:desktop`
- `npm run test:desktop`

### Step 28: Quick Setup Exit CTA

- Replaced the generic `Done` action in quick setup with a clearer navigation CTA: `Go to Agents`.
- Added a right-arrow icon so the button reads as an explicit move from setup into the main agent workspace instead of a vague wizard completion action.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 25: Claude Session Sign-In Flow

- Added a shared `ClaudeSessionLogin` in core so desktop session onboarding can actively launch `claude login` and read the resulting `claude_session` credential instead of only importing an already-signed-in local state.
- Extended `LocalCredentialResolver` and the desktop add-connection bridge to support `claude_session` login requests alongside the existing `current_claude` import path.
- Updated the desktop add-connection page so `Official Claude` now follows the same prepared-session pattern as `OpenAI`:
  - sign in first
  - then review label and capability
  - then save the connection
- Removed the last desktop renderer copy that still described the Claude session path as a current-session import method.

### Verification

- `npm run typecheck`
- `npm run test:desktop`
- `npm run test:core`

### Step 26: Desktop OpenAI Auth Json Import Method

- Added `Import auth.json` back to the desktop `Official OpenAI` add-connection methods as a distinct technical path alongside `Sign in with OpenAI` and `Use API key`.
- Kept the underlying `current_codex` credential source but renamed the desktop entry and copy so the page now describes the real file-backed import path instead of implying a broader current-session flow.
- Updated the OpenAI submit CTA so selecting the auth.json path reads as an import action instead of a sign-in action.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 24: Desktop Gateway Capability Detection Step

- Updated the desktop `Gateway` add-connection flow to use two stages:
  - first collect `Endpoint URL` and `API key`
  - then run capability detection before showing label and capability controls
- Delayed gateway onboarding probing until after the explicit `Detect capability` action so the form no longer mixes endpoint credential entry with final save configuration.
- Reused the existing onboarding suggestion result to seed enabled agents after gateway capability detection, keeping the second step aligned with the shared core capability model.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 23: Desktop Session Draft Save Flow

- Added a desktop-only prepared-connection draft flow for session auth methods so `Sign in with OpenAI` can complete first and defer the final save until after the user reviews connection details.
- Stored prepared session credentials in the Electron main process and exposed explicit `prepareConnectionDraft` / `savePreparedConnection` IPC contracts instead of forcing the renderer to combine sign-in and persistence in one submit.
- Updated the add-connection page so OpenAI session login now renders in two stages:
  - complete the sign-in step first
  - then review label and capability before saving the connection
- Replaced the old always-visible `Enabled for agents` summary with a cleaner capability display for single-agent/session flows.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 22: Desktop Add Connection Codex Session Removal

- Removed the `Use current Codex session` method from the desktop `Add connection` page because that import path is already covered by `Agents` and `Quick setup`.
- Kept the underlying desktop/electron support for `current_codex` intact so existing tests and other surfaces can still use the contract where needed.
- Deleted the now-dead desktop renderer copy for the removed Codex session method and unused session-source labels from the desktop i18n catalog.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 21: Desktop Add Connection Session Copy Cleanup

- Removed the extra “session source” explanation block from the add-connection page.
- The selected connection-method card now carries the session intent on its own, so the form no longer repeats the same Codex/Claude session explanation in a second read-only section below it.
- Kept the underlying session-selection behavior unchanged while reducing redundant copy in the details area.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 20: Desktop Preset Wording And Brand Icons

- Renamed the add-connection preset chooser copy from “connection type” to “connection method” to match the current product wording.
- Replaced the generic preset icons with brand-specific logos where available:
  - OpenAI
  - Azure AI
  - Claude
  while keeping `Gateway` on a generic routing icon as requested.
- Wired the brand icons through the existing desktop SVG text-loader path so the combobox and selected value both render the same branded icon treatment.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 19: Desktop Preset Dropdown Clipping Fix

- Fixed the add-connection preset dropdown clipping issue by removing `overflow-hidden` from the settings-style preset section card.
- This allows the searchable combobox popover to render above the card boundary instead of being visually cut off by the section container.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 18: Desktop Add Connection Width Alignment

- Removed the add-connection page's narrow centered wrapper so the surface now uses the same full-width content area as `Agents`, `Connections`, and `Settings`.
- Kept the internal sections/cards unchanged, but stopped constraining the whole page to `max-w-4xl`, which had made the route feel visually disconnected from the rest of the desktop app.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 17: Desktop Preset Selector Layout Alignment

- Aligned the add-connection preset selector block with the desktop settings surface layout:
  - explanatory copy on the left
  - selector control on the right
- Replaced the old top-stacked preset card section with the same two-column section pattern used by `SettingsPage`, so the selector now reads like a standard product settings control instead of a standalone feature card.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 16: Desktop Preset Combobox

- Replaced the add-connection preset card grid with a searchable selector dropdown so the page no longer uses large cards for the top-level connection-type choice.
- Added a reusable `ui/combobox.tsx` component for the desktop renderer, using the existing button/input/card primitives to provide:
  - searchable filtering
  - icon + label rows
  - selected-state checkmark
  - click-outside close behavior
- Updated the add-connection preset chooser to show per-type icons:
  - `Official OpenAI`
  - `Gateway`
  - `Azure OpenAI`
  - `Official Claude`
  while keeping the downstream connection-method cards unchanged.
- Adjusted preset chooser copy to match the new dropdown interaction instead of the previous card-grid wording.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 15: Desktop Add Connection Method Cards

- Simplified the desktop add-connection details step by removing the `Auth mode` selector from the renderer flow.
- Reworked the page so each preset now exposes its connection methods as explicit cards instead of a generic dropdown:
  - `Official OpenAI`: `Sign in with OpenAI`, `Use current Codex session`, `Use API key`
  - `Official Claude`: `Use current Claude session`, `Use API key`
  - single-mode presets (`Gateway`, `Azure OpenAI`) fall straight through to API key entry without making the user re-select the obvious auth mode.
- Kept the rest of the form state compatible with the existing core add-connection API by translating each visible method card back into `authMode` plus optional `sessionSource`.
- Updated desktop copy so the session/API-key paths now read like concrete actions rather than low-level auth tokens.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 14: Desktop Session Auth Entry Polish

- Reworked the desktop add-connection page so session-based auth paths no longer read like generic dropdown fields.
- Added explicit OpenAI session entry actions:
  - `Sign in with OpenAI`
  - `Use current Codex session`
  with matching explanatory copy in the form body and submit CTA.
- Added an explicit Claude session entry action:
  - `Use current Claude session`
  so the page now presents Claude session auth as a direct action instead of a hidden form mode.
- Completed the desktop main-process support for `claude_session` and `cursor_session` credential resolution inside `DesktopConnectionManager`, so the UI no longer advertises a Claude session path that the bridge cannot actually fulfill.
- Added a desktop test that verifies `Official Claude + claude_session` can be created from current local Claude auth.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 13: Desktop Add Connection Select Stabilization

- Fixed a second desktop add-connection crash where the page mounted into a React 19 `Maximum update depth exceeded` loop inside the Radix Select ref composition path.
- Replaced the add-connection page's two Radix select controls (`authMode` and `sessionSource`) with local native `<select>` fields so the page no longer depends on the unstable ref behavior during first render.
- Kept the visual styling aligned with the rest of the desktop form controls by wrapping the native selects in the same border, spacing, and focus styles as the existing inputs.
- Re-ran desktop validation after the select swap to confirm the add-connection page now mounts cleanly without blanking the renderer.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 12: Desktop Add Connection Event Guard

- Fixed the blank-screen renderer crash on `Connections -> Add connection` by stopping the click event from flowing into `openAddConnectionPage()` as a fake `agentId`.
- Wrapped the connections-toolbar add action in a no-argument closure so React no longer passes `MouseEvent` into the add-connection route helper.
- Hardened `openAddConnectionPage()` with `isAgentId()` narrowing so only real agent ids can become `targetAgentId`; any other value now falls back to the global add flow.
- Re-verified desktop typecheck and tests after the event guard so the add-connection page keeps working from both generic and agent-targeted entry points.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 16: Add Connection Page Stabilization

- Fixed the desktop add-connection return flow so Nile now refreshes settings state before routing back from the new add-connection page, preventing stale-state blank screens after save.
- Tightened the add-connection page layout for narrower desktop widths by delaying the two-column split and reducing the overall content width.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 15: Desktop Add Connection Page

- Replaced the old desktop `AddConnectionDialog` modal with a dedicated `AddConnectionPage`.
- Routed `Quick setup`, `Agents`, and `Connections` add/configure actions into the new page flow while preserving the existing core onboarding and gateway probe behavior.
- Kept the first page version scoped to the four current manual presets:
  - `Official OpenAI`
  - `Gateway`
  - `Azure OpenAI`
  - `Official Claude`
- Preserved agent-targeted add flows by returning to the previous page after save and immediately applying the new connection when the page was opened for a specific agent.
- Removed the now-dead dialog component and moved desktop UI copy from modal wording to page wording.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 14: Connections Row Action Cleanup

- Removed the per-connection `Refresh` action from the desktop connections table.
- Kept the page-level refresh control in place so the connections inventory no longer repeats a row-level refresh button for every saved connection.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 13: Connections Page Import Cleanup

- Removed the per-agent `Import Codex / Cursor / Claude` buttons from the desktop `Connections` page header.
- Kept local setup import in `Quick setup` and agent-specific contexts so the standard connections inventory page now focuses on saved connections only.
- Deleted the now-unused desktop translation key for `Import {agent}` from the connections page toolbar.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 12: Desktop Quick Setup Cleanup

- Removed the duplicated `Detected local setups` panel from the standard desktop `Connections` page.
- Kept local setup import and review inside `Quick setup` only, so desktop no longer presents the same onboarding surface in two places.
- Deleted the now-dead `DetectedSetupsPanel` renderer component and its unused translation keys.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 22: Desktop Usage Visibility Guard

- Tightened the desktop renderer usage display rules so agent usage is only shown when the agent currently has a saved selected connection.
- Prevented unsaved or unconfirmed live local state from surfacing usage in the Agents list cards.
- Applied the same guard to the per-agent usage subpage so its summary header no longer shows usage for agents that have no saved current connection.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 21: Quick Setup Brand Mark Alignment

- Swapped the quick-setup page header icon from the temporary sparkle glyph to the shared `assets/icons/nile-mark.svg` brand mark.
- Increased the quick-setup header mark size so it reads as a page mark instead of a generic utility icon.
- Updated the desktop sidebar `Quick setup` navigation item to use the same `nile-mark` asset for visual consistency with the page header.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 20: Quick Setup Container Simplification

- Removed the outer gradient hero card from the desktop quick-setup page.
- Changed quick setup to render as a plain page section with a lightweight header, the agent checklist cards, and a trailing `Done` action.
- Kept the per-agent checklist behavior intact while reducing the visual weight of the page shell.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 19: Quick Setup Copy And Status Simplification

- Removed the quick-setup setup-status badges from the card header so local setup presence is now communicated by the setup content and primary action instead of extra chips.
- Replaced the previous disabled confirmation button with a green confirmed tick pill in the action slot after a setup has been accepted.
- Translated detected auth-mode tokens such as `openai_session` into user-facing auth labels before rendering quick-setup setup content.
- Deleted the now-unused quick-setup translation keys that only existed for the earlier badge-heavy version of the card.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 18: Quick Setup Card Flattening

- Simplified the desktop quick-setup agent cards into a flatter single-layer layout.
- Removed the nested "Current local setup" subpanel so each card now reads as:
  - agent identity
  - setup status badge
  - detected local setup content
  - one primary action
- Kept the existing quick-setup logic intact while reducing visual nesting and repeated containers.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 11: Core Runtime Hardening

- Split `ConnectionCreator` so it now coordinates creation flow instead of owning every sub-decision:
  - moved endpoint candidate construction into `models/connection/EndpointBuilder.ts`
  - moved onboarding suggestion rules into `models/connection/OnboardingPolicy.ts`
  - moved session/account identity-key derivation into `models/connection/IdentityKeyResolver.ts`
- Reduced `actions/usage/Usage.ts` to a coordinator and moved protocol/auth-specific reader dispatch into `actions/usage/ReaderRegistry.ts`.
- Removed Chromium browser-cookie probing from `packages/core` and replaced it with a generic `CursorUsageSessionProbe` abstraction in `application/local/CursorUsageSessionProbe.ts`.
- Added a new host-local package, `packages/host-local`, to hold Chromium Cursor session probing as a surface-level integration shared by CLI and desktop.
- Updated CLI and desktop composition roots to inject the host-local probe into `NileSession`, so Cursor usage auto-bind remains available without keeping browser integration inside shared core.
- Moved the Chromium probe verification test from core into desktop surface tests to keep browser integration coverage while preserving the new boundary.

### Verification

- `npm install --prefix apps/cli`
- `npm install --prefix apps/desktop`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 13: Root Glossary And Terminology Cleanup

- Added a root `GLOSSARY.md` that defines the current canonical Nile terms across product, core domain, usage, and deprecated historical wording.
- Updated the root `README.md` to point at the glossary and refreshed the active MVP wording so it now matches the current endpoint preset, auth mode, and agent vocabulary.
- Removed the last obvious live wording drift in desktop copy and Claude settings comments where `provider` language no longer matched the endpoint/access architecture.
- Renamed Nile's managed Codex config marker from `managed provider` to `managed endpoint` while keeping removal logic compatible with older local files that still contain the legacy marker text.
- Left historical planning/build records unchanged so repository history keeps its original context, while current-entry docs and active code now align on the new terminology set.

### Verification

- `npm run typecheck`
- `npx vitest run packages/core/src/agents/codex/apply/ApplySelection.test.ts`

### Step 14: Desktop Page Switch Performance Cleanup

- Investigated the post-Quick-setup menu lag and confirmed it was renderer-side, not extra desktop IPC on sidebar clicks.
- Removed per-page `AddConnectionDialog` mounting from both `QuickSetupPage` and `ConnectionsPage`, and hoisted a single shared dialog instance into `SettingsApp`.
- Switched the main desktop pages from full conditional remounting to shell-level visibility toggling so sidebar navigation no longer tears down and rebuilds the whole page subtree on each click.
- Kept the existing first-run and quick-setup routing rules intact while reducing the amount of work done during page switches.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 16: Quick Setup Sequential Step Flow

- Converted `Quick setup` from a single-page mixed action surface into a two-step sequential flow.
- Step 1 now focuses only on detected local setups and asks the user to explicitly continue after reviewing import options.
- Step 2 is the first point where adding a new connection becomes available, so users can no longer jump directly to add-connection from the initial quick setup screen.
- Removed the previous `Skip for now` action from the quick setup flow so the sequence reads as a guided first-run path instead of an optional hero panel.
- Refined the flow into a clearer wizard-style presentation with a visible two-step progress indicator, step-specific headings, and explicit forward/back footer actions.
- Reverted the earlier keep-alive page rendering strategy in desktop settings after it made first-run navigation sluggish; the settings shell now renders only the active page again while still keeping the shared add-connection dialog hoisted at the shell level.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 15: Quick Setup Flow Simplification

- Reduced `Quick setup` to a much shorter first-run flow:
  - show detected local setups first
  - then ask whether the user wants to add a new connection or skip for now
- Removed the heavier hero-style onboarding structure, recommendation alert, and duplicated import CTA set from the quick setup page.
- Kept the existing add-connection dialog as the current fallback entry for new connections, while leaving room for a more guided new-connection teaching flow later.
- Added a simple `Skip for now` path that moves the user back to the main desktop pages without pretending the first-run setup is complete.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 12: Session Facade Split

- Split `runtime-local/NileSession.ts` into thinner session-scoped collaborators:
  - `runtime-local/Connections.ts`
  - `runtime-local/Agents.ts`
  - `runtime-local/UsageAccess.ts`
  - `runtime-local/History.ts`
  - shared request/result types in `runtime-local/ConnectionTypes.ts`
- Reduced `NileSession` to a façade that now primarily owns:
  - shared database/session lifecycle
  - lazy collaborator construction
  - high-level public method forwarding
- Pulled local-credential-based connection creation/onboarding back behind `SessionConnections`, so `NileSession` no longer assembles those flows inline.
- Tightened `LocalWorkspaceState` by caching Cursor usage binding/snapshot stores instead of recreating them across usage, binder, and auto-bind factories.
- Kept all public runtime-local surface APIs stable while reducing the amount of orchestration logic concentrated in `NileSession`.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 11: Desktop Add Connection Route Hardening

- Hardened the desktop `add-connection` route so it now renders as an explicit visible page instead of relying on scattered `showAgents/showConnections` conditionals to leave exactly one branch mounted.
- Added a derived `visiblePage` in `SettingsApp` so the renderer always resolves to one concrete page, with `add-connection` taking precedence and invalid `agents/connections` routes falling back cleanly to quick setup.
- Added a filtered-definition fallback for agent-targeted add flows so `AddConnectionPage` never receives an empty preset list just because a target-agent filter returned no matching definitions.
- Forced `AddConnectionPage` to remount when the targeted agent changes, avoiding stale form state across repeated opens from different entry points.
- Re-verified the desktop renderer after the route hardening to catch regressions in the page transition path that previously produced a blank screen.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 11: Dark Theme Nile Mark

- Updated `assets/icons/nile-mark.svg` to use `currentColor` for its stroke so the same asset follows renderer text color in both light and dark themes.
- Kept the existing desktop icon call sites unchanged and let `Quick setup`, the sidebar, and the reset dialog inherit their theme-aware color from CSS instead of maintaining a separate white-mark asset.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 13: Quick Setup Chat Bubble Guide

- Replaced the ad hoc quick-setup guide banner layout with a dedicated `ui/chat-bubble.tsx` component so avatar, message bubble, tail, and chat-width constraints are owned by one renderer component.
- Switched the quick-setup guide to use the mascot image as the speaking avatar and constrained the message bubble to a conversation-style maximum width instead of stretching full width across the layout.
- Added `.png` asset loading support to the desktop esbuild pipeline so mascot image assets can be bundled in renderer code without breaking `desktop:dev`.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 11: Keychain Prompt Reduction For Usage Reads

- Removed the Swift-based Keychain fallback from `packages/core/src/services/credential/SecurityCli.ts` so credential reads now go through the system `security` tool only and no longer trigger `swift-frontend` attribution.
- Added an in-process cache to `KeychainCredentialStore` so repeated `has()` / `get()` calls for the same credential id reuse a single read within the current process instead of hitting Keychain again.
- Tightened the Cursor usage read path so live usage reads no longer fetch the saved `cursor_session` credential just to derive identity metadata; the reader now derives the local account fingerprint from the saved access record and only reads the bound Cursor web-session credential.
- Kept the bind / auto-bind flows using the saved Cursor session credential for identity verification, and restored `CursorUsageIdentity.fromSavedConnection(...)` alongside the lower-prompt `fromSavedAccess(...)` path.
- Deleted the dead `packages/core/src/services/credential/macos/GenericPassword.swift` helper and removed the now-empty `macos/` credential directory.

### Verification

- `npm run typecheck`
- `npx vitest run packages/core/src/services/credential/KeychainCredentialStore.test.ts packages/core/src/actions/usage/Usage.test.ts packages/core/src/actions/usage/cursor/Binder.test.ts packages/core/src/application/local/CursorUsageAutoBinder.test.ts`

### Step 12: Desktop Reset Dialog Branding

- Replaced the Settings reset confirmation flow's native `window.confirm()` / `window.alert()` calls with a renderer-owned `ResetStateDialog`.
- Branded the dialog header with the shared Nile mark asset and wrapped it in a red destructive badge so the reset action no longer shows the default Electron/system icon.
- Kept the reset action semantics unchanged: local SQLite and history are cleared, keychain credentials are kept, and quick setup is reopened after reset.
- Updated the desktop reset copy to include a dedicated dialog title key and aligned the stale settings-row test with the current usage-display behavior.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 23: Cursor Usage Live-State Completion

- Fixed the host-local Cursor state probe so it no longer copies the entire live `state.vscdb` before every read:
  - reads now open the source SQLite database in read-only mode first
  - fallback copying remains only for failure paths
- This removed the catastrophic `state.vscdb` copy path on machines where the file had grown to multi-GB size, which previously made `Looks good` / auto-bind appear to hang and could fail with `ENOSPC`.
- Updated the composite Cursor usage session probe to stop after the first source that returns candidates:
  - `Cursor / Local session` now short-circuits
  - Chromium cookie probing is kept as a fallback instead of always running afterward
- Corrected Cursor usage response parsing for the real `https://cursor.com/api/usage-summary` payload:
  - `billingCycleStart`
  - `billingCycleEnd`
  are top-level fields, not nested under `individualUsage.plan`
- Verified the full live chain end-to-end against the current saved Cursor connection:
  - `autoBindCursorUsage(...)` now binds from `state.vscdb`
  - `getConnectionUsage(...)` returns `available/live`
  - `cursor_usage_snapshots` persists a live snapshot row

### Verification

- `npm run typecheck`
- `npx vitest run packages/core/src/actions/usage/Usage.test.ts packages/core/src/actions/usage/cursor/Binder.test.ts packages/core/src/application/local/CursorUsageAutoBinder.test.ts apps/desktop/src/electron/CursorUsageSessionSourceProbe.test.ts apps/desktop/src/electron/CursorStateDbProbe.test.ts`
- Live check: `CursorStateDbProbe.createDefault().probe()` returns a local session candidate immediately
- Live check: `NileSession.getConnectionUsage('jay-ji-exampleco-ai')` returns `status: "available"` and writes a `cursor_usage_snapshots` row

### Step 24: Host-Local Decoupling

- Removed the `@nile/core` package dependency from `packages/host-local`.
- `host-local` now owns its own minimal local-probe contract and helpers:
  - `cursor/Types.ts`
  - `cursor/SecurityCli.ts`
  - `cursor/Logger.ts`
  - `cursor/Identity.ts`
- Kept the integration boundary structural rather than package-coupled:
  - `host-local` still produces probe objects compatible with Nile's cursor usage session probe shape
  - `core` and desktop/CLI composition roots consume them without `host-local -> core` imports
- This keeps `host-local` focused on machine-local extraction concerns without pulling in:
  - core logging
  - core credential helper wiring
  - core cursor identity parsing

### Verification

- `rg -n "@nile/core|from \"@nile/core|from \"\\.\\./\\.\\./\\.\\./core" packages/host-local/src -S`
- `npm run typecheck`
- `npx vitest run packages/host-local/src/cursor/Probe.test.ts packages/host-local/src/cursor/State.test.ts packages/host-local/src/cursor/ChromiumCursorSessionProbe.test.ts apps/desktop/src/electron/CursorStateDbProbe.test.ts packages/core/src/application/local/CursorUsageAutoBinder.test.ts packages/core/src/actions/usage/Usage.test.ts`

### Step 22: Cursor Usage Session Token Alignment

- Traced the remaining Cursor usage failure to the final request header shape rather than the binding flow itself:
  - saved Cursor connection and agent selection existed
  - usage binding/snapshot rows were still missing after auto-bind attempts
- Confirmed that local `state.vscdb` access tokens use JWT payload `type = "session"`, so Cursor usage identity validation now accepts:
  - `web`
  - `access`
  - `session`
- Corrected Cursor usage fetches to send the full encoded `user::<jwt>` token in `WorkosCursorSessionToken`, matching:
  - Cursor's remote `usage-summary` endpoint
  - the `research/cursor-stats` reference implementation
- Removed the dead helper that stripped the `user::` prefix down to a raw JWT, since that format returns `401` for the current Cursor usage APIs.

### Verification

- `npm run typecheck`
- `npx vitest run packages/core/src/actions/usage/Usage.test.ts packages/core/src/actions/usage/cursor/Binder.test.ts packages/core/src/application/local/CursorUsageAutoBinder.test.ts`
- `npm run test:cli`
- `npm run test:desktop`

### Step 15: Desktop First-Run Onboarding Visibility

- Fixed the desktop first-run experience so a workspace with zero saved connections no longer drops users onto the generic Agents page without visible guidance.
- Settings now auto-route the initial desktop view to a dedicated `Quick setup` page when first-run onboarding data is present.
- Added a separate `Quick setup` navigation item and page that only appears while the workspace has zero saved connections.
- Moved the first-run actions out of the generic Connections page into that dedicated setup surface:
  - import an existing local agent setup
  - add a new saved connection
- Kept the existing detected-setups panel in place within the setup page so auto-detected local setups remain importable without opening another flow.
- Refined the setup page to use a proper shadcn-style empty-state composition for the primary first-run body:
  - `Empty`
  - `EmptyHeader`
  - `EmptyMedia`
  - `EmptyTitle`
  - `EmptyDescription`
  - `EmptyContent`
- Kept `Alert`, `Badge`, `Card`, and `Button` around that empty-state core to preserve the more intentional first-run visual treatment.
- Fixed two first-run behavior gaps while doing the UI refactor:
  - `Quick setup` now auto-exits to `Connections` after the first saved connection exists instead of risking a blank page
  - import actions now follow the actual importable onboarding items instead of exposing every agent optimistically
- Left the onboarding truth in `DesktopSurface` unchanged; this step fixes renderer visibility and structure rather than rewriting onboarding state generation.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 16: Desktop Cursor Usage Repair Dialog

- Replaced the last `window.prompt` / `window.alert` fallback for Cursor usage repair with a formal renderer dialog.
- Added a dedicated `CursorUsageRepairDialog` that:
  - shows the selected connection label
  - accepts the `user::<jwt>` web session token in a controlled form
  - reports repair errors inline instead of via alert popups
  - closes cleanly after a successful repair and refresh
- Kept the repair action as a secondary fallback entry point; auto-binding remains the primary path.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 13: Cursor Usage Auto-Bind

- Added a shared local-host Chromium probe that discovers Cursor web-session cookies from known browser profiles and decrypts Chromium `v10` cookie values with macOS safe-storage secrets.
- Added `CursorUsageAutoBinder` in shared local application code so auto-binding stays outside the endpoint/access core model while still reusing the existing validated cursor-usage binder.
- Extended `NileSession` with:
  - `autoBindCursorUsage(connectionId)`
  - `autoBindAllCursorUsage()`
- Corrected Cursor usage fetches to send the full encoded `user::<jwt>` session token in `WorkosCursorSessionToken` cookies, matching Cursor's remote usage endpoints and the `research/cursor-stats` reference.
- Wired CLI auto-binding in two places:
  - explicit command: `nile cursor usage auto-bind <connectionId>`
  - silent best-effort auto-bind after creating or importing a Cursor session connection
- Wired desktop auto-binding in two places:
  - silent best-effort auto-bind after creating or importing a Cursor session connection
  - background startup scan for saved Cursor session connections missing a usage binding
- Kept the desktop manual token flow only as a fallback repair action and hid it when usage is already available, so the primary user path is now automatic.
- Added regression coverage for:
  - Chromium cookie probing
  - shared Cursor auto-bind orchestration
  - CLI `cursor usage auto-bind`

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 14: CLI Reset Double Confirmation

- Hardened the CLI reset flow so destructive local-state reset is no longer gated by a single `--yes` flag.
- Interactive reset now requires two confirmations:
  - an explicit continue selection
  - typing `RESET`
- Non-interactive reset now requires both `--yes` and `--confirm-reset`.
- Added `Reset local Nile state` to the default interactive CLI main menu so the reset flow is discoverable without remembering the command name.
- Updated CLI help text and reset-specific regression coverage to reflect the new confirmation model.

### Verification

- `npm run typecheck`
- `npm run test:cli`

### Step 14: Desktop Cursor Usage Binding

- Added a desktop-side Cursor usage binding action that reuses the existing core `bindCursorUsage()` flow instead of introducing a renderer-local usage path.
- Extended the Electron bridge, desktop state store, and desktop connection manager with an explicit `bindCursorUsage(connectionId, sessionToken)` capability.
- Added a `Bind usage` action to Cursor session connection rows in the desktop Connections table.
- Wired the desktop settings app to prompt for a `user::<jwt>` Cursor usage web session token, call the shared core binding flow, refresh state, and surface success or failure feedback.
- Added desktop regression coverage for:
  - binding a Cursor usage token through `DesktopConnectionManager`
  - invalidating cached menubar/settings state after a desktop Cursor usage bind

### Verification

- `npm run test:desktop`
- `npm run typecheck`

### Step 13: Cursor Usage Core And CLI Support

- Added a dedicated Cursor usage submodule under `packages/core/src/actions/usage/cursor/` instead of expanding `Access` or `CursorSessionCredential`:
  - `BindingRegistry` stores verified web-session bindings per saved connection
  - `SnapshotStore` stores last-known usage snapshots per saved connection
  - `Identity` parses and matches saved Cursor identity against `WorkosCursorSessionToken`
  - `Reader` resolves `live`, `cached`, `stale`, and `expired` usage states
- Extended shared usage results with:
  - `freshness`
  - `lastFetchedAt`
- Wired `Usage` to dispatch Cursor session connections to the new reader instead of returning `unsupported`.
- Added an explicit runtime-local binding entrypoint:
  - `NileSession.bindCursorUsage(connectionId, sessionToken)`
- Added a minimal CLI binding flow:
  - `nile cursor usage bind <connectionId> --session-token <token>`
- Updated CLI usage rendering to surface cached/stale freshness instead of presenting every available result as live.
- Updated desktop usage summary text so non-live snapshots remain visible as cached or stale instead of being indistinguishable from live usage.
- Added tests for:
  - identity-gated Cursor usage binding
  - live Cursor usage reads
  - cached snapshot fallback
  - end-to-end CLI bind plus usage read

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 19: Shared Reset And Desktop Settings Entry

- Moved local-state reset into a shared `StateReset` class under `packages/core/src/application/local` so both CLI and desktop now use the same database/history deletion semantics.
- Updated the CLI reset command and presenter to consume the shared reset result type instead of maintaining a duplicate app-local result shape.
- Added a desktop IPC reset action and wired it through `DesktopStateStore`, so a reset invalidates cached menubar/settings/history state before the next refresh.
- Added a destructive reset section to the desktop Settings page with confirmation text, in-progress state, and completion feedback.
- Updated the desktop stale-schema recovery message so it now points users to either the new Settings reset action or the existing `nile reset --yes` command.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 18: User Flow Alignment Cleanup

- Tightened `AccessRegistry` so an explicitly empty `enabledAgents` list now fails validation instead of silently falling back to inferred defaults.
- Updated the desktop add-connection dialog to block submit when no agents are enabled and to explain the requirement inline, matching the CLI flow.
- Reworked usage result semantics from `provider_api` to `remote_api` and changed unsupported usage messaging so it no longer implies a connection cannot still be selected for supported agents.
- Fixed the CLI remove-connection empty state so it shows a normal info panel instead of falling through to a selection failure.
- Removed the last live `provider` / `supports` wording remnants from CLI prompts, Claude apply validation, and desktop renderer helpers.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 16: Connection Semantics Alignment

- Split preset and endpoint semantics cleanly at the API boundary:
  - add-connection request objects now use `preset` and `endpointUrl`
  - saved/imported connection summaries keep `endpointFamily` typed as endpoint truth, not preset truth
- Removed `cursor` from `ConnectionPresetFamily` because it is not a user-selectable preset, while preserving cursor as an endpoint family and importable live state.
- Updated desktop connection presentation so the connection table and add dialog now distinguish:
  - detected support
  - enabled agents
  instead of showing enabled agents under a misleading `Supports` / `Supported agents` label.
- Renamed desktop connection row data from `supportedAgents` to `enabledAgents` so the field meaning matches the filtered values returned by the current surface flow.
- Reworked the remaining core, CLI, and desktop tests to use the aligned preset and endpoint vocabulary.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 17: Vestin Truth Alignment

- Updated `.vestin/architect.md` so the architecture document now describes the live endpoint/access model instead of the removed provider/binding model.
- Updated `specs/core/module.md` and `specs/core/features/workspace-state.md` so the stable core specs now match the current persisted model, runtime-local composition, and storage responsibilities.
- Kept migration history in build logs intact, but moved the current-truth documents back in sync with the implementation.

### Verification

- `rg -n 'provider|binding' .vestin/architect.md .vestin/specs/core/module.md .vestin/specs/core/features/workspace-state.md`

### Step 15: Gateway Token Cutover

- Renamed the last internal `openai-compatible` preset and endpoint-family token to `gateway` so runtime types, onboarding inputs, detection, and usage all use the same vocabulary as the product surface.
- Updated Codex current-state inference to classify custom OpenAI-style endpoints as `gateway` while preserving the external Codex `model_provider` file semantics.
- Rewrote the remaining CLI, desktop, and core tests to use `gateway`, and scrubbed the last repository-facing README references to the old preset name.
- Verified that no live `openai-compatible` references remain in `packages/core/src`, `apps/cli/src`, or `apps/desktop/src`.

### Verification

- `rg -n 'openai-compatible|OpenAI-Compatible' packages/core/src apps/cli/src apps/desktop/src`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 11: Gateway Agent Confirmation

- Changed gateway onboarding so endpoint probing is now advisory instead of silently deciding the final agent set.
- Added `enabledAgents` to access records and persistence so a saved gateway can be explicitly enabled for a chosen subset of compatible agents.
- Updated `ConnectionCreator` to preserve probe-detected endpoint protocols while letting re-added connections refresh the saved `enabledAgents` selection on existing accesses.
- Fixed the `accesses` SQLite insert statement to write the new `enabled_agents` column correctly.
- Updated CLI gateway onboarding to:
  - auto-probe known compatible agents
  - present `Codex` and `Claude` as explicit choices
  - default-select detected support while still letting the user narrow or widen the enabled set
- Updated the desktop add-connection dialog with the same model:
  - probe for detected support
  - show the detected-support hint
  - let the user confirm which gateway agents should be enabled before saving
- Added regression coverage for access persistence, gateway access reuse, CLI interactive onboarding, and desktop state-store wiring.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 14: Desktop Endpoint Naming Cleanup

- Renamed the remaining desktop surface and Electron bridge DTO fields from `provider*` to `endpoint*`, so the desktop runtime now matches the endpoint/access domain language used by core.
- Updated desktop renderer consumers, menubar rendering, and history views to read `endpointLabel` / `endpointFamily` instead of legacy provider-named fields.
- Changed the desktop connection table header from `Provider` to `Endpoint`, and renamed the add-connection dialog translation key from `dialog.providerFamily` to `dialog.endpointPreset`.
- Updated desktop tests and support fixtures to match the new endpoint-named DTOs, including replacing the stale `binding:` credential test prefix with `access:`.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Step 13: Add-Connection Request Convergence

- Switched non-interactive CLI gateway onboarding to use core onboarding defaults instead of a surface-local fallback, so scripted adds and interactive adds now follow the same core policy.
- Removed the dead desktop-side `DesktopConnectionDefinition` re-export alias and used the core `ConnectionDefinition` type directly across the Electron bridge.
- Collapsed duplicate desktop add/import connection result mapping and local-connection request assembly into dedicated `DesktopConnectionManager` helpers.
- Kept the remaining surface code focused on input collection and UI state, while request shaping and preset defaults are now consistently driven by core definitions and onboarding descriptions.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 12: Onboarding Policy Core Cutover

- Extended core `ConnectionDefinition` so preset definitions now carry the product-facing onboarding policy:
  - `configurableAgents`
  - `defaultEnabledAgents`
  - `suggestEnabledAgents`
- Moved gateway/agent onboarding rules out of CLI and desktop hard-coded conditionals and into core preset metadata.
- Added a core onboarding description flow so surfaces can ask core for:
  - configurable agents
  - probe-based suggested agents
  - default enabled agents
- Updated CLI connection onboarding to rely on core definitions and onboarding descriptions instead of local `Gateway` special-cases.
- Updated desktop add-connection flow to consume the same core policy and onboarding description instead of renderer-local gateway rules.
- Kept surface responsibilities limited to form state, prompting, and rendering while core owns the preset-specific business decisions.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`

### Step 16: Preset Vocabulary Simplification

- Simplified the manual connection preset surface to the four user-facing choices discussed in planning:
  - `Official OpenAI`
  - `Gateway`
  - `Azure OpenAI`
  - `Official Claude`
- Removed `Cursor` from the manual preset catalog while keeping Cursor import/current-state/apply support intact in core.
- Renamed generated gateway labels from `OpenAI-Compatible (...)` to `Gateway (...)` so saved connection output matches the new preset vocabulary.
- Renamed official Claude endpoint labels from `Claude Code` to `Claude`, while preserving `Claude Gateway` for non-official Anthropic-style endpoints.
- Updated desktop add-connection copy from `Provider family` / `Base URL` to `Endpoint preset` / `Endpoint URL`.
- Refreshed core, CLI, and desktop tests to match the new product wording and the improved live-state matching behavior.

### Verification

- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`
- `npm run typecheck`

### Step 17: Gateway Capability Probe

- Added a real `GatewayProbe` in core so the `Gateway` preset now detects protocol support at creation time instead of assuming OpenAI-only behavior.
- Gateway creation now probes the custom endpoint with the provided API key and stores one shared endpoint that can include:
  - `protocols.openai`
  - `protocols.anthropic`
- Converted the connection-creation path to async end-to-end for add/create flows:
  - `ConnectionCreator.create()`
  - `NileSession.createConnection()`
  - `NileSession.createLocalConnection()`
  - CLI add-connection flow
  - desktop add-connection flow
- Kept agent compatibility resolution protocol-driven, so a probed multi-protocol gateway now shows up in both Codex and Claude connection lists.
- Adjusted endpoint-family display for multi-protocol generic gateways so they still present as `openai-compatible`/`Gateway` instead of drifting to `anthropic`.
- Added regression coverage for:
  - dual-protocol gateway creation
  - dual-agent saved-connection visibility
  - CLI gateway adds under probe
  - desktop gateway adds under probe

### Verification

- `npm run test:core`
- `npm run test:cli`
- `npm run test:desktop`
- `npm run typecheck`

### Step 13: CLI Reset Command And Label Consistency

- Added an explicit CLI reset command:
  - `nile reset --yes`
  - removes the configured SQLite database file
  - removes the sibling `history/` snapshot directory
  - intentionally keeps keychain credentials untouched
- Added focused CLI coverage for:
  - destructive reset with confirmation
  - already-empty reset output
  - help text exposure
- Fixed connection creation label/id consistency by routing default endpoint and access naming through `ConnectionLabeler`, so API-key connections no longer collapse to generic `api-key` ids.
- Fixed Codex current-state fallback classification so default OpenAI local state without an explicit `base_url` is recognized as OpenAI instead of being mislabeled as a generic gateway.
- Updated CLI integration expectations to the current endpoint/access vocabulary where the surface already exposes it directly.

### Verification

- `npm run typecheck`
- `npm run test:cli`
- `npm run test:core`

### Step 14: CLI Endpoint And Preset Cutover

- Cut the CLI add flow over from legacy `provider/family/base-url` language to the new core model:
  - `--preset` replaces `--family`
  - `--endpoint-url` replaces `--base-url`
  - interactive prompts now ask for an endpoint preset and endpoint URL
- Updated CLI result DTOs so the surface now carries `endpointId`, `endpointLabel`, and `endpointFamily` instead of provider-shaped fields.
- Updated connection, usage, history, and status presenters so user-facing output now says `endpoint` instead of `provider`.
- Removed the dead `ConnectionCatalog` field from `ConnectionOnboardingPrompts`; onboarding now uses `ConnectionLabeler` directly.
- Verified the active CLI source tree no longer exposes `provider`, `--family`, or `base-url` terminology outside test fixtures that intentionally model Codex's external `model_provider` file format.

### Verification

- `rg -n "provider(Label|Family|Id)?|Choose a provider|--family|base-url\\b|Provider:" apps/cli/src -g '*.ts' -g '!*.test.ts'`
- `npm run typecheck`
- `npm run test:cli`

### Step 15: Desktop Stale-Schema Failure Handling

- Rejected the idea of adding old-schema compatibility back into `core`.
- Fixed desktop startup/background refresh handling so stale local SQLite schemas no longer bubble up as unhandled promise rejections.
- Desktop session reads now normalize SQLite missing-column failures into a direct operational message:
  - `Local Nile state schema is stale. Run \`nile reset --yes\` and restart Nile.`
- Updated desktop tests to the current endpoint/access behavior and current connection naming semantics.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Step 12: Catalog Responsibility Split And Facade Removal

- Split connection preset definition lookup and connection label inference into separate classes:
  - `ConnectionCatalog` now only owns preset definitions
  - `ConnectionLabeler` now owns endpoint/access label suggestion and token-derived naming
- Removed the empty `Connections` action facade and rewired `NileSession` directly to `SavedConnections` and `ConnectionCreator`.
- Updated CLI onboarding to use `ConnectionLabeler` directly instead of routing label generation through the preset catalog.
- Removed the last empty `packages/core/src/actions/connections` directory after the facade deletion.
- Removed the exact-type CLI aliases that were only re-exporting core connection/runtime types without adding semantics.
- Remaining AGENTS debt after this step:
  - `packages/core/src/agents/codex/apply/ApplySelection.test.ts` still exceeds the 500-line file limit and should be split by scenario.

### Verification

- `npm run typecheck`
- `npm run test:core`

### Step 11: Connection Preset Family Cutover

- Replaced the last live `ProviderFamily` type with `ConnectionPresetFamily` and moved it into the connection model alongside the preset catalog.
- Moved `AuthMode` into the access model so auth typing now lives with access semantics instead of a dead provider shell.
- Renamed `ConnectionCatalog` preview helpers from `provider` / `binding` wording to `endpoint` / `access` wording.
- Deleted `packages/core/src/models/provider` after cutting every active import over to the new access/connection type locations.
- Verified that both core and surface imports compile cleanly after the type-location and naming cutover.

### Verification

- `rg -n "models/provider|ProviderFamily|SUPPORTED_PROVIDER_FAMILIES|suggestProviderLabel|suggestPreviewBindingLabel|resolvePreviewBindingLabel" packages/core/src apps/cli/src apps/desktop/src`
- `npm run typecheck`
- `npm run test:core`

### Step 8: Legacy Shape Mapper Removal

- Removed `projection/LegacyShapeMapper.ts` after confirming runtime code no longer referenced it.
- Reworked the remaining core tests that still depended on legacy provider-to-endpoint translation so they now seed native `endpoint` and `access` records directly.
- Tightened runtime-local and status/usage DTO typing so endpoint-family reporting is derived from `EndpointShape` instead of importing legacy provider-family types into new endpoint flows.
- Verified that `packages/core` now has no remaining references to `LegacyShapeMapper`, and the full core test suite still passes on native endpoint/access seeds.

### Verification

- `npx vitest run packages/core/src/agents/codex/apply/ApplySelection.test.ts packages/core/src/agents/codex/rollback/RollbackLatestMutation.test.ts packages/core/src/agents/claude/RollbackLatestMutation.test.ts packages/core/src/agents/cursor/RollbackLatestMutation.test.ts packages/core/src/models/provider/ProviderRegistry.test.ts`
- `npm run test:core`
- `npm run typecheck`

### Step 9: Legacy Registry Deletion

- Removed the dead legacy registry implementations that no longer participated in any runtime path:
  - `models/provider/ProviderRegistry.ts`
  - `models/binding/Registry.ts`
  - `models/connection/Registry.ts`
  - their supporting row/store files and dedicated tests
- Shrunk the `models/provider` public surface down to the remaining live concepts:
  - `AuthMode`
  - `ProviderFamily`
  - supported constant lists
- Removed `ConnectionRegistry` and legacy connection-record exports from `models/connection/index.ts`, leaving only the endpoint/access-based connection APIs.
- Reworked CLI and desktop test seed helpers so they now create native `endpoint` and `access` records directly instead of constructing legacy provider/binding/connection rows first.
- Verified that after deleting the registry modules, there are no remaining repo references to `ProviderRegistry`, `BindingRegistry`, or `ConnectionRegistry`.

### Verification

- `rg -n "BindingRegistry|ProviderRegistry|ConnectionRegistry|BindingRegistryInput|ProviderRegistryInput|ConnectionRegistryInput|ProviderRecord|BindingRecord|ConnectionRecord" packages/core/src apps --glob '!**/dist/**'`
- `npm run typecheck`
- `npm run test:core`

### Step 10: Endpoint And Access Naming Convergence

- Renamed the remaining core runtime DTOs that still exposed legacy `provider*` / `binding*` fields so connection creation and saved-connection summaries now speak in `endpoint*` / `access*` terms internally.
- Simplified credential-source modeling by deleting the dead local `binding` credential scope and the unused `createBindingSource()` factory branch.
- Updated mutation-history persistence and core tests to align with the new endpoint/access vocabulary without reintroducing legacy aliases.
- Kept surface-layer product wording stable by mapping endpoint fields back to provider-facing labels only at the CLI and desktop boundaries.
- Removed the last empty legacy directories under `packages/core/src/models` after the registry and strategy deletions, so the directory tree now matches the live endpoint/access architecture.
- Verified that `packages/core` still passes full typecheck and core tests after the naming convergence.

### Verification

- `npm run typecheck`
- `npm run test:core`
