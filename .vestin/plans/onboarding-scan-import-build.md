# Onboarding Scan + Import Build Log

## 2026-04-29

### Step 1: Unified CLI Entry On Shared Scan Flow

- Added shared core `scan-local` actions under `packages/core/src/actions/scan-local/`:
  - `ScanLocalSetups`
  - `ImportDetectedSetups`
- Kept first-version scan state deliberately small:
  - `new`
  - `already_saved`
  - `invalid`
  - `unsupported`
  - `unavailable`
- Exposed the scan/import actions through `NileSession` so surfaces do not bypass the action-oriented core shape.
- Updated CLI `ManageConnectionsFlow` to stop treating `new_connection_detected` as a separate import path.
- Replaced the old per-agent `Save current Codex setup` entry with one unified interactive entry:
  - `Import detected local setups`
- Kept the old lightweight behavior when only one importable setup exists:
  - selecting the unified entry imports it directly
- Added the multi-select prompt capability needed for the later multi-item path, while keeping current first-run behavior simple.

### Step 2: Filter Interactive Agent Choices By Compatibility

- Fixed the CLI `Change <Agent> connection` picker so it no longer lists saved connections that the selected agent cannot apply.
- Added a core `listForAgent(agentId)` path on saved connections so compatibility filtering stays in shared core instead of being reimplemented in the CLI surface.
- Updated the interactive connection selection flow to use the agent-filtered list for status management while keeping the generic remove flow on the full saved-connection list.
- Added a regression test that seeds both Codex and Cursor connections and verifies the Codex picker hides the Cursor-only connection.
