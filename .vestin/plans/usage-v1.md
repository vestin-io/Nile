# Usage V1

## Goal

Add a shared core capability to answer:

- what is the current usage state for a saved connection?

This should be a core concern. CLI and desktop should consume it, not implement it.

## Why It Belongs In Core

- Usage is about a saved connection, not about one surface.
- The same connection can be shown in CLI and desktop.
- Retrieval rules depend on provider credentials and agent-specific local state.
- Surfaces should not duplicate:
  - provider usage fetch logic
  - local session parsing
  - normalization rules

## V1 Scope

V1 should support official usage or quota retrieval only.

In:

- connection-scoped usage lookup in `packages/core`
- normalized usage result shape
- Codex official usage support where feasible
- Claude official usage support where feasible
- "unsupported" result for connections that do not yet have a usage path

Out:

- local transcript-derived token analytics
- cost estimation
- historical charts
- background polling
- Cursor usage support without a real derivation path
- cloud-backed usage state

## Product Shape

The question Nile answers in V1 is:

- for this saved connection, what is the current usage state right now?

Not:

- how much did this machine use today?
- which agent window is currently busiest?
- what was usage over time?

## Core Boundary

This should land as a shared action-oriented core capability, alongside the existing top-level actions.

Expected direction:

- `packages/core/src/actions/usage/`

The action should:

- accept a connection id
- resolve the provider and binding behind that connection
- choose a usage reader based on provider family and auth mode
- return a normalized result

## Normalized Result

V1 should stay small, but it cannot collapse everything to one `used/remaining` pair.

Real provider responses already show multiple windows and, in some cases, multiple quota buckets.

Expected top-level fields:

- `connectionId`
- `connectionLabel`
- `providerLabel`
- `status`
  - `available`
  - `unavailable`
  - `unsupported`
  - `error`
- `source`
  - `provider_api`
  - `local_artifact`
- `planLabel?`
- `message?`
- `windows`

Expected window shape:

- `kind`
  - `primary`
  - `secondary`
  - `additional`
- `label`
- `usedPercent?`
- `remainingPercent?`
- `windowSeconds?`
- `resetsAt?`
- `allowed?`
- `limitReached?`
- `featureName?`

This lets Nile support:

- a simple CLI summary line
- richer desktop rendering
- provider responses with more than one window

without hardcoding one universal `remaining` number.

## Provider Direction

### Codex

First choice:

- official quota retrieval from ChatGPT `wham/usage`

Why:

- strongest and most consistent reference path
- more reliable than local rollout parsing for a first version

Observed payload shape from a real local probe:

- `plan_type`
- `rate_limit.primary_window`
- `rate_limit.secondary_window`
- optional `additional_rate_limits[]`
- each window carries:
  - `used_percent`
  - `limit_window_seconds`
  - `reset_after_seconds`
  - `reset_at`

This means Codex usage is naturally a multi-window result, not one scalar balance.

### Claude

First choice:

- official usage retrieval from Anthropic OAuth usage API

Why:

- strongest and most consistent reference path
- avoids fragile log parsing in V1

Credential path in Nile:

- support Claude usage only for `anthropic/claude_session`
- derive the live session from:
  - `~/.claude/.credentials.json`
  - `~/.claude/settings.json` `oauthAccount`
- keep plain `anthropic/api_key` connections out of quota-style usage until Nile has a clearly different API-key usage contract

### Cursor

V1 direction:

- return `unsupported`

Why:

- current research does not show a strong usage derivation path

## Architecture Rules

- Usage must remain explicit and read-only.
- Usage lookup must not mutate connection state.
- Usage code must not live in Electron or CLI.
- Provider-specific fetchers should stay behind small core collaborators.
- Agent adapters should only be involved when local artifact reading is required.

## Likely Module Shape

- `actions/usage/Usage.ts`
  - main entrypoint
- `actions/usage/Result.ts`
  - normalized result types
- `actions/usage/readers/`
  - provider-specific readers when a second reader appears

Keep this minimal. Do not build a framework before the second real provider path exists.

## Surface Expectations

CLI may later show:

- usage for the current connection
- usage for a named connection

CLI should query once per invocation. No polling.

Default CLI rendering should stay connection-first, for example:

- connection label
- plan label
- primary window remaining percent and reset
- secondary window remaining percent and reset
- optional note when extra buckets exist

Example shape:

- `cursor.user@example.com`
- `Plan: Pro Lite`
- `5h: 93% left, resets in 3h 13m`
- `7d: 94% left, resets in 6d 8h`
- `Extra limits: GPT-5.3-Codex-Spark`

Desktop may later show:

- current usage in `Current Agent`
- connection usage in `Connections`

Neither surface should own retrieval rules.

## Future V2

Only after V1 is stable:

- local transcript-derived analytics
- per-agent local usage views
- richer provider-specific breakdowns
- background refresh
- usage history

## Current Decision

- Nile should support a basic usage capability.
- The capability is connection-scoped.
- The capability belongs in shared core.
- V1 should prefer official provider usage APIs over local log analytics.
- CLI should support usage lookup, but as an on-demand single fetch per command.
