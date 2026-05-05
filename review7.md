# Nile Simplification Review 7

Scope: follow-up pass focused on repeated patterns and cross-layer responsibility leakage.

Goal: reduce mixed helper surfaces and shrink Electron updater integration leakage.

## Todo List

- [x] High: Split `renderer/shared/Support.ts` so OpenClaw issue formatting and timestamp formatting stop living beside unrelated definition/filter helpers. Evidence: [Support.ts](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/shared/Support.ts), [OpenClawIssueFormatter.ts](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/shared/OpenClawIssueFormatter.ts), [TimeFormatter.ts](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/shared/TimeFormatter.ts).
- [x] High: Split `AutoUpdateManager.ts` so updater-library logger adaptation and release-version parsing stop living inside the release state manager. Evidence: [AutoUpdateManager.ts](/Users/jiatwork/Works/nile/apps/desktop/src/electron/AutoUpdateManager.ts), [AutoUpdateSupport.ts](/Users/jiatwork/Works/nile/apps/desktop/src/electron/AutoUpdateSupport.ts).
