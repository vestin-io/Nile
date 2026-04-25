# Usage V1 Build Log

## 2026-04-29

### Step 1: Core Usage Action

- Added `packages/core/src/actions/usage/` with a shared `Usage` action and normalized result types.
- Implemented the first provider-backed reader for `openai/openai_session` connections via ChatGPT `wham/usage`.
- Kept unsupported provider families explicit instead of faking empty usage.

### Step 2: CLI Usage Command

- Added `nile usage <connectionId>` as an explicit on-demand lookup.
- Kept CLI usage query single-shot only. No polling or background refresh.
- Added presenter formatting for plan and quota windows.

### Step 3: Claude Session Usage

- Added `claude_session` as a first-class stored credential and auth mode in core.
- Wired Claude current-state reading to live `~/.claude/.credentials.json` plus `settings.json.oauthAccount`.
- Implemented Anthropic OAuth usage lookup via `GET https://api.anthropic.com/api/oauth/usage`.
- Kept the usage result normalized into the same connection-scoped window contract as Codex.
- Did not add local transcript-derived Claude analytics in this step.
