# Usage Derivation Research

Date: 2026-04-29

This note reviews how local reference repos derive account usage, quota, or rate-limit state. The goal is to separate true usage retrieval from looser account or activity inference.

## Scope

- [codex-auth-switching-research.md](/Users/jiatwork/Works/nile/docs/codex-auth-switching-research.md)
- [multi-client-auth-switching-research.md](/Users/jiatwork/Works/nile/docs/multi-client-auth-switching-research.md)
- [claude-switch-projects-research.md](/Users/jiatwork/Works/nile/docs/claude-switch-projects-research.md)
- `research/cursor-auth.md`
- Repos under `research/`:
  - `codex-auth`
  - `codex-switcher`
  - `codex-switch`
  - `claude-swap`
  - `claude-switcher-tray`
  - `claude-code-switch`
  - `ccs`
  - `cc-switch`

## Summary

- There are two materially different patterns:
  - true usage or quota retrieval from provider APIs or local session artifacts
  - account, plan, or rate-limit inference without real usage computation
- Codex quota retrieval is consistently tied to ChatGPT `GET /backend-api/wham/usage` when references use an API-backed path.
- Claude quota retrieval is consistently tied to `GET https://api.anthropic.com/api/oauth/usage` when references use an API-backed path.
- `codex-auth` and `cc-switch` are the strongest references for local-artifact-derived usage.
- `claude-switcher-tray`, `claude-code-switch`, and `cursor-auth.md` do not show a strong real-usage derivation path.

## Repo Notes

### codex-switcher

- State sources:
  - `~/.codex-switcher/accounts.json`
  - live `~/.codex/auth.json`
- Active account detection:
  - stored `active_account_id` in its own account store
- Usage source:
  - calls ChatGPT `wham/usage`
  - refreshes OAuth tokens if needed
  - warms up Codex via `/backend-api/codex/responses`
- Conclusion:
  - true quota retrieval from API
  - no local transcript-derived usage math

### codex-switch

- State sources:
  - `~/.codex-switch/profiles/*/auth.json`
  - `~/.codex-switch/current`
  - live `~/.codex/auth.json`
  - `~/.codex-switch/cache.json`
- Active account detection:
  - `current` marker
  - live-auth hash or identity matching
- Usage source:
  - calls ChatGPT `wham/usage`
  - caches windows and credits locally
  - refreshes tokens on auth failure or near expiry
- Conclusion:
  - true quota retrieval from API
  - local cache is only a cache, not an independent analytics source

### codex-auth

- State sources:
  - `<codex_home>/accounts/*.auth.json`
  - `<codex_home>/accounts/registry.json`
  - live `<codex_home>/auth.json`
  - newest `~/.codex/sessions/**/rollout-*.jsonl`
- Active account detection:
  - registry `active_account_key`
  - activation timestamp
- Usage source:
  - prefers local rollout `token_count` events with `rate_limits`
  - falls back to ChatGPT `wham/usage`
  - ignores rollout events older than current account activation
- Conclusion:
  - strongest Codex example of local-artifact-derived usage
  - hybrid model: local session artifacts first, API fallback second

### claude-swap

- State sources:
  - live `~/.claude/.credentials.json`
  - live config `oauthAccount`
  - backup tree `~/.claude-swap-backup/...`
  - process-detection reads `~/.claude/sessions/*.json` and `~/.claude/ide/*.lock`
- Active account detection:
  - composite identity `(email, organizationUuid)`
- Usage source:
  - calls Anthropic OAuth usage API
  - refreshes inactive accounts only
  - caches list output in backup cache
- Conclusion:
  - true quota retrieval from API
  - session files are used for process detection, not usage analytics

### claude-switcher-tray

- State sources:
  - `~/.claude/accounts/*.json`
  - live `~/.claude/.credentials.json`
  - `~/.claude/claude-switcher.json`
  - log trees under `~/.claude` and app-local Claude dirs
- Active account detection:
  - `claude auth status` first
  - fallback to `refreshToken` match
- Usage source:
  - org and subscription from `claude auth status`
  - "rate limited" inferred by scanning logs for strings like `429`, `rate limit`, `quota exceeded`
- Conclusion:
  - not a true quota tool
  - mostly account and rate-limit inference

### claude-code-switch

- State sources:
  - `~/.ccm_accounts`
  - live Keychain or `~/.claude/.credentials.json`
  - `~/.claude/settings.json`
  - `.claude/settings.local.json`
