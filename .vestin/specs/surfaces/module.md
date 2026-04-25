# Surfaces Module

Surfaces are thin entry points over shared core behavior.

## Current Surfaces

- CLI
- desktop

## Rules

- surfaces call shared core instead of re-implementing workflows
- surfaces own presentation and interaction only
- surfaces must not own connection persistence rules
- surfaces must not own agent-specific config mutation
