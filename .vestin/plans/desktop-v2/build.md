# Desktop V2 Build Log

## 2026-05-04

### Step 21: Repo-Local Release And Review Skills

- Added repo-local Codex skills under `.codex/skills/` for repeated Nile operational tasks:
  - `nile-desktop-release`
  - `nile-review`
- Captured the current desktop release operating rules in the release skill:
  - tag gating against dirty worktrees
  - accepted GitHub secret names
  - local signed build flow
  - expected notarized artifact outputs
- Captured Nile-specific review priorities in the review skill:
  - regression-first findings
  - release-readiness checks
  - workflow and docs consistency checks

### Verification

- Read both generated skill files in place.
- Confirmed release instructions match the current workflow and docs.

### Step 20: Release Workflow Secret Compatibility

- Updated `.github/workflows/desktop-release.yml` so the desktop release pipeline now accepts either:
  - canonical `NILE_DESKTOP_*` GitHub secrets
  - existing short-name secrets matching `apps/desktop/.env.release`
- Added a required `release_tag` input for `workflow_dispatch` so manually triggered desktop releases derive the same version format as tag-triggered runs.
- Updated release creation to generate GitHub Release notes automatically when creating a new release entry.
- Expanded `docs/desktop-release.md` with:
  - a secret-name mapping table
  - the recommended tag-driven publish flow
  - expected uploaded release artifacts
  - manual workflow dispatch usage
- Updated `README.md` to point readers at the full desktop release operating guide.
- Added desktop package `description` and `author` metadata to remove packaging warnings during release builds.

### Verification

- `npm run build:app --prefix apps/desktop`
- Confirmed local signed packaging used `Developer ID Application: QIANG JI (6N2P2T69SK)`.
- Confirmed notarization completed successfully for both `arm64` and `x64` desktop artifacts.

### Step 19: Desktop Package Size Reduction

- Removed the dev-only macOS Electron host bundle from packaged app contents:
  - moved `DesktopLauncher` host staging from `apps/desktop/dist/host` to `apps/desktop/.runtime/host`
  - updated the desktop build step to delete any stale `dist/host` output before bundling
- Tightened desktop packaging inputs in `apps/desktop/package.json`:
  - replaced broad `dist/**/*` inclusion with `dist/electron/**/*` and `dist/renderer/**/*`
  - excluded `*.map` files from packaged contents
  - kept only `en-US` and `zh-CN` Electron locales
- Split release builds into separate `arm64` and `x64` macOS artifacts instead of a default `universal` bundle, and documented the change in `docs/desktop-release.md`.
- Added a dedicated release cleanup step before desktop packaging so stale artifacts from older arch configurations do not remain under `apps/desktop/release/`.
- Moved desktop build-only packages out of runtime dependencies:
  - `@types/react`
  - `@types/react-dom`
  - `autoprefixer`
  - `postcss`
  - `tailwindcss`
- Added a release-only desktop build mode that disables sourcemaps and enables minification before packaging.
- Completed the runtime dependency cleanup by moving the remaining desktop libraries out of packaged runtime dependencies:
  - `@lobehub/icons-static-svg`
  - `@nile/core`
  - `@nile/host-local`
  - `@radix-ui/*`
  - `class-variance-authority`
  - `clsx`
  - `lucide-react`
  - `react`
  - `react-dom`
  - `tailwind-merge`
- Updated the desktop build step to clear `apps/desktop/dist/` before each build so stale outputs such as legacy `main.js` / `preload.js` no longer leak into release packages.
- Verified the main size drop after the packaging changes:
  - previous unpacked universal app: about `744M`
  - first-pass unpacked arm64 app: about `237M`
  - final unpacked arm64 app: about `214M`
  - previous packaged app.asar: about `303M`
  - first-pass packaged app.asar: about `23M`
  - final packaged app.asar: about `2.3M`
  - new unsigned artifacts:
    - `Nile-0.0.0-arm64.dmg`: about `96M`
    - `Nile-0.0.0-arm64-mac.zip`: about `99M`
    - `Nile-0.0.0.dmg` (`x64`): about `96M`
    - `Nile-0.0.0-mac.zip` (`x64`): about `97M`

### Verification

- `npm install --package-lock-only` (in `apps/desktop`)
- `npm run build:app:dir` (in `apps/desktop`)
- `npm run build:app:unsigned` (in `apps/desktop`)
- `npm run typecheck`
- Confirmed `release/mac-arm64/Nile.app/Contents/Resources/app.asar` no longer contains `dist/host` or any `*.map` entries.

### Step 18: Release Verification Hardening

- Tightened `.github/workflows/desktop-release.yml` so tagged desktop releases now run `npm test` instead of only `npm run test:desktop` before packaging and upload.
- Added `docs/desktop-release.md` to document:
  - release workflow inputs
  - required GitHub secrets
  - local signed and unsigned desktop build flows
  - how GitHub Releases are created and populated
- Updated `README.md` so public project status now matches the implemented desktop packaging pipeline instead of claiming release packaging is still missing.
- Corrected CLI reset reporting so it no longer claims credentials are always kept in keychain after reset.
- Refined shared reset semantics so `credentialsRemoved` only reports `true` when Nile-managed credential or secure-snapshot references were actually present in the workspace database.

### Verification

- `npm run typecheck`
- `npm test`

### Step 16: Desktop Release Pipeline

- Added a GitHub Actions workflow at `.github/workflows/desktop-release.yml` that:
  - triggers on `v*` and `desktop-v*` tags
  - validates signing and notarization secrets before build
  - stamps the desktop app version from the git tag
  - runs `npm run typecheck` and `npm run test:desktop`
  - builds signed macOS desktop release artifacts
  - uploads the generated `dmg` and `zip` files to the matching GitHub Release
- Reworked desktop packaging so release builds now target universal macOS output (`dmg` + `zip`) instead of a permanently unsigned local-only package.
- Added explicit macOS entitlements for hardened runtime Electron packaging under:
  - `apps/desktop/build/entitlements.mac.plist`
  - `apps/desktop/build/entitlements.mac.inherit.plist`
- Added `build:app:unsigned` so local packaging can still intentionally skip signing when a Developer ID identity is not available.
- Moved `sharp` to desktop `devDependencies` because it is only used by the icon-generation build script and should not be treated as a packaged runtime dependency.
- Added `apps/desktop/.env.release.example` plus matching `.gitignore` entries so signed local packaging can load the same signing/notarization variables without committing secrets or generated release artifacts.

### Step 17: Desktop App Icon Color Regression Fix

- Fixed desktop app icon generation so embedded Nile mark coloring handles both source SVG stroke forms:
  - `stroke="#000"`
  - `stroke="currentColor"`
- Updated macOS packaging icon input to `build/icons/icon.png` so local packaging does not depend on stale `icon.icns` fallback when `iconutil` fails.
- Regenerated `apps/desktop/build/icons/icon.png` and confirmed the icon keeps the intended white wave mark over the blue background.

### Verification

- `npm run icons --prefix apps/desktop`
- `npm run build:app:dir --prefix apps/desktop`
- Confirmed packaged icon at `apps/desktop/release/mac-arm64/Nile.app/Contents/Resources/icon.icns` renders as white wave mark.

### Step 15: Desktop macOS Packaging Scripts

- Updated `apps/desktop/package.json` to support desktop app packaging with `electron-builder`.
- Added desktop app packaging scripts:
  - `build:app`
  - `build:app:dir`
- Added desktop packaging config under `build`:
  - app id: `dev.nile.desktop`
  - product name: `Nile`
  - output directory: `release`
  - packaged files include desktop `dist`, icon assets under `build/icons`, and `package.json`
  - macOS category/icon settings plus unsigned local build behavior (`identity: null`)
- Set desktop package `main` to `dist/electron/main.cjs` and mirrored that in `build.extraMetadata.main`.
- Added `electron-builder` as a desktop dev dependency and moved `electron` from `dependencies` to `devDependencies` to satisfy electron-builder packaging requirements.

### Verification

- `npm run build:app:dir --prefix apps/desktop`
- Confirmed unpacked app output at `apps/desktop/release/mac-arm64/Nile.app`

## 2026-05-03

### Step 13: Provider Catalog Page

- Added a new desktop sidebar navigation item for `Providers`, positioned alongside the existing settings-shell pages.
- Introduced a locally maintained renderer catalog file at `apps/desktop/src/renderer/providers.json` so provider metadata now lives in one editable JSON source instead of being hardcoded in page code.
- Added a typed `ProviderCatalog` loader with explicit validation for:
  - provider
  - provider key
  - official link
  - description
