# Core Maintainability V1

## Goal

Reduce the long-term maintenance cost of `packages/core` without changing user-facing behavior.

## Current Status

This plan is now largely implemented.

The detailed execution history lives in:

- `.vestin/plans/core-maintainability-v1/build.md`

The remaining work is no longer broad structural rescue.
It is mostly:

- keeping `runtime-local` small and concrete
- preventing public surface sprawl from regrowing
- tightening a few remaining ownership seams when they prove high value

This refactor was originally organized as four scoped PRs so we could keep risk low and verification local.

## PR 1: Agent Flow Unification

### Problem

Agent apply and rollback flows repeat the same orchestration across:

- `codex`
- `claude`
- `cursor`
- `openclaw`

The duplicated parts include:

- apply preparation
- mutation-history start / markApplied / markFailed handling
- restore-on-error behavior
- rollback completion bookkeeping

When a bug appears in one of those shared paths, it tends to require 3-4 edits across agent modules.

### Scope

- Introduce a shared apply orchestration class for the common:
  - prepare
  - history start
  - execute
  - restore-on-error
  - mark-failed-safely
  - complete
- Migrate codex / claude / cursor / openclaw apply classes to that shared orchestrator.
- If the abstraction stays clean, also unify the simple rollback classes used by codex / claude / openclaw.
- Keep agent-specific projection, credential, and config logic local to each agent module.

### Non-Goals

- Do not change connection semantics.
- Do not change mutation-history persistence schema.
- Do not change live-state detection behavior.
- Do not merge Cursor rollback into the simple rollback path unless the shape becomes obviously compatible.

### Acceptance

- No user-facing behavior change in apply / rollback flows.
- Existing core tests still pass.
- Shared failure handling lives in one place instead of being hand-coded in each agent apply file.

## PR 2: Access Registry Split

### Problem

`models/access/Registry.ts` currently owns:

- validation
- endpoint compatibility checks
- credential lifecycle
- persistence rollback

That makes the class a high-change hotspot.

### Scope

- Extract access validation into a dedicated collaborator.
- Extract credential create / update / rollback handling into a dedicated collaborator.
- Leave `AccessRegistry` as the orchestration entrypoint.

### Acceptance

- `AccessRegistry` becomes materially smaller and narrower.
- Credential rollback logic is isolated and directly testable.

## PR 3: Session Surface Narrowing

### Problem

`runtime-local/NileSession.ts` is becoming an increasingly wide service surface.

### Scope

- Split the use-case surface into smaller session/facade classes:
  - connections
  - status
  - history
  - usage
- Keep the composition root stable for CLI and desktop.

### Acceptance

- `NileSession` shrinks into composition and delegation.
- Use-case entrypoints are easier to test independently.

## PR 4: Core Package Boundary

### Problem

`@nile/core` exports raw `src/*.ts` entrypoints, coupling all consumers to source layout.

### Scope

- Add a compiled `dist` boundary.
- Move stable exports onto built output first.
- Keep subpath compatibility where needed during migration.

### Acceptance

- Consumers no longer depend directly on `src` paths as the runtime boundary.
- Refactors inside `packages/core/src` become safer.

## Order

1. Agent Flow Unification
2. Access Registry Split
3. Session Surface Narrowing
4. Core Package Boundary
