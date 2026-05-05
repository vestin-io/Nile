# Nile Simplification Review 5

Scope: current follow-up pass after `review4.md`.

Goal: keep shrinking the largest remaining non-test hotspots where multiple responsibilities still sit in one class.

## Todo List

- [x] High: Split `DesktopConnectionManager.ts` so prepared-draft lifecycle and TTL/capacity eviction stop living beside connection create/update/onboarding commands. Evidence: [DesktopConnectionManager.ts](/Users/jiatwork/Works/nile/apps/desktop/src/electron/DesktopConnectionManager.ts), [DesktopPreparedDraftStore.ts](/Users/jiatwork/Works/nile/apps/desktop/src/electron/DesktopPreparedDraftStore.ts).
- [x] High: Split `ConnectionAddFlow.ts` so agent-selection prompting and OpenClaw validation stop living inside the broader add/onboarding flow. Evidence: [ConnectionAddFlow.ts](/Users/jiatwork/Works/nile/apps/cli/src/commands/ConnectionAddFlow.ts), [ConnectionAgentSelectionFlow.ts](/Users/jiatwork/Works/nile/apps/cli/src/commands/ConnectionAgentSelectionFlow.ts).