- Added a new `ProvidersPage` that renders the catalog in a simple table and opens official links through an explicit desktop bridge instead of navigating the Electron settings window away from Nile.
- Added a focused renderer test covering local provider catalog loading and URL validation.
- Moved provider-localized fields into the same JSON file under per-language `translations`, so provider name and description can be maintained in one provider-owned translation source instead of being split across multiple files.
- Reframed the `Providers` page description away from internal catalog wording and toward the real user task: comparing providers, understanding fit, and opening official docs before choosing one.
- Reused the same provider catalog inside `Add connection` and connection edit flows, so matching presets can now show an inline `About` card with official link and provider summary beside the form.

### Step 14: Core Review Hardening

- Hardened OpenClaw apply behavior so API keys are no longer written in plaintext to `openclaw.json`:
  - OpenClaw now requires env-backed API-key credentials.
  - OpenClaw config now writes `${ENV_KEY}` references instead of raw secrets.
- Removed OpenClaw snapshot TOCTOU risk by reading with `try/catch` directly instead of `existsSync` pre-check.
- Reduced database hot-path overhead by caching prepared SQLite statements in `SqliteDatabase`.
- Removed mutation-history list N+1 query behavior by batch-loading file rows for listed mutations.
- Expanded Cursor keychain missing-entry detection to include `item not found` and `errSecItemNotFound` patterns.
- Removed hardcoded agent-id string checks in saved-connection compatibility logic by switching to agent constants.
- Moved connection default-enabled agent policy ownership fully into shared connection policy logic.
- Reduced credential-store duplication by re-exporting host-local Cursor `SecurityCli` from shared core service.
- Refined core naming to follow local-directory naming rules by renaming broad-prefix files in:
  - `models/connection`
  - `models/agent`
  - `models/selection`
  - `services/credential`
- Removed single-file service directories by lifting:
  - `services/environment/EnvironmentSource.ts` -> `services/EnvironmentSource.ts`
  - `services/logging/NileLogger.ts` -> `services/NileLogger.ts`
  - and aligned `@nile/core` exports + tsconfig path aliases to the new locations.
- Added persisted API-key metadata (`api_key_source`, `env_key`) in access rows to avoid keychain reads on saved-connection list paths for new/updated rows, with fallback for legacy rows.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

## 2026-04-29

### Step 3: Settings Shell

- Reworked `apps/desktop/src/renderer/settings.html` into a shell with left navigation and page scaffolds for `Connections`, `Current Agent`, `History`, and `Advanced`.
- Refactored `apps/desktop/src/renderer/settings.ts` into a renderer controller that drives page selection, preserves add/import/remove/switch flows under `Connections`, and reuses current settings state in `Current Agent`.
- Restyled `apps/desktop/src/renderer/styles.css` for the desktop settings shell while keeping existing menubar classes intact.

### Step 4: Menubar-First Desktop

- Simplified the tray menu to a native two-level structure:
  - `Open Main Window`
  - one submenu per supported agent
  - `Quit`
- Each agent submenu now lists only compatible saved connections, keeps the current one at the top, and shows it checked.
- Updated the desktop bridge and surface so switching is explicit by `agentId + connectionId`, matching the multi-agent tray structure.
- Kept the main window focused on the new shell while leaving `History` and `Advanced` as staged pages instead of overloading the tray menu.

### Step 5: History Page Wiring

- Added desktop history IPC and surface methods so the renderer can read recent Nile mutation history without opening its own core session graph.
- Reworked the `History` page from scaffold-only to a usable first pass:
  - latest rollback availability
  - recent mutation list
  - `Rollback latest Codex change`
- Kept rollback scope aligned with current core behavior by targeting Codex only.

### Step 6: Usage In Tray And Settings

- Extended `DesktopSurface` to read connection-scoped usage through shared core and project a small desktop-facing summary instead of leaking provider-specific quota payloads into Electron.
- Updated the native tray menu so each agent submenu can show one disabled usage line for the current connection, using the tightest remaining window (`5h` vs `weekly` for Codex/OpenAI session).
- Added the same usage summary to desktop settings connection rows so the main window and tray stay consistent without introducing a separate desktop-only usage model.

### Step 7: Desktop Icon Chain

- Added `apps/desktop/generate-icons.ts` so desktop-specific icon outputs can be regenerated from the shared `assets/icons/nile-mark.svg` source.
- Generated and checked in:
  - `apps/desktop/build/icons/nileTemplate.png`
  - `apps/desktop/build/icons/nileTemplate@2x.png`
  - `apps/desktop/build/icons/icon.icns`
- Updated Electron runtime wiring so the tray uses the template PNG outputs while the app/window icon path resolves to `icon.icns`.
- Updated the desktop `build` script to regenerate icon assets before bundling renderer and main-process code.

### Step 8: First-Run Import Flow

- Added a desktop first-run onboarding state that only appears when there are no saved connections yet.
- Wired the main window to scan local setups automatically and branch into:
  - single import recommendation
  - multi-select import
  - empty-state guidance
- Kept the new flow on top of the shared core `scan-local` actions instead of adding desktop-only detection logic.
- Added desktop IPC and surface support for importing selected detected setups, then returning the user to the normal settings view once saved connections exist.

### Step 9: Finish Settings Gaps And Build Path

- Promoted `Current Agent` from a Codex-only view to a real multi-agent page with agent tabs, per-agent quick actions, and per-agent compatible connection lists.
- Added a reusable `Detected local setups` section under `Connections` so scan/import stays available after first-run instead of disappearing once onboarding is done.
- Replaced the old `Advanced` placeholders with concrete local diagnostics:
  - database path
  - agent homes
  - supported agents
  - saved connection count
  - importable setup count
- Kept renderer control files under the repository limits by splitting detected-setup, current-agent, and saved-connection rendering into focused view classes.
- Fixed `apps/desktop/build.ts` so desktop build verification resolves `apps/desktop/src/...` instead of the broken `apps/src/...` path.

### Step 10: Multi-Agent Rollback

- Extended shared rollback support beyond Codex so Claude and Cursor can both restore their last Nile-managed local state:
  - Claude rollback now restores `settings.json` and `.credentials.json`
  - Cursor rollback now restores both config files and tracked keychain credential state
- Added focused rollback tests for the new Claude and Cursor paths alongside the existing Codex coverage.
- Exposed rollback capability back into desktop state so `Current Agent` can enable rollback per agent instead of hard-coding Codex.
- Reworked the desktop `History` page into an agent-scoped view with tabs, per-agent rollback availability, and agent-filtered mutation history instead of a single Codex-only rollback button.

### Step 11: Desktop UX Redesign Skeleton

- Reordered the main window navigation around user tasks instead of internal capability groups:
  - `Home`
  - `Agents`
  - `Connections`
  - `History`
  - `Settings`
- Added a real `Home` page so the main window no longer drops straight into a management-heavy connections screen.
- Introduced renderer-level agent icons and tone treatment for:
  - Home agent cards
  - Agents tab strip
  - History tab strip
- Reworked the sidebar framing so `Settings` is a lower-priority entry instead of a peer to the main operational tabs.
- Shifted the window copy from “Main Window” toward a more product-facing “Control Surface” framing.
- Kept the existing connection management and agent diagnosis functionality intact while moving the default user path toward:
  - overview first
  - diagnose second
  - inventory management third

### Verification

- `npm run typecheck`
- `npm run test:desktop`
- `npm run desktop:build`

### Step 12: Real Agent Icons And Stable App Icon Rasterization

- Replaced the placeholder renderer agent icons with real brand SVGs sourced from `@lobehub/icons-static-svg`:
  - Codex
  - Cursor
  - Claude Code
