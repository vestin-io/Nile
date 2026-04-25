# Cursor Usage Investigation

Date: 2026-05-01

## Goal

Investigate whether Cursor personal usage can be read for each local connection, whether the data source is stable, and whether usage can remain available after switching connections.

## Scope

This investigation focused on:

- local Cursor identity and credential shape
- Cursor CLI and app behavior around `status`, `about`, and `/usage`
- the web endpoint `https://cursor.com/api/usage-summary`
- whether web session identity can be matched to a local Cursor connection
- whether a previously matched session can be persisted for later usage refreshes

## Key Findings

### 1. Local Cursor identity is available

Local Cursor state exposes a stable per-account identity:

- `authInfo.email`
- `authInfo.userId`
- `authInfo.authId`
- `serverConfigCache.authCacheKey`

Observed local identity shape:

- `authInfo.authId`: `auth0|user_<workos_id>`
- `serverConfigCache.authCacheKey`: `auth:auth0|user_<workos_id>`

The local token payload also matches this identity:

- JWT `sub`: `auth0|user_<workos_id>`
- JWT `aud`: `https://cursor.com`
- JWT `type`: `session`

Conclusion:

- local Cursor identity is internally self-consistent
- a `user_<workos_id>` can be derived from local state

### 2. `agent status` and `agent about` do not provide spend/usage details

Confirmed behavior:

- `agent status --format json` returns authentication state and user info
- `agent about --format json` returns CLI version, current model, subscription tier, and environment info

They do not return:

- usage percentages
- spend values
- plan usage breakdowns

### 3. CLI `/usage` is not plan/spend usage

Interactive `/usage` opens a local pager showing:

- `Agent Edits`
- accepted lines over the last 12 months
- streaks
- a link to `https://cursor.com/dashboard?tab=analytics`

Conclusion:

- CLI `/usage` is edit analytics
- it is not the source of plan quota or spend data

### 4. The spending page uses `https://cursor.com/api/usage-summary`

Runtime evidence shows:

- spending page referer: `https://cursor.com/dashboard/spending?...`
- same-origin request path: `/api/usage-summary`

The response contains plan usage fields such as:

- `individualUsage.plan.totalPercentUsed`
- `individualUsage.plan.autoPercentUsed`
- `individualUsage.plan.apiPercentUsed`
- `billingCycleStart`
- `billingCycleEnd`

These values matched the spending UI:

- `Total`
- `Auto + Composer`
- `API`

Conclusion:

- the spending card is backed at least in part by `/api/usage-summary`

### 5. `/api/usage-summary` depends on web session auth, not local CLI auth

Observed behavior:

- `Authorization: Bearer <local cursor token>` returned `401`
- a cookie-based request with `WorkosCursorSessionToken` succeeded

Conclusion:

- local Cursor auth is not sufficient by itself
- the endpoint is tied to web session state

### 6. Local identity and web session identity can be matched, but are not the same token shape

The local account and web session can be correlated through:

- local `authInfo.authId`
- local JWT `sub`
- derived `user_<workos_id>`

However, the token shapes differ:

- local token payload looked like `type: "session"`
- previously observed web cookie payload looked like `type: "web"` and included `workosSessionId`

Conclusion:

- identity can match
- token form does not necessarily match byte-for-byte
- a current browser session cannot be assumed to always match the current local Cursor connection

## Main Product Risk

The hard problem is not fetching usage. The hard problem is account correctness.

Possible mismatch scenario:

- local Cursor connection is account A
- browser `cursor.com` session is still account B
- `/api/usage-summary` returns B's usage

This can happen without explicit logout if the browser session has not changed.

Conclusion:

- personal Cursor usage should not be shown unless web session identity is validated against the local connection

## Recommended Approach

Treat this as an experimental integration.

### Identity-gated usage binding

When a usable web session is available:

1. derive the local account fingerprint from:
   - `authInfo.authId`
   - derived `user_<workos_id>`
   - optional `email`
2. derive the web session identity from the cookie/JWT
3. only bind the session to a connection if the identities match

### Persist two separate things

Persist a usage snapshot:

- `totalPercentUsed`
- `autoPercentUsed`
- `apiPercentUsed`
- `billingCycleStart`
- `billingCycleEnd`
- `fetchedAt`
- snapshot status such as `live`, `cached`, or `expired`

Persist a web session reference:

- store the sensitive token only in system credential storage
- store non-sensitive metadata in app state:
  - `connectionId`
  - `accountFingerprint`
  - `credentialKey`
  - `observedAt`
  - `lastVerifiedAt`

### Runtime behavior

For a previously matched connection:

- show the last successful cached snapshot immediately
- attempt a background refresh only if a bound web session still exists
- if refresh returns `401` or identity mismatch, clear the session binding and mark cached data stale

## Why this helps with connection switching

If session binding and snapshots are stored per connection:

- switching away from a connection does not lose the last known usage state
- switching back can show cached data immediately
- live refresh remains possible when the bound session is still valid

This is the only practical path if the product wants to keep showing usage for previously used Cursor connections.

## Constraints

- `WorkosCursorSessionToken` is a web session and can expire or rotate
- the endpoint is not a documented public API for personal usage
- the local Cursor login and browser login are different auth surfaces
- the browser account can drift from the local connection account
- this should not be treated as a guaranteed production contract

## Recommendation

Proceed only if the feature is clearly marked as best-effort:

- use identity-gated session binding
- persist usage snapshots per connection
- store sensitive session data only in credential storage
- degrade gracefully to cached or unavailable state
- never assume the current browser session belongs to the current local Cursor connection without verification
