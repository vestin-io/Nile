# Workspace State

Workspace state is the saved-state side of Nile.

It owns:

- endpoint records
- access records
- saved connection views derived from endpoint plus access records
- last-applied selection records

Rules:

- saved workspace state is not the same as live agent state
- secrets stay in the credential store
- SQLite stores only metadata and credential references
- connection creation must reuse or refresh existing endpoint and access records when possible