- Switched desktop icon generation away from the broken local ImageMagick/QuickLook rasterization path that was producing blank PNG outputs from `assets/icons/nile-mark.svg`.
- Rebuilt the desktop icon pipeline around `sharp` so `icon.png`, `nileTemplate.png`, and `nileTemplate@2x.png` are generated from the shared SVG with a predictable transparent background.
- Aligned the menubar icon with the new app icon treatment by switching the tray image from the old monochrome template asset to the rounded `icon.png` brand mark and resizing it for menu bar display.
- Reverted the tray back to the standard macOS template-image path after validating that branded app icons are not the right menubar treatment on macOS.
- Added a dedicated tray rasterization path so the template icon keeps the larger wave proportion without inheriting the black rounded app background.
- Set the runtime desktop app name explicitly to `Nile` so dev-mode launches no longer appear as `Electron` in the macOS app menu.
- Corrected the remaining macOS app-name leak by changing desktop launch flows to start from a generated `Nile.app` host bundle instead of the stock `Electron.app` binary.
- Kept the existing `app.setName("Nile")` and menu labels, but moved the real fix into a reusable desktop launcher so both `desktop:dev` and `desktop:start` use the same host-bundle override.
- Rebuilt the desktop settings renderer around `React` plus shadcn-style open-code components instead of the previous hand-built DOM controller and page-specific string templates.
- Collapsed the desktop settings surface into two responsive pages: `Agents` for current runtime state plus explicit switching, and `Connections` for saved connection inventory, compatibility, usage, import, and creation flows.
- Added `supportedAgents`, `selectedByAgents`, and per-agent current usage into desktop view state so the new renderer can describe connection compatibility and active selections without recomputing provider rules in the renderer.
- Switched desktop CSS generation to a Tailwind-backed build step so the new renderer can use responsive utility classes while keeping the warm light Nile visual theme.
- Reworked the settings shell into a proper desktop frame:
  - one full-width title bar above the app body
  - a collapsible icon rail instead of fully hiding the sidebar
  - a stable macOS traffic-light safe area that no longer collides with scrolled or collapsed sidebar content
- Removed the extra shell-level content card so the `Agents` and `Connections` pages render directly on the inset surface instead of being wrapped by a second large container.
- Fixed the shell height chain so the app root is a real `flex-col` frame; the sidebar, inset surface, and divider now stretch to the full window height instead of stopping at content height.
- Kept navigation reachable at narrow widths by rendering the sidebar at all breakpoints and collapsing it into an icon rail instead of hiding it under `md`.
- Expanded the `Connections` page import actions so users can import the current local setup for any supported agent instead of only Codex.
- Added a viewport-aware sidebar guard so crossing the `960px` threshold auto-collapses into the icon rail when narrow and auto-expands again when wide.
- Added a desktop `Settings` page to the left navigation with persisted interface preferences for:
  - language: English / Chinese
  - theme: system / light / dark
- Switched desktop theming onto the shadcn-recommended token model by keeping semantic CSS variables in `:root`, overriding them under `.dark`, and resolving `system` through `prefers-color-scheme`.
- Moved the sidebar shell onto the dedicated `sidebar-*` token set so light and dark mode apply consistently across the app frame instead of only the main content surface.
- Replaced the remaining hand-styled desktop settings dropdowns with the official shadcn `Select` component pattern and added a local `apps/desktop/AGENTS.md` rule to prefer shadcn component implementations over bespoke styled controls.
- Continued the renderer cleanup by replacing custom separators and native checkboxes with shadcn open-code `Separator` and `Checkbox` components, and tightened the local desktop UI rules to allow Tailwind only for composition/layout glue rather than bespoke control styling.
- Refactored the desktop sidebar from a plain styled wrapper into a controlled sidebar primitive with:
  - `SidebarProvider` state
  - `useSidebar`
  - `SidebarTrigger`
  - `SidebarGroup` / `SidebarGroupContent`
  - icon-collapse behavior driven by sidebar state instead of page-level conditional markup
- Continued the page-level cleanup by replacing remaining hand-built alert and metric blocks with shadcn-style `Alert` and `Card` composition in `AgentPage`, and removed the last obvious hard-coded `Current` badge copy from the connections table.
- Further tightened `AgentPage` by reducing the top-level agent selector from a nested metric-card grid into a denser section list row pattern, which removes another layer of bespoke visual blocks while preserving the same state summary.
- Extended the desktop translation cleanup into shell and menubar surfaces by routing the sidebar toggle label, menubar headings, action buttons, and empty-state copy through the shared renderer i18n catalog instead of hardcoded English strings.
- Closed the remaining desktop front-end review gaps by:
  - making the menubar react to preference changes instead of only reading language/theme at bootstrap
  - routing menubar auth mode display through the shared `authModeLabel` helper
  - removing the last hardcoded sidebar trigger accessibility label from the sidebar primitive
- Added proactive usage refresh on connection switches by refreshing both the previously selected connection and the newly selected connection inside `DesktopSurface.switchConnection()`, so the menubar cache and the next settings refresh pick up updated usage immediately after an explicit switch.
- Introduced a minimal `DesktopStateStore` in the Electron main process so desktop state reads and mutations now flow through one cache-and-invalidation layer above `DesktopSurface` and `DesktopConnectionManager`, without changing visible renderer behavior yet.
- Moved the tray open path onto cached menubar state from `DesktopStateStore`, so `popUpContextMenu()` no longer waits for a fresh `DesktopSurface.getMenubarState()` call before the menu appears; background refresh now happens after popup instead of on the critical click path.
- Stopped the settings renderer from doing its own post-mutation full refresh after switch/import/add/remove/rollback actions; those flows now wait for the desktop action and then rely on the existing main-process `desktop:state-changed` push to reload state, reducing duplicated request/response loops in the renderer.
- Reworked the `Agents` page from the old selector-plus-detail split into one fixed-order agent list, where each row now shows the current connection, current usage, compatible connection count, inline switching actions, and recent per-agent switch history sourced directly from desktop settings state.
- Tightened that `Agents` redesign into a simpler information architecture: the default agent page is now a minimal list, and each agent opens dedicated `History`, `Switch`, and `Usage` subpages instead of trying to show all detail inline on the root list.
- Split the heavier React renderer files back under the repo limits by extracting:
  - agent list toolbar and agent card rendering
  - saved connections table rendering
  - add-connection form state
  - desktop state refresh and responsive sidebar state
  - sidebar navigation rendering
- Reworked the root `Agents` cards again around a denser summary layout:
  - top row now shows icon, agent name, connection count, and a `More Details` link
  - main row now shows an inline current-connection dropdown for direct switching
  - usage now renders plan label plus per-window progress bars instead of a single text summary
- Expanded desktop usage summaries to keep all available quota windows and the plan label, so the renderer can show `5h` and `weekly` usage at the same time on agent cards.
- Refreshed the generated desktop app icon treatment to use a Mail-style blue gradient background with a subtle top highlight while keeping the shared Nile wave mark and the existing monochrome tray-template outputs.
- Simplified the desktop Settings reset action copy by shortening the destructive button label to `Reset` / `重置` and removing the extra post-reset explanatory note under the button.
- Cleaned up the shared Cursor usage probe boundary by:
  - routing `packages/host-local` through explicit `@nile/core` export paths instead of direct `core/src` imports
  - adding a narrow `@nile/core/usage/cursor` public entry for the shared identity helper
  - moving the Chromium/state-db/source-probe tests out of `apps/desktop/src/electron` and into `packages/host-local/src/cursor`
  - adding `test:host-local` and including `packages/host-local` in the default vitest include list
- Tightened desktop Cursor usage state handling so `null` now only means `not loaded yet`, while Cursor-specific `unavailable/error/unsupported` results are preserved as explicit desktop usage states instead of being collapsed away before the renderer can act on them.
- Renamed the desktop-facing `Usage` copy to quota-oriented wording so the UI consistently describes remaining allowance instead of sounding like historical consumption:
  - short labels now use `Quota left`
  - agent detail pages use `quota` / `remaining quota`
  - Cursor repair flows now talk about quota sync rather than `usage`
  - tray labels now show `Quota · ...`
- Replaced the agent-list toolbar pencil icon with a sorting icon so the order-edit button reads as reorder/sort instead of generic edit.
- Fixed desktop refresh semantics and external state visibility:
  - added a real renderer-side `refreshSettings` IPC that invalidates desktop caches before the settings UI re-reads state
  - changed settings refresh flows to fetch fresh settings/history/connection-definition state instead of reusing warm cache entries
  - added a desktop main-process watcher on the shared `~/.nile-switcher/switcher.sqlite` workspace files so CLI-written connection changes invalidate desktop cache and surface without a restart
- Added visible refresh-button feedback across the desktop settings surface by introducing a shared renderer `RefreshButton` that disables during work and spins the icon until the async refresh completes.
- Removed the nested card treatment from the Agents-list `Quota left` block so it reads as part of the agent card instead of a second card inside it.
- Reframed quick-setup copy around saving local setups into Nile instead of vague confirmation so first-run and drift-import scenarios use the same clearer language:
  - `Looks good` -> `Save to Nile`
  - `Confirmed` -> `Saved in Nile`
  - the page description now explains that saving makes setups switchable and trackable
- Simplified the quick-setup saved state badge to a green check-only pill, while keeping the `Saved in Nile` label in accessibility/title metadata instead of visible copy.
- Refined quick-setup guidance so the page header now explains that Nile is reviewing detected local setups, while only `new` setup cards show a small inline hint explaining why saving into Nile matters.
- Upgraded the quick-setup `new setup` explanation from muted helper text to a proper inline `Alert`, and added a `New setup` badge so unsaved local setups stand out without relying on button text alone.
- Reframed quick-setup cards into two layers so the agent is the outer context and the detected setup becomes its own bordered region:
  - `New setup` now belongs to the setup region instead of the agent heading
  - the save rationale and `Save to Nile` action now sit together on the right as one action cluster
