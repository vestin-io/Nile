# Claude Adapter

The Claude adapter owns Claude-specific live-state reads, apply behavior, and import behavior.

It must not own:

- shared connection creation rules
- shared status assembly
- surface-layer formatting
