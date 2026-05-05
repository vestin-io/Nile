# Nile Simplification Review 6

Scope: current follow-up pass after `review5.md`.

Goal: keep shrinking the remaining `300+` line non-test files whose responsibilities are still visibly mixed.

## Todo List

- [x] High: Split `AddConnectionPage.tsx` so gateway preparation UI and post-preparation form sections stop living in one large conditional render block. Evidence: [AddConnectionPage.tsx](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/connections/AddConnectionPage.tsx), [AddConnectionGatewayPreparation.tsx](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/connections/AddConnectionGatewayPreparation.tsx), [AddConnectionPostPreparation.tsx](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/connections/AddConnectionPostPreparation.tsx).
- [x] High: Split `ClaudeSettingsStore.ts` so gateway model cache reading/ranking stops living inside the broader settings read/write store. Evidence: [SettingsStore.ts](/Users/jiatwork/Works/nile/packages/core/src/agents/claude/SettingsStore.ts), [GatewayModelCatalog.ts](/Users/jiatwork/Works/nile/packages/core/src/agents/claude/GatewayModelCatalog.ts).