- Moved the quick-setup save rationale out of the setup panel itself so the inner bordered region stays focused on setup data, while the right-side action cluster carries the explanation and save CTA.
- Dropped the inner setup-card treatment from quick setup so the left-side setup content reads as plain content again, and strengthened the unsaved-state marker into a colored `New Setup Found` badge.
- Removed the separate unsaved-state explainer panel from quick setup and folded that affordance into the `Save to Nile` CTA itself:
  - the save button now carries a save icon by default
  - clicking it switches the icon into an animated saving spinner until the async action completes
- Unified the desktop agent/setup expression across Quick setup and Agents:
  - `QuickSetupAgentCard` now builds on shared `AgentCardHeader` and `DetectedSetupSection`
  - the Agents list receives detected local setups and can show the same `Save to Nile` affordance inside each agent card
  - when an agent has no saved current connection but Nile has detected a local setup, the card now suppresses the empty quota block and surfaces the detected setup section instead
- Added a dynamic quick-setup guide banner above the agent cards so the page now explains the current onboarding state in friendlier product language:
  - unsaved local setups now explain why saving matters for quota tracking, switching back later, and avoiding auth-drift loss
  - invalid local setups now prompt the user to finish signing in or repair local state first
  - fully saved and fully empty states now get their own lighter summary guidance instead of reusing the same static page copy
- Aligned the quick-setup `unsaved` guide banner with the `New Setup Found` badge by moving both onto the same amber warning palette instead of mixing blue and amber on the same state.
- Simplified drift handling in the root Agents cards so a newly detected local setup now takes over the primary card content:
  - the saved-connection dropdown and quota block are hidden while the unsaved local setup is being surfaced
  - any existing saved selection is reduced to a lightweight `Saved in Nile: ...` note instead of competing as a second “current” block
- Added an explicit zero-connection onboarding mode to the desktop shell:
  - when there are no saved connections yet, the sidebar now hides `Agents` and `Connections`
  - `Quick setup` stays reachable until the first connection is saved, so the user never lands in a shell with only `Settings`
  - once saved connections exist again, the normal `Quick setup` dismissal and full navigation surface return
- Changed `Quick setup` dismissal into a hide-from-sidebar behavior instead of fully removing access:
  - after `Done`, the page now returns to `Agents` when saved connections exist
- Added custom `auth.json` path support to the desktop `Import auth.json` flow:
  - the Add connection form now shows an editable `auth.json path` field only for the `Import auth.json` method
  - the default remains `~/.codex/auth.json`, but users can point Nile at any other Codex auth snapshot on disk
  - Codex auth-path reads now expand a leading `~/` before loading the file, so the default path and user-edited home-relative paths both work
  - the desktop bridge and connection manager now pass the custom path through to the shared local credential resolver
  - added focused tests for custom-path reads in shared Codex credential loading and desktop add-connection flows
- Simplified the `Connections` inventory view by removing the text `Selected by` column and replacing it with a narrow agent-logo column before `Name`:
  - desktop tables now show selected agents as brand icons in a compact leading column
  - mobile cards now show the same selected-agent icons inline with the connection name
  - removed the unused `Selected by` UI copy from desktop i18n
- Reworked the desktop `Import auth.json` path input into a real file-picker flow:
  - the OpenAI current-session import path now renders as a read-only path field plus `Choose file`
  - clicking it opens the native macOS file chooser, filtered to JSON files
  - the chosen file path is returned through a new preload/main-process IPC instead of asking users to type paths by hand
- Reframed the `Connections` inventory around detail subpages instead of row-level destructive actions:
  - the table now replaces the old `Actions` controls with a single `More Details` entry point
  - each connection opens a dedicated subpage with an in-page breadcrumb header
  - repair-quota and remove-connection actions now live inside the detail page instead of the list
  - the detail view is section-based and avoids the previous full-page card wrapper
- Unified add-connection completion routing around the page the user came from:
  - quick setup entries return to `Quick setup`
  - agent-page entries return to `Agents`
  - connections-page entries now open the created or reused connection directly in its detail subpage
  - this routing no longer depends on whether the result was newly created or reused
- Hardened duplicate detection for OpenAI session connections:
  - confirmed the live `~/.codex/auth.json` carries a stable OpenAI `account_id` and should normally reuse the existing saved OpenAI session connection
  - extended OpenAI session identity resolution to fall back to the JWT `sub` claim before weaker display/email labels
  - upgraded connection reuse matching so OpenAI sessions can still reuse existing saved connections when identity keys are missing or stale by comparing session credential material (`accountId`, then `refreshToken`, then `idToken`)
  - added focused coverage for reusing an existing OpenAI session access via matching refresh token

### Verification

- `npx vitest run packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/agents/codex/current-state/CurrentCredentialReader.test.ts apps/desktop/src/electron/DesktopConnectionManager.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
  - the sidebar still hides `Quick setup` once dismissed
  - the Agents toolbar now shows a `Quick setup` entry beside the sort/refresh controls so users can reopen it on demand
- Reinstated a temporary sidebar `Quick setup` entry while that page is open, so reopening it from the Agents toolbar no longer leaves the user on a page with no matching nav item.
- Tightened the reopen behavior so using the Agents-toolbar `Quick setup` entry now clears the dismissed flag; once reopened, the sidebar item stays visible again until the user explicitly clicks `Done`.
- Fixed the desktop renderer build after the agent model barrel started exporting Node-only home-resolution helpers:
  - added explicit `@nile/core/models/agent/types` and `.../homes` package export paths
  - moved desktop renderer imports onto the browser-safe `agent/types` path so esbuild no longer tries to bundle `node:os` / `node:path` into the settings surface
- Normalized add-connection auth-method ordering so session-based sign-in options now render ahead of API-key methods, including making Claude default to `Sign in with Claude` before `Use API key` just like the OpenAI flow.
- Stopped agent-scoped add-connection entrypoints from narrowing saved connections down to a single agent:
  - connections opened from an agent flow now still preserve all detected/supported enabled agents
  - the add-connection form now shows true multi-agent capability instead of replacing it with just the entry agent
  - the entry agent context remains only as a post-save switch target and lightweight page hint, not as a capability limiter
- Made gateway capability feedback visible in both add-connection layouts, so even single-capability forms now show the same explicit `Detected support: ...` probe result instead of silently collapsing to a bare final capability value.
- Simplified the Connections surface by hiding empty `Selected by` values instead of rendering `Nobody`, both in the mobile card layout and the desktop table.
- Removed the manual `Label` field from the add-connection flow so new connections now always start with Nile’s automatic naming; users can rename later instead of making that a required creation-time decision.
- Reworked connection detail quota presentation so saved connections now show full window-by-window quota meters instead of a single summary string:
  - desktop usage summaries now keep each window’s `resetsAt` timestamp through the renderer boundary
  - connection detail pages now render one progress bar per usage window and show the next renewal time under each window when available
  - agent cards were switched to the same shared quota meter component so quota visuals stay consistent across the settings surface
- Added a shadcn-style renderer `Progress` primitive so quota meters no longer hand-roll bar markup inline.
- Fixed gateway capability detection in the add-connection form:
  - the gateway/API-key flow was repeatedly writing the same enabled-agent array back into form state after each onboarding probe
  - because the probe effect depended on that array, the identical write retriggered the probe and kept the UI stuck in `Detecting supported agents…`
  - enabled-agent updates are now a no-op when the selection did not actually change, so probe results can settle and render normally
- Simplified connection detail page status semantics:
  - removed the lower `Used by` section so active-usage status is no longer duplicated in two places
  - removed the endpoint badge from the title row because endpoint already appears in the detail fields
  - replaced the generic `Current` badge with per-agent `... in use` badges so the header now tells users exactly which agent is actively using the connection
- Reduced jargon in the connection detail identity fields:
  - official OpenAI session connections no longer repeat `Endpoint: OpenAI`, since that field adds no new information in the default OpenAI-session case
  - added an inline help tooltip for `OpenAI session` explaining that Nile is using the signed-in OpenAI account session rather than an API key
- Replaced the non-working native title hint in connection detail with the official shadcn/Radix tooltip stack:
  - installed `@radix-ui/react-tooltip`
  - added a shared renderer `ui/tooltip.tsx`
  - moved the connection-detail auth help onto the new tooltip so it renders reliably inside Electron instead of relying on the system `title` hint
- Moved the Connections-table agent icon hover hint off the old native `title` attribute and onto the shared Radix tooltip as well, so `Currently used by ...` now actually renders in the inventory list.
- Tightened the small-window Connections inventory layout:
  - removed the extra outer page card so mobile/narrow widths no longer show a large wrapper card around individual connection cards
  - moved each mobile card’s `More` link into the top-right corner beside the connection title instead of leaving it detached at the bottom
  - kept the bordered table container only on large screens, where it still helps the tabular layout read as a single surface
- Filled the titlebar’s empty trailing slot with a Nile logo home button:
  - repurposed the right-aligned logo-only header button into a `Nile` entry dialog instead of a simple home shortcut
  - the dialog now exposes `About Nile`, `Support`, and `GitHub issues` entry points
  - `Support` opens `mailto:info@vestin.io` and `GitHub issues` opens `https://github.com/vestin-io/Nile/issues` through explicit task-oriented Electron IPC calls rather than a generic external-link bridge