- Active account detection:
  - compares saved credentials to current live credentials
- Usage source:
  - exposes subscription type and token expiry from saved JSON
  - no strong quota fetcher in the switch flow
- Conclusion:
  - account and provider inference only
  - not real usage derivation

### ccs

- State sources:
  - `~/.ccs/cliproxy/accounts.json`
  - `~/.ccs/cliproxy/auth/`
  - `~/.ccs/cliproxy/auth-paused/`
- Active account detection:
  - registry-driven account IDs
  - quota fetchers do not infer a live app-selected account
- Usage source:
  - provider-specific fetchers:
    - Codex `wham/usage`
    - Claude OAuth usage API
    - Copilot daemon `GET /usage`
    - GHCP `GET /copilot_internal/user`
    - Gemini quota endpoints
- Conclusion:
  - true quota retrieval from upstream APIs and daemon responses
  - mostly no transcript parsing in this path

### cc-switch

- State sources:
  - live CLI credentials for official quota lookups
  - local analytics scans:
    - `~/.claude/projects/*/*.jsonl`
    - `~/.codex/sessions/YYYY/MM/DD/*.jsonl`
    - `~/.codex/archived_sessions/*.jsonl`
    - `~/.gemini/tmp/*/chats/session-*.json`
- Active account detection:
  - depends on currently read live credential store or selected app/provider
  - tray cache is in-memory only
- Usage source:
  - official quota APIs for Claude, Codex, Gemini
  - local transcript and session parsing for token and cost analytics
  - supports user-defined JS usage scripts
- Conclusion:
  - broadest mixed implementation in this survey
  - combines real official quota with locally computed usage analytics

### cursor-auth.md

- State sources:
  - Cursor desktop SQLite and storage
  - CLI auth in macOS Keychain and `~/.cursor/cli-config.json`
- Usage source:
  - none identified
- Conclusion:
  - auth-surface note only
  - no concrete usage derivation path

## Practical Takeaways

- If Nile wants true remaining quota, the reference pattern is provider API retrieval.
- If Nile wants local usage analytics without depending on provider APIs, the strongest references are:
  - `codex-auth`
  - `cc-switch`
- Codex local analytics are most plausibly derived from:
  - `~/.codex/sessions/**/rollout-*.jsonl`
  - `token_count` and `rate_limits` events
- Claude local analytics are most plausibly derived from:
  - `~/.claude/projects/*/*.jsonl`
  - assistant `usage` blocks
- Cursor does not yet have a strong usage derivation reference in the current research set.

## Bottom Line

- Real quota or usage retrieval:
  - `codex-switcher`
  - `codex-switch`
  - `codex-auth`
  - `claude-swap`
  - `ccs`
  - `cc-switch`
- Local transcript-derived usage:
  - `codex-auth`
  - `cc-switch`
- Account or rate-limit inference only:
  - `claude-switcher-tray`
  - `claude-code-switch`
  - `cursor-auth.md`

## Nile Direction

- Nile should treat usage as a connection-scoped capability:
  - "what is the current usage of this connection?"
  - not "what is the current usage of this app window?"
- This belongs in shared core, not in CLI or desktop:
  - surfaces should only render usage state
  - usage retrieval and normalization should stay in `packages/core`
- Nile should keep two usage concepts separate:
  - official quota or remaining-usage state from provider APIs
  - local transcript-derived usage analytics from agent session files
- For a first version, the most realistic path is:
  - Codex: support official quota retrieval first
  - Claude: support official quota retrieval first
  - Cursor: no usage capability until a concrete derivation path exists
- If Nile later adds local analytics, the best reference direction is:
  - Codex: `codex-auth` and `cc-switch`
  - Claude: `cc-switch`

## Local Probe Notes

Using existing local Nile connections and stored credentials, a read-only probe against ChatGPT `wham/usage` returned real payloads for saved `openai_session` connections.

Observed fields included:

- `plan_type`
- `rate_limit.allowed`
- `rate_limit.limit_reached`
- `rate_limit.primary_window`
- `rate_limit.secondary_window`
- optional `additional_rate_limits[]`
- `credits`
- `spend_control`

Observed window fields included:

- `used_percent`
- `limit_window_seconds`
- `reset_after_seconds`
- `reset_at`

Practical implication:

- Nile should not model usage as one universal scalar.
- For Codex-style usage, the stable shared shape needs:
  - plan label
  - multiple windows
  - optional extra quota buckets
