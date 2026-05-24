# Surfaces Module

Surfaces are thin entry points over shared core behavior.

## Current Surfaces

- CLI
- desktop

## Rules

- surfaces call builtins-owned concrete runtime and shared core contracts instead of re-implementing workflows
- surfaces own presentation and interaction only
- surfaces must not own connection persistence rules
- surfaces must not own agent-specific config mutation
- surfaces must not import concrete agent or connection implementation packages directly
- surfaces may guide the user through selecting a machine-level credential storage mode, but they must not reintroduce connection-level storage policy
- once the first saved connection exists, surfaces must present storage mode as locked/read-only until explicit reset
- surfaces must describe OS-native secure storage with platform-neutral product language (`System secure storage`), not platform-specific labels such as `Keychain`

## Feature Index

- [CLI Surface](./features/cli-surface.md)
- [Desktop Surface](./features/desktop-surface.md)
- [Desktop Credential Storage Choice](./features/desktop-credential-storage-choice.md)
