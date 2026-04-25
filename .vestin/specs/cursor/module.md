# Cursor Module

The Cursor module implements the Cursor agent adapter.

## Responsibilities

- read current Cursor agent state
- apply a saved connection into Cursor agent runtime state
- import current Cursor state into a saved connection

Cursor support is scoped to the agent-side runtime, not generic Cursor desktop auth behavior.
Cursor-specific personal usage binding and usage snapshot rules belong in shared core usage, not in the Cursor adapter itself.