- Tightened connection detail actions:
  - the `Refresh` button now uses the same default size as `Remove`
  - delete is now hidden whenever a connection is actively selected by any agent
  - the renderer also guards the remove handler so in-use connections cannot be deleted through stale UI state
- Added a real connection edit flow instead of a placeholder button:
  - surfaced `update` support from core saved-connections storage through `NileSession`, the desktop connection manager, state store, preload bridge, and renderer
  - expanded saved-connection summaries to carry `endpointId`, `enabledAgents`, and `configurableAgents`, which lets the desktop edit page render the true per-connection capability set without guessing from UI context
  - the edit page now supports changing the connection label and enabled agents only; endpoint/auth remain read-only
  - if an agent is currently using the connection, that agent is kept enabled both in the UI and in the persistence layer so editing cannot orphan a live selection
  - grouped `Edit`, `Refresh`, and `Remove` into one shared header action group in connection detail; wide layouts show text-only buttons, narrow layouts collapse them to icons only
- Reworked connection editing from a shallow label patch into a real auth-aware update flow:
  - added a core `ConnectionUpdater` that can update credentials, endpoint URLs, and enabled-agent capability in one path while preserving live agent selections and cleaning up or reusing endpoints correctly
  - extended `AccessRegistry.update(...)` so a saved connection can move to a different endpoint, which is required for gateway and Azure edits
  - threaded richer update inputs through runtime-local, Electron main/preload/state-store, and renderer so edit can now submit auth-specific updates instead of just renaming a connection
  - saved-connection summaries and desktop connection state now carry `endpointUrl`, which lets edit preload the existing gateway/Azure endpoint instead of guessing from labels
- Started sharing add/edit renderer structure instead of keeping two unrelated forms:
  - extracted shared connection form parts for method selection and capability/agent editing
  - `Add connection` now uses the shared method picker and capability block instead of owning its own duplicate card logic
  - `Edit connection` now reuses the same method-selection language and auth-specific sections:
    - OpenAI session: `Sign in with OpenAI` or `Import auth.json`
    - API key connections: update API key directly
    - Gateway / Azure OpenAI: update endpoint URL and API key
    - Gateway: re-detect supported agents from the current endpoint + API key preview path, and only expose `Enable for agents` there
  - Cursor connections remain name-only edits for now because there is no add-flow preset or stable credential refresh path to share yet

### Verification

- `npx vitest run apps/desktop/src/UsageSummary.test.ts apps/desktop/src/DesktopSurface.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npx vitest run packages/core/src/models/connection/ConnectionUpdater.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npx vitest run apps/desktop/src/electron/DesktopStateStore.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npx vitest run apps/desktop/src/renderer/useAddConnectionForm.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Claude auth-source cleanup

- Fixed Claude settings apply so Nile removes conflicting Claude-owned auth helpers when taking over authentication:
  - `apiKeyHelper`
  - `ANTHROPIC_FOUNDRY_API_KEY`
  - `ANTHROPIC_FOUNDRY_RESOURCE`
  - `CLAUDE_CODE_USE_FOUNDRY`
- This prevents Claude Code from seeing multiple active auth sources at once when Nile applies:
  - a gateway/API-key Claude connection via `ANTHROPIC_AUTH_TOKEN`
  - a direct Anthropic API-key connection via `ANTHROPIC_API_KEY`
  - a Claude session connection
- Added regression coverage for both API-key and session apply paths so these conflicting auth-source keys are removed instead of preserved.

### Verification

- `npx vitest run packages/core/src/agents/claude/SettingsStore.test.ts packages/core/src/agents/claude/current-state/Reader.test.ts`
- `npm run typecheck`

### Claude auth conflict cleanup

- Fixed Claude apply so Nile clears `apiKeyHelper` from `~/.claude/settings.json` whenever it applies either:
  - an API-key-backed Claude connection
  - a Claude session connection
- This prevents Claude Code auth conflicts where `apiKeyHelper` competes with:
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_AUTH_TOKEN`
- Added regression coverage for:
  - API-key apply removing `apiKeyHelper`
  - session apply removing `apiKeyHelper`
  - Claude current-state reader expectations after the newer `api_key` credential shape change

### Verification

- `npx vitest run packages/core/src/agents/claude/SettingsStore.test.ts packages/core/src/agents/claude/current-state/Reader.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### API key source modes

- Added two API-key source modes across desktop add/edit flows:
  - `Paste API key`
  - `Use existing env key`
- `api_key` credentials now distinguish:
  - direct secrets stored in Nile
  - env-key references stored as the variable name only
- Local credential resolution now supports both:
  - `resolve(...)` stores the env-key reference without materializing the secret
  - `resolveProbeCredential(...)` reads the real env value only when gateway/Azure probing needs it
- Connection create/update flows now separate:
  - persisted credential
  - probe credential for endpoint detection and gateway capability refresh
- Codex apply now respects env-key-backed API-key connections:
  - writes the custom `env_key` into `config.toml`
  - does not write the real secret into `auth.json`
  - avoids overriding a user-managed `OPENAI_API_KEY` slot for env-key mode
- Desktop connection summaries now carry API-key source metadata so edit flows can reopen in the correct mode.
- Current-state matching/import reuse for Codex API-key setups now also recognizes saved env-key-backed connections by env key name.

### Verification

- `npm run typecheck`
- `npx vitest run packages/core/src/application/local/LocalCredentialResolver.test.ts packages/core/src/models/connection/ConnectionCreator.test.ts packages/core/src/agents/codex/apply/ApplySelection.test.ts`
- `npm run build --prefix apps/desktop`
- `npx vitest run packages/core/src/models/connection/SavedConnections.test.ts apps/desktop/src/electron/DesktopStateStore.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop renderer component and state boundary cleanup

- Split desktop renderer shell concerns so `SettingsApp` no longer owns preference persistence, theme synchronization, and page/selection routing directly:
  - added `useDesktopPreferences`
  - added `useSettingsNavigation`
- Reduced the two main oversized renderer files back under the repository limit:
  - `apps/desktop/src/renderer/SettingsApp.tsx` -> 434 lines
  - `apps/desktop/src/renderer/AddConnectionPage.tsx` -> 384 lines
- Moved add-connection async orchestration out of page JSX into `useAddConnectionPageState`, so the page component is now mostly layout plus field composition instead of mixed view/state/effect logic.
- Removed the dead `reset` export from `useAddConnectionForm` after confirming the renderer no longer consumes it.
- Rechecked Tailwind usage outside renderer components and found no direct style usage outside component/UI files; the only non-component hit is the shared `lib/cn.ts` merge helper.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Claude gateway model cleanup

- Updated the Claude settings writer so applying a non-official API-key gateway clears sticky Claude model selections that can force incompatible upstream model groups on the next request.
- Gateway API-key apply now removes:
  - top-level `model`
  - `ANTHROPIC_DEFAULT_*_MODEL` env overrides
- Preserved unrelated user env/settings entries while still keeping Nile-managed Anthropic auth/base-url fields authoritative.
- Added a Claude settings-store regression test covering the gateway case where an old `claude-opus-4-6` selection and `ANTHROPIC_DEFAULT_SONNET_MODEL` would otherwise survive a gateway switch.

### Verification

- `npm run test:core -- --run packages/core/src/agents/claude/SettingsStore.test.ts`
- `npm run typecheck`

### OpenClaw missing-config issue wording

- Fixed the OpenClaw local-state path so a missing `~/.openclaw/openclaw.json` no longer surfaces as the misleading schema error:
  - `OpenClaw config does not define agents.defaults.model.primary`
