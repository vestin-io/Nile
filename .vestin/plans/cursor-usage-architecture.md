# Cursor Usage Architecture

Date: 2026-05-01

## Goal

Add best-effort personal Cursor usage support without breaking the current `endpoint + access` architecture.

The feature must answer:

- for this saved Cursor connection, what usage can Nile safely show right now?

The feature must not change what a saved connection is.

## Design Summary

Cursor usage should be modeled as two connection-scoped core concerns that sit beside `Access`, not inside it:

- `CursorUsageBinding`
- `CursorUsageSnapshot`

`Access` continues to represent how Nile applies or imports a Cursor connection.
Cursor usage adds an optional, identity-gated web session capability for that connection.

## Why This Shape Fits The Current Architecture

The current core model is:

- `Endpoint`
- `Access`
- agent `Selection`
- `MutationHistory`

Cursor personal usage is not part of:

- endpoint capability
- local Cursor apply behavior
- local Cursor session credential shape

It is an auxiliary read capability that depends on:

- one saved Cursor connection
- one matching web session
- one cached usage snapshot

This means the feature belongs in shared core usage orchestration, but it should not mutate the `Access` entity into a larger account record.

## New Core Concepts

### CursorUsageBinding

Represents a verified link between one saved Cursor connection and one web session capable of reading `/api/usage-summary`.

Owns:

- `connectionId`
- `accountFingerprint`
- `credentialSource`
- `observedAt`
- `lastVerifiedAt`

Rules:

- sensitive web session material stays in credential storage only
- SQLite stores only metadata and the credential reference
- a binding is valid only when the web identity matches the local Cursor connection identity

### CursorUsageSnapshot

Represents the last successfully read usage result for one saved Cursor connection.

Owns:

- `connectionId`
- `accountFingerprint`
- `totalPercentUsed`
- `autoPercentUsed`
- `apiPercentUsed`
- `billingCycleStart`
- `billingCycleEnd`
- `fetchedAt`
- `freshness`

`freshness` values:

- `live`
- `cached`
- `stale`
- `expired`

Rules:

- snapshots are non-sensitive and may live in SQLite
- snapshots are keyed to one saved connection identity
- snapshots may outlive the current live Cursor login

## Identity Model

The feature must treat account correctness as the primary risk.

Two identity sources exist:

- local Cursor connection identity
- browser/web session identity

The local identity comes from existing Cursor current-state data:

- `authInfo.authId`
- derived `user_<workos_id>`
- optional `email`

The web identity comes from the web session token payload or a trusted session-derived identity probe.

The binding must only be accepted when both sides resolve to the same account fingerprint.

## Module Boundaries

### Core

Own:

- connection-scoped Cursor usage binding persistence
- connection-scoped usage snapshot persistence
- identity matching rules
- live usage refresh orchestration
- result normalization into shared usage read models

Do not own:

- browser automation
- renderer state
- Electron-only token capture

### Cursor Adapter

Own:

- local Cursor identity derivation already available through current-state reads

Do not own:

- web session binding persistence
- `/api/usage-summary` fetching
- usage snapshot rules

### Surfaces

Own:

- explicit user flows to bind or refresh Cursor web usage
- usage presentation states such as `live`, `cached`, `stale`, or `unavailable`

Do not own:

- account matching rules
- snapshot storage rules
- live refresh policy

## Proposed Core Module Shape

```text
packages/core/src/actions/usage/
  Usage.ts
  Result.ts
  cursor/
    BindingRegistry.ts
    SnapshotStore.ts
    Identity.ts
    Reader.ts
```

### Usage.ts

Keeps the existing shared entrypoint.

Adds Cursor-specific routing:

- resolve saved connection
- if Cursor-compatible, delegate to `cursor/Reader`

### cursor/BindingRegistry.ts

Owns metadata reads and writes for `CursorUsageBinding`.

Responsibilities:

- create binding metadata
- read binding metadata
- clear invalid binding metadata
- read and update bound web-session credentials through the credential store

### cursor/SnapshotStore.ts

Owns SQLite persistence for `CursorUsageSnapshot`.

Responsibilities:

- read latest snapshot for one connection
- upsert latest snapshot for one connection
- mark snapshot freshness transitions

### cursor/Identity.ts

Owns account fingerprint derivation.

Responsibilities:

- derive local Cursor account fingerprint from saved or live connection state
- derive web account fingerprint from bound web session identity
- compare for exact match

### cursor/Reader.ts

Owns runtime usage resolution.

Responsibilities:

- return cached snapshot immediately when present
- refresh live usage only when a valid binding exists
- update snapshot on success
- clear binding on `401` or identity mismatch
- degrade to `cached` or `unavailable` without affecting connection usability

## Runtime Flow

### Binding Flow

1. Surface asks core to bind Cursor usage for one saved connection.
2. Core resolves the saved access and derives the local account fingerprint.
3. Core resolves the supplied web session identity.
4. Core verifies the identities match.
5. Core stores:
   - sensitive token in credential storage
   - binding metadata in SQLite
6. Core may optionally perform an immediate refresh and seed the first snapshot.

### Read Usage Flow

1. Surface asks `getConnectionUsage(connectionId)`.
2. Core routes Cursor connections to `cursor/Reader`.
3. Reader loads the latest snapshot, if any.
4. Reader loads the usage binding, if any.
5. If no binding exists:
   - return `cached` when a snapshot exists
   - otherwise return `unavailable`
6. If binding exists:
   - validate identity
   - call `/api/usage-summary`
7. On success:
   - update snapshot
   - return `live`
8. On `401` or identity mismatch:
   - clear binding
   - retain snapshot
   - return `stale` or `unavailable`

## Shared Result Shape Changes

The current usage result is too small for Cursor's real states.

Add:

- `freshness?: "live" | "cached" | "stale" | "expired"`
- `lastFetchedAt?: string`

Keep:

- `status`
- `message`
- `windows`

Rules:

- `status` answers whether Nile can present usage at all
- `freshness` answers whether the result is current or cached

This keeps OpenAI and Claude compatible while giving Cursor a truthful state model.

## Surface Contract

CLI and desktop should present Cursor usage as a best-effort extension, not as part of connection validity.

Expected states:

- `live`
  - usage is current
- `cached`
  - last known usage is shown
- `stale`
  - cached data exists but live refresh failed or binding drifted
- `unavailable`
  - no usable binding or snapshot exists

The connection itself remains selectable for Cursor regardless of usage state.

## Non-Goals

This design does not include:

- automatic browser token harvesting
- background polling
- usage history charts
- team or org Cursor billing support
- web-session reuse across different saved connections without identity verification

## Risks

### Unofficial Endpoint Risk

`/api/usage-summary` is not a documented public API.

Mitigation:

- keep the feature best-effort
- degrade to cached or unavailable
- keep the integration isolated to one Cursor usage reader

### Identity Drift Risk

The browser account can drift away from the local Cursor connection account.

Mitigation:

- require identity-gated binding
- clear binding on mismatch

### Token Rotation Risk

The web session token can expire or rotate.

Mitigation:

- keep snapshots separate from bindings
- do not lose last-known usage when binding fails

## Implementation Order

1. extend shared usage result shape
2. add Cursor usage binding persistence
3. add Cursor usage snapshot persistence
4. add Cursor usage reader and identity matcher
5. add explicit bind flow in CLI and desktop
6. add `live/cached/stale/unavailable` rendering
