# Usage

Usage is the shared core capability for reading connection-scoped usage state.

It owns:

- normalized usage result shapes
- connection-specific usage reader dispatch
- connection-scoped cached usage state when a provider needs it
- connection-scoped usage bindings when a provider needs extra verified auth

It does not own:

- agent apply state
- renderer presentation
- browser automation

## Requirements

### Shared Core Rules

- Nile MUST keep usage lookup read-only with respect to saved connection selection and apply state.
- Nile MUST keep usage rules in shared core, not in CLI or desktop.
- Nile MUST let one connection remain usable even when usage is unavailable.

### Cursor Usage Rules

- Nile MUST treat local Cursor connection auth and Cursor web usage auth as separate concerns.
- Nile MUST store sensitive Cursor web-session material only in credential storage.
- Nile MUST store only non-sensitive Cursor usage metadata and snapshots in SQLite.
- Nile MUST verify that a Cursor web usage binding matches the saved Cursor connection identity before using it for live refresh.
- Nile MUST keep the last successful Cursor usage snapshot even when live refresh later fails.
- Nile MUST clear an invalid Cursor usage binding when live refresh returns `401` or when identity verification fails.
- Nile SHOULD return cached Cursor usage when a live refresh is unavailable but a prior snapshot exists.

### Result Shape Rules

- Nile MUST return a normalized usage result for every supported connection lookup.
- Nile MUST distinguish connection availability from usage freshness.
- Nile SHOULD expose usage freshness so surfaces can tell `live`, `cached`, or `stale` usage apart.

## Verification

- Unit test Cursor usage identity matching for:
  - matching local and web identities
  - mismatched local and web identities
- Unit test Cursor usage snapshot reads for:
  - no snapshot
  - cached snapshot present
  - snapshot update after successful refresh
- Unit test Cursor usage binding invalidation for:
  - `401` from the upstream endpoint
  - identity mismatch
- Unit test shared usage dispatch so Cursor usage remains a shared `core` action.
- Manual verification in CLI and desktop:
  - a saved Cursor connection can still be selected when usage is unavailable
  - cached usage remains visible after switching away and back

## Data Model Impact

This feature introduces two usage-specific connection-scoped records:

- `CursorUsageBinding`
- `CursorUsageSnapshot`

`CursorUsageBinding` stores:

- saved connection identity
- verified account fingerprint
- credential reference
- verification timestamps

`CursorUsageSnapshot` stores:

- last known usage percentages
- billing window bounds
- fetched time
- freshness state

These records are adjunct usage state.
They must not replace `Endpoint` or `Access` as the saved connection model.

## Failure And Edge Cases

- If no valid Cursor usage binding exists, Nile returns `unavailable` or `cached` and does not block connection use.
- If a web session token expires, Nile clears the binding and keeps the last snapshot.
- If the browser account drifts from the local Cursor connection account, Nile clears the binding and marks cached data stale.
- If the upstream endpoint shape changes, Nile degrades to cached or unavailable without changing saved connection state.