- `OpenClaw` now reports an explicit missing-config issue with the resolved config path when the local file does not exist.
- Added renderer translation coverage so desktop surfaces show:
  - `未找到 OpenClaw 本地配置文件：...`
  instead of implying the user already has a readable config with a missing field.

### Verification

- `npm run test:core -- --run packages/core/src/agents/openclaw/current-state/Detector.test.ts`
- `npm run test:desktop -- --run apps/desktop/src/renderer/shared/Support.test.ts`
- `npm run typecheck`

### Desktop gateway edit-page probe state fix

- Fixed the gateway edit-page support summary so a successful manual `Detect again` result is no longer cleared on the next render when no inline API key override is present.
- Stopped the edit-page gateway summary from showing the empty-state detection copy before any probe has actually been run.
- Kept the existing saved-credential probe path intact; the change is limited to renderer state ownership for:
  - whether a probe has happened
  - whether detected agents should still be shown after a successful manual probe

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop -- --run apps/desktop/src/electron/DesktopConnectionManager.test.ts`

### Gateway configurable agents expansion

- Updated the core gateway preset so `configurableAgents` now maps to the full supported agent set instead of the previous `codex/claude` subset.
- Kept gateway onboarding detection semantics narrower:
  - `suggestedAgents` still reflects what probe detection can currently confirm
  - `configurableAgents` now reflects the product rule that gateway is a general-purpose connection surface
- Updated saved-connection summaries so existing gateway connections also expose the full supported agent set during edit flows instead of being narrowed back down by persisted protocol hints.
- Added regression coverage for:
  - gateway preset definitions exposing the full supported agent list
  - saved gateway connections reporting the full configurable agent set

### Verification

- `npm run test:core -- --run packages/core/src/models/connection/ConnectionCatalog.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### CLI agent selection policy convergence

- Removed the CLI-local `supportsOpenClaw(...)` branch from `ConnectionCommands`.
- Extended `ConnectionAgentPolicy` with CLI-facing selection helpers so prompt-time and validation-time agent availability now come from the shared connection policy layer:
  - `readSelectableAgents(...)`
  - `supportsAgent(...)`
- Updated CLI interactive selection and explicit `--agents/--openclaw-model-id` validation to ask the shared policy instead of maintaining a second copy of gateway/openai/anthropic eligibility rules.

### Verification

- `npm run test:cli -- --run apps/cli/src/NileCli.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Connection agent policy extraction

- Added a shared `ConnectionAgentPolicy` in core so connection agent availability is no longer sourced from ad hoc per-call constants.
- Moved catalog agent defaults behind the policy:
  - `ConnectionCatalog` now stores only preset metadata plus `suggestEnabledAgents`
  - `configurableAgents` and `defaultEnabledAgents` are derived when definitions are read
- Moved onboarding agent availability behind the same policy:
  - `ConnectionOnboardingPolicy` now asks `ConnectionAgentPolicy` for `configurableAgents` and fallback defaults
  - protocol detection still only affects `suggestedAgents`
- Moved saved-connection capability summaries behind the same policy:
  - `SavedConnections` now delegates configurable-agent computation to `ConnectionAgentPolicy`
  - saved gateway connections now stay aligned with the product rule that gateway is configurable for every supported agent
- Exported the shared policy from the connection model index so follow-on call sites can continue converging on one source of truth.

### Verification

- `npm run test:core -- --run packages/core/src/models/connection/ConnectionCatalog.test.ts packages/core/src/models/connection/SavedConnections.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop connection edit capability refresh

- Added an explicit desktop IPC path for re-detecting capability on an existing saved connection:
  - `desktop:describe-saved-connection-onboarding`
  - the probe reuses the currently saved credential when the user has not entered a replacement key
  - env-key backed credentials are resolved to probe credentials before detection
- Updated the edit-connection flow so gateway connections can be re-detected from the edit page without forcing the user to re-save first.
- Added a `重新检测` / `Detect again` action to the edit page footer for gateway connections.
- Updated edit-page capability state to consume refreshed onboarding `configurableAgents` instead of only the saved connection snapshot, so the visible agent list can follow the latest probe result.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Gateway curl guidance

- Replaced the misleading add-connection `Raw response` tab with a concrete `curl` tab.
- The gateway capability panel now generates shell-ready commands from the user’s current endpoint and key input, matching the actual probe routes Nile checks:
  - OpenAI `responses`
  - OpenAI `chat/completions`
  - OpenAI `models`
  - Anthropic bearer `messages`
  - Anthropic `x-api-key` `messages`
- For direct API keys the generated script embeds the current typed key; for env-key mode it references the user’s chosen env var, so the output stays runnable without inventing fake placeholders.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Gateway probe inspection

- Expanded the add-connection capability panel so detection now exposes two extra inspection actions:
  - a persistent `Detect again` action after gateway capability has already been resolved
  - a shadcn `Tabs` view that keeps both the human summary and the raw onboarding response visible to the user
- The capability field now stores the last onboarding payload from detection and renders it as formatted JSON in a dedicated `Raw response` tab.
- Gateway probe failures also retain a structured payload in that same inspector area, so users can compare the visible warning with the raw error object from the latest probe attempt.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Security hygiene hardening

- Marked Claude `settings.json` mutation-history snapshots as sensitive so Claude API key/token values are no longer written to plaintext history snapshot files.
- Sanitized repository fixtures and test constants that previously used realistic-looking personal identifiers and long token literals:
  - replaced personal email strings with generic `@example.com` fixtures
  - replaced internal gateway host fixtures with `gateway.example.test`
  - replaced long Cursor session JWT fixtures with synthetic structurally valid token strings
- Kept runtime behavior unchanged while reducing accidental secret-scanner noise and local privacy leakage from fixtures.

### Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:desktop`

### Dead code cleanup and runtime-local wiring fix

- Removed unused dead file `packages/core/src/runtime-local/History.ts` (`SessionHistory` had no inbound references and was not exported).
- Fixed `NileSession` -> `SessionAgents` construction by passing the required mutation-history accessor callback, restoring strict typecheck consistency after the runtime-local split.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Connections toolbar props compatibility fix

- Fixed a renderer crash in `ConnectionsToolbar` caused by old call sites passing no provider-filter props after the toolbar API expansion.
- Made provider/search props optional with safe defaults so `providers.map(...)` never reads from `undefined`.
- Added `showSearchAndFilter` to support toolbar reuse in agent detail connections where only add/refresh actions are needed.
- Updated `AgentConnectionsSection` to use `showSearchAndFilter={false}` explicitly.

### Verification

- `npm run test:desktop`

### Edit connection provider summary simplification

- Simplified provider info in `ConnectionEditPage` to match the `Add connection` information density.
- Replaced the verbose provider-about card with the same `ProviderSummary` block used in `AddConnectionPage` (summary + official-site text action only).
- Removed the now-unused `ProviderAboutCard` component file to avoid dead renderer code.

### Verification

- `npm run test:desktop`

### Connections toolbar single-row and control sizing

- Kept the `ConnectionsToolbar` controls on one row by removing wrap behavior and letting only the search field flex/shrink while provider filter and action buttons stay fixed-width.
- Unified top-bar control heights to `h-11` for:
  - search input
  - provider filter trigger
  - add connection button
  - refresh button
- Aligned toolbar control styling so the search input and action buttons use matching rounded corners and icon sizing with the provider selector.

### Verification

- `npm run test:desktop`

### Desktop connection edit form stability

- Fixed connection-name edits being overwritten while typing in `ConnectionEditPage`.
- Root cause: `useConnectionEditState` reset local form state on every `connection` object identity change; background desktop state refreshes (`desktop:state-changed`) frequently provide a new object even when the selected connection is unchanged.
- Changed form reset trigger to only run when `connection.id` changes, so user-entered edits persist during background refreshes.

### Verification

- `npm run test:desktop`

### Menubar switch state freshness

- Fixed stale tray checkbox state after connection switching from menubar.
- Changed tray popup flow to refresh menubar state before building and showing the tray menu, instead of showing cached state first and refreshing in the background.
- This removes the "open once more to see correct checkmark" behavior after a switch.

### Verification

- `npm run test:desktop`

### Connections provider filter UX alignment

- Updated Connections table provider rendering to plain text labels (no provider icons inside table cells).
- Switched the provider filter control to reuse the Add Connection combobox pattern:
  - provider icon in options
  - built-in provider search field in dropdown
  - no second-line description in options
- Kept provider filtering semantics unchanged (`endpointFamily`) while aligning visual style with Add Connection.

### Verification

- `npm run test:desktop`

### Connections table provider-first display

