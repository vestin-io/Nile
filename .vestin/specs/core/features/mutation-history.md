# Mutation History

Mutation history tracks Nile-originated local changes.

It owns:

- the persisted mutation timeline
- rollback snapshots for files Nile changes
- latest-mutation rollback support

Rules:

- only Nile-originated mutations are recorded
- history writes must stay consistent with snapshot writes
- rollback restores local state for one agent only
