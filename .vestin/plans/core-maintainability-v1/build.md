# Core Maintainability V1 Build Log

## 2026-05-04

### Step 1: Agent Flow Unification

- Started the maintainability refactor with the highest-duplication path: agent apply orchestration.
- Chose to unify the shared apply lifecycle first:
  - prepare
  - mutation-history start
  - apply
  - restore-on-error
  - mark-failed-safely
  - complete
- Deferred wider session and package-boundary changes until the apply refactor lands cleanly.
- Added a shared `ApplyMutation` orchestrator under `packages/core/src/agents/` so codex / claude / cursor / openclaw now share one implementation for:
  - mutation-history start
  - apply execution
  - restore-on-error
  - mark-failed-safely
  - apply completion
- Rewired the four agent `ApplySelection` classes to keep only agent-specific config and credential writes while delegating the common mutation lifecycle.
- Added focused tests for the shared orchestrator covering:
  - successful apply completion
  - original error preservation when `markFailed(...)` itself fails
- Added a shared `RollbackLatest` helper for the simple rollback flow used by codex / claude / openclaw.
- Rewired those three rollback classes so they now delegate:
  - mutation-history rollback
  - selection clear
  - state reconciliation
  - success logging
  to one shared implementation.
- Completed PR1 scope for the common agent lifecycle without changing external apply / rollback behavior.

### Step 2: Access Registry Split

- Split `models/access/Registry.ts` into focused collaborators:
  - `Builder` for access record construction and validation
  - `Credentials` for credential create / update / remove rollback handling
- Reduced `AccessRegistry` to orchestration:
  - build record
  - persist access row
  - delegate credential lifecycle
- Preserved previous `readCredential(...)` semantics at the registry boundary so connection reuse and live-state matching still read credentials from the same place.
- Added focused rollback tests for:
  - restoring the previous credential when access-row update persistence fails
  - restoring the previous credential when access removal persistence fails

### Step 3: Session Surface Narrowing

- Split `runtime-local/NileSession.ts` into narrower collaborators:
  - `Runtime` for lazy composition of workspace state, agent adapters, mutation history, and session facades
  - `Effects` for local side effects such as Cursor usage auto-bind after create/import flows
- Kept the `NileSession` public API stable for CLI and desktop callers while shrinking it from a wide composition root into a thin delegator.
- Reduced `NileSession.ts` from 332 lines to 193 lines without changing external behavior.

### Step 4: Core Package Boundary

- Added a real `@nile/core` build pipeline:
  - `build.mjs` bundles exported runtime entrypoints into `dist/`
  - `tsconfig.build.json` emits declaration files into the same `dist/` tree
- Moved `packages/core/package.json` runtime exports from `src/` to `dist/`.
- Added package metadata for the built boundary:
  - `main`
  - `types`
  - `files`
- Retargeted workspace TypeScript path aliases to the built declaration boundary under `packages/core/dist/` so CLI / desktop / host-local compile against the packaged surface instead of the source tree.
- Added `build:core` orchestration at the repo root and wired CLI / desktop start-build flows to build `@nile/core` before use.
- Confirmed local `file:` dependencies point to the shared workspace package via symlink, so building `packages/core/dist` updates the runtime boundary used by CLI and desktop directly.

### Verification

- `npm run test:core`
- `npm run typecheck`
- `npm run test:host-local`
- `npm run test:cli`
- `npm run test:desktop`