- Replaced the Connections table `Auth` column with `Provider`.
- Added provider badges (icon + name) for table rows and mobile cards.
- Changed Connections toolbar filter from auth-mode to provider, with provider icons in the dropdown.
- Kept search behavior intact while shifting filter semantics to `endpointFamily`.

### Verification

- `npm run test:desktop`

### Connection update sync confirmation

- Added an edit-flow confirmation when a saved connection is currently selected by agents and the submitted changes affect runtime behavior (endpoint/auth/enabled agents).
- Added `syncSelectedAgents` to desktop update payloads so renderer intent can be passed through Electron to the connection manager.
- Implemented optional post-update reapply: when `syncSelectedAgents` is true, desktop re-runs `useConnection` for each selected agent on that connection.
- Added test coverage in `DesktopConnectionManager.test.ts` to verify selected agents are re-applied when the sync flag is enabled.

### Verification

- `npm run test:desktop`

### Connections table search and filter

- Added connection search in the desktop Connections toolbar.
- Added auth-mode filtering in the same toolbar (all modes + detected modes in current list).
- Added no-match empty state for filtered results and a one-click "Clear filters" action.
- Kept table/card rendering unchanged by applying filtering in `ConnectionsPage` and passing filtered rows to `ConnectionTable`.

### Verification

- `npm run test:desktop`

### Gateway probe false-positive fix

- Tightened `GatewayProbe` so OpenAI compatibility is no longer inferred from route existence alone.
- Gateway OpenAI support now requires:
  - `/models` to return a usable probe model id
  - `/responses` and `/chat/completions` to succeed semantically before each wire API is marked supported
- Probe model selection now iterates through preferred and fallback OpenAI models instead of assuming the first preferred model is representative.
- This avoids false negatives on gateways where:
  - `gpt-5.4` fails
  - but `gpt-5.3-codex` succeeds on `chat/completions`
- This prevents gateways that expose OpenAI-shaped routes but reject real Codex requests from being auto-suggested for Codex.
- Added targeted coverage in `GatewayProbe.test.ts` for:
  - semantic OpenAI probe failure returning no detected support
  - partial OpenAI support preserving only the passing wire API
  - preferred-model failure with fallback-model success preserving `chat` support

### Verification

- `npm run test:core -- --run packages/core/src/models/connection/GatewayProbe.test.ts packages/core/src/models/connection/ConnectionCreator.test.ts`
- `npm run typecheck`

### Claude gateway beta compatibility

- Confirmed the Claude gateway apply path was still failing after a clean re-apply because Claude Code was sending experimental beta fields and headers that `gateway.example.test` rejects with `invalid beta flag`.
- Updated `ClaudeSettingsStore.applyApiKey(...)` so any non-official `ANTHROPIC_BASE_URL` now also writes:
  - `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`
- Updated the same apply path to pin a Claude exact model ID for third-party gateways when Claude's local `cache/gateway-models.json` has a matching model list for the target base URL.
  - preferred family order: `sonnet` -> `opus` -> `haiku`
  - higher semantic versions win within a family
  - if the current `settings.json` model is already present in the gateway cache, it is preserved instead of being overwritten
- Treated that env var as a managed gateway compatibility setting:
  - it is removed when switching back to official Anthropic/session-based setups
  - it is not preserved across later applies unless the target is still a third-party Anthropic gateway
- Extended Claude settings tests to cover:
  - bearer gateway apply writing the beta-disable env
  - sticky gateway model cleanup still retaining the beta-disable env
  - preferred exact-model pinning from the gateway model cache
  - preserving an already-selected cached gateway model
  - official Anthropic apply dropping any stale gateway beta-disable env

### Verification

- `npm run test:core -- --run packages/core/src/agents/claude/SettingsStore.test.ts`
- `npm run typecheck`

### Desktop renderer live-issue and quota fallback cleanup

- Kept OpenClaw current-state errors in core as raw diagnostics, but translated the known renderer-facing live-issue strings in `renderer/shared/Support.ts` before they are shown in the agent connections alert.
- Added desktop translation catalog entries for the current OpenClaw config failures so Chinese users no longer see the raw English `agents.defaults.model.primary` error in the UI.
- Removed the agent-card quota loading spinner fallback for saved connections with no supported quota source; those cards now render the same `Unknown`/`未知` fallback as the rest of the desktop surface instead of looking like quota is still loading forever.
- Added a focused renderer shared test covering:
  - unknown usage fallback text
  - OpenClaw live-issue translation mapping

### Verification

- `npm run test:desktop -- --run apps/desktop/src/renderer/shared/Support.test.ts apps/desktop/src/UsageSummary.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop capability-section gateway scoping

- Scoped capability detection copy to gateway-only flows in the desktop renderer.
- Non-gateway connection forms still show the enabled/configurable agent list, but they no longer render detection-state copy such as:
  - `Detecting supported agents…`
  - `Detected support: ...`
  - `No compatible agents detected yet.`
- Kept gateway add/edit flows unchanged so capability probing remains visible only where Nile actually performs protocol detection.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop renderer capability de-logicification

- Removed the last `codex`-specific `env_key` gate from the renderer by adding `supportsEnvKey` to shared connection definitions, derived from `ConnectionAgentPolicy` instead of inferred from checkbox lists in `ConnectionFormParts`.
- Added a focused core test for `ConnectionAgentPolicy.supportsEnvKeySource(...)` so API-key env-var support now has one shared rule source for desktop and future surfaces.
- Moved add-page and agent-page connection-definition filtering out of `SettingsApp` and into shared renderer data/support helpers:
  - `useDesktopData.canConfigureAgent(...)`
  - `useDesktopData.readDefinitionsForAgent(...)`
- Collapsed page-local display decisions into hook outputs so `AddConnectionPage` and `ConnectionEditPage` no longer decide their own fallback enabled-agent list inline; they now render `displayedEnabledAgents` from state hooks.
- Centralized preset search keyword shaping in shared support so the add-connection combobox no longer reaches directly into capability arrays from page code.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:core -- --run packages/core/src/models/connection/ConnectionAgentPolicy.test.ts packages/core/src/models/connection/ConnectionCatalog.test.ts`

### Desktop gateway live-state matching fix

- Fixed a false-positive desktop onboarding case where an already saved gateway connection could still show up as `发现新配置` on the agent page.
- Root cause:
  the live-state matcher required endpoint protocols to match exactly, so a saved multi-protocol gateway record (`openai + anthropic`) did not match a Codex live state that can only report the OpenAI side.
- Added subset-compatible endpoint matching for live-state/import detection:
  - exact endpoint matches still win first
  - if no exact match exists, a saved endpoint can now satisfy a live-state candidate when it has the same root/profile and contains the candidate protocol shape as a subset
- Kept this relaxation scoped to import/live-state matching only; connection creation/update endpoint identity rules were not broadened.
- Added regression coverage for:
  - Codex detector matching a saved gateway endpoint that has extra Anthropic protocol metadata
  - Desktop settings state keeping such a gateway out of `detectedSetups.importableCount` and reporting Codex as `synced`

### Verification

- `npm run test:core -- --run packages/core/src/agents/codex/current-state/Detector.test.ts packages/core/src/models/connection/ConnectionCatalog.test.ts packages/core/src/models/connection/ConnectionAgentPolicy.test.ts`
- `npm run test:desktop -- --run apps/desktop/src/DesktopSurface.test.ts`
- `npm run typecheck`

### Desktop connection capability panel rollback

- Reverted the add-connection capability surface from the experimental tabs/curl view back to the simpler single panel:
  - detected support text
  - agent checkbox list
- Removed the temporary curl-generation UI and its translation strings from `ConnectionFormParts` and the desktop i18n table.
- Changed add-connection state to track `configurableAgents` from onboarding results instead of only reading the preset definition:
  - initialize from the selected preset definition
  - expand from `describeConnectionOnboarding(...).configurableAgents` when probing returns more
  - preserve already selected agents when the refreshed configurable set still allows them
- Kept the renderer-side list generic so future backend onboarding expansions can surface newly supported agents without another renderer-only UI change.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop agent icon color restoration

- Restored brand tinting for desktop agent logos by defining the missing renderer `agent-tone-*` classes that the agent card header was already wired to use.
- Extended the same tone treatment to the compact agent icon stack in connection views so the renderer no longer mixes colored agent cards with monochrome list icons.
- Kept the current SVG source assets and used color tinting through `currentColor`, which preserves the existing icon pipeline while making Codex, Cursor, Claude, and OpenClaw visually distinct again.

### Verification

- `npm run build --prefix apps/desktop`

### Gateway add-flow stabilization

