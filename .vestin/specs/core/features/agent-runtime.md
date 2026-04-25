# Agent Runtime

Agent runtime support is the shared orchestration layer around agent adapters.

It owns:

- status reads
- live-state matching
- explicit use/apply flows
- explicit import flows

Rules:

- each apply is an explicit user action
- live-state detection stays local
- import may match an existing saved connection or create a new one
- shared orchestration may call agent adapters, but may not own agent-specific file logic
