# Codex Adapter

The Codex adapter owns all Codex-specific runtime behavior.

It may:

- parse Codex config and auth state
- detect current provider or credential mode
- apply a resolved saved connection
- import live state into Nile
- roll back the latest Nile-owned Codex mutation

It must not own:

- shared provider, binding, or connection persistence
- CLI or desktop presentation rules