- Fixed the add-connection renderer loop that could spam `Maximum update depth exceeded` during capability detection:
  - `useAddConnectionForm` now returns stable setter callbacks instead of recreating them every render
  - the add-page onboarding probe now catches rejected probe requests instead of leaving an unhandled promise path behind
- Stopped failed gateway capability detection from hard-blocking connection creation:
  - the add page now surfaces a non-blocking warning when gateway probing fails
  - users can still continue saving the gateway and manually manage enabled agents
  - the footer now offers both `Add connection` and a retryable `Detect capability` action after a failed probe
- Added an explicit core fallback path for user-approved gateway saves after failed detection:
  - desktop add-connection input now carries an `allowUndetectedGateway` flag only after the user has already seen the failed probe state
  - `ConnectionEndpointBuilder` still probes by default, but when fallback is explicitly allowed it synthesizes a generic gateway protocol from the manually enabled agents instead of throwing
  - this keeps normal validation strict while unblocking the manual-save path the user requested
- Added regression coverage for both layers:
  - core `ConnectionCreator` test for fallback gateway creation
  - desktop connection manager test for saving a gateway when probing returns no detectable protocols

### Verification

- `npm run typecheck`
- `npm run test:desktop -- --run apps/desktop/src/electron/DesktopConnectionManager.test.ts apps/desktop/src/renderer/connections/useAddConnectionForm.test.ts`
- `npm run test:core -- --run packages/core/src/models/connection/ConnectionCreator.test.ts`
- `npm run build --prefix apps/desktop`

### Gateway probe de-duplication

- Stopped the add-connection renderer from re-running `describeConnectionOnboarding(...)` immediately after a successful gateway `Detect capability` click.
- Gateway capability detection now has a single probe entrypoint:
  - manual `prepareGateway()` for the gateway/API-key flow
  - effect-driven auto-probing remains only for non-gateway presets that ever opt into suggested-agent probing
- This removes the duplicate post-success loading pass where the UI already showed detected agents but briefly flipped back to `正在检测支持的 Agent...`.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Desktop add-connection provider summary cleanup

- Moved the provider explainer out of its own large card and into the existing `Choose AI provider` block on the add-connection page.
- Reduced the inline provider details there to just:
  - localized provider summary
  - official site link and action
- Removed the extra add-page-only provider chrome (`About {provider}`, icon header, duplicated provider name) so the selection step stays compact.
- Fixed Chinese desktop `providers` navigation/page copy that was still falling back to English labels like `Providers` / `Provider`.
- Removed the visible official-site URL from the inline provider summary so the add page now keeps only the `Open site` action button.

### Verification

- `npm run typecheck`
- `npm run test:desktop`

### Desktop renderer directory reorganization

- Reorganized `src/renderer` around feature and shell boundaries instead of keeping nearly all renderer files flat under one directory.
- Introduced clear renderer directory groups:
  - `app/` for entrypoints, shell wiring, and app-level hooks
  - `agents/`
  - `connections/`
  - `quick-setup/`
  - `settings/`
  - `providers/`
  - `shared/`
  - existing `ui/` and `lib/`
- Moved renderer files into those groups and updated relative imports so feature-local files now sit beside their closest collaborators instead of relying on a flat filename namespace.
- Updated desktop build/config entry references to match the new source layout:
  - `build.ts`
  - `components.json`
- Kept `globals.d.ts` and `json.d.ts` at the renderer root as ambient declarations rather than forcing them into an artificial single-purpose directory.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer selector and text-action primitives

- Added a shared `ui/choice-card.tsx` primitive for selectable bordered option cards and moved `ConnectionMethodSelector` onto it, so method selection no longer uses page-local raw button styling.
- Added a shared `ui/text-button.tsx` primitive for text-only ghost actions and replaced repeated hand-tuned text-button styling in:
  - `ConnectionTable`
  - `AgentCard`
- This keeps the renderer closer to the desktop AGENTS rule of preferring shared shadcn/open-code controls over page-local control styling, while preserving the existing product copy and interaction behavior.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Agent home path overrides in agent detail

- Added a desktop-side `AgentHomesStore` so per-agent home path overrides are persisted next to the desktop SQLite state and merged into the shared agent home map on startup.
- Exposed a new `updateAgentHome` preload bridge and wired the agent detail page to show an `Agent home` section where users can save a custom local path or reset that agent back to its default home.
- Kept the renderer logic thin by reusing `settingsState.advanced.agentHomes` as the source of truth for the displayed path and letting the main process persist the override and trigger a full desktop refresh after each save.
- Moved `Agent home` into its own detail-page tab and reduced the content to the current path input plus `Save` / `Reset to default path` actions so the page no longer duplicates the same path information in multiple blocks.
- Restored normal spacing between the agent detail tabs and the selected tab content after the new `Agent home` tab initially rendered flush against the content card.

### Verification

- `npm run test:desktop -- --run apps/desktop/src/electron/AgentHomesStore.test.ts apps/desktop/src/renderer/shared/Support.test.ts`
- `npm run test:core -- --run packages/core/src/agents/openclaw/current-state/Detector.test.ts`
- `npm run typecheck`
- `npm run build --prefix apps/desktop`

### Codex gateway direct-key apply fix

- Stopped projecting `env_key` into Codex configs for direct OpenAI-compatible API keys, so gateway and Azure/OpenAI direct-key applies now rely on `auth.json` instead of forcing Codex CLI to find `OPENAI_API_KEY` in the shell environment.
- Kept explicit env-backed credentials unchanged: if the saved connection really uses an existing env var, Nile still writes that env key into the Codex provider block.
- Added focused regression coverage for:
  - Codex gateway direct-key apply
  - Azure direct-key apply
  - Codex projection preserving explicit env-key credentials

### Verification

- `npm run test:core -- --run packages/core/src/agents/codex/apply/ApplySelection.test.ts packages/core/src/projection/Resolver.test.ts`
- `npm run typecheck`

### Desktop renderer usage-panel convergence

- Added a shared `UsagePanel` renderer component so usage/quota presentation no longer has parallel implementations in:
  - `ConnectionQuotaSection`
  - `AgentCard`
- Kept the shared panel flexible enough for the current desktop surfaces:
  - framed vs unframed usage blocks
  - loading state
  - optional plan label
  - optional renewal timestamp display
  - window count limits
- Switched `ConnectionTable` detail-entry controls from raw styled `<button>` elements to the shared `ui/button` primitive with ghost styling, keeping those table interactions on the same shadcn/open-code path as the rest of the renderer.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer shared display primitives

- Added a shared `ui/field.tsx` display primitive for the repeated renderer pattern of:
  - uppercase muted label
  - simple text or inline content value
- Replaced page-local field render helpers with the shared primitive in:
  - `ConnectionTable`
  - `AgentConnectionsSection`
  - `ConnectionDetailPage`
- Replaced the custom connection-in-use pill markup in `ConnectionDetailPage` with the shared `ui/badge` component.
- Reworked `NileDialog` info sections onto `ui/card` primitives so the dialog content uses the same open-code surface building blocks as the rest of the renderer instead of hand-rolled bordered sections.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer shadcn convergence

- Reworked `SettingsPage` around a focused `SettingsSection` component so the settings surface now reuses one consistent section/list layout instead of repeating page-local section markup three times.
- Replaced the raw connections empty-state box in `ConnectionsPage` with the existing open-code `ui/empty` primitives plus a standard shadcn-style `Button`, keeping the page on the shared renderer component path instead of bespoke empty-state markup.
- Kept the settings surface aligned with the desktop AGENTS guidance:
  - section/list treatment over decorative cards
  - shadcn/open-code controls for interaction primitives
  - page components biased toward composition rather than ad hoc visual structure

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`

### Desktop renderer detail-page cleanup

- Split `ConnectionEditPage` state orchestration into `useConnectionEditState` so edit-page rendering no longer owns:
  - gateway support probing
  - auth-json picker lifecycle
  - auth payload assembly
  - submit in-flight state
- Split `AgentDetailPage` into focused section components:
  - `AgentConnectionsSection`
  - `AgentHistorySection`
- Moved agent connection switch/highlight state down from the whole detail page into the connections section, keeping that transient UI state beside the list that actually uses it.
- Reduced remaining renderer hotspots:
  - `apps/desktop/src/renderer/ConnectionEditPage.tsx` -> 254 lines
  - `apps/desktop/src/renderer/AgentDetailPage.tsx` -> 96 lines
- Rechecked renderer Tailwind usage outside component files and again found no direct style usage outside component/UI files; `lib/cn.ts` remains the only non-component utility hit.

### Verification

- `npm run typecheck`
- `npm run build --prefix apps/desktop`
- `npm run test:desktop`
