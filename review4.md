# Nile Simplification Review 4

Scope: follow-up simplification pass after `review3.md`.

Goal: keep shrinking the remaining non-test hotspots that still mix multiple orchestration concerns.

## Todo List

- [x] High: Split `useConnectionEditState.ts` so gateway capability probing, gateway-trust state, and agent reconciliation stop living inside the same edit-form hook as label/auth submit state. Evidence: [useConnectionEditState.ts](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/connections/useConnectionEditState.ts), [useGatewaySupportState.ts](/Users/jiatwork/Works/nile/apps/desktop/src/renderer/connections/useGatewaySupportState.ts).
- [x] High: Split `ConnectionCommands.ts` so add/onboarding/agent-selection flow stops living beside list/remove/import/use command handlers. Evidence: [ConnectionCommands.ts](/Users/jiatwork/Works/nile/apps/cli/src/commands/ConnectionCommands.ts), [ConnectionAddFlow.ts](/Users/jiatwork/Works/nile/apps/cli/src/commands/ConnectionAddFlow.ts).
- [x] Medium: Keep shrinking `ConnectionPresenter.ts` by separating Azure label normalization from the larger text-formatting surface. Evidence: [ConnectionPresenter.ts](/Users/jiatwork/Works/nile/apps/cli/src/presenters/ConnectionPresenter.ts), [EndpointLabelFormatter.ts](/Users/jiatwork/Works/nile/apps/cli/src/presenters/EndpointLabelFormatter.ts).
- [x] Medium: Keep shrinking `NileCli.ts` by separating top-level command routing from presenter/output wrapping. Evidence: [NileCli.ts](/Users/jiatwork/Works/nile/apps/cli/src/NileCli.ts), [NileCliCommandRouter.ts](/Users/jiatwork/Works/nile/apps/cli/src/NileCliCommandRouter.ts), [NileCliResultFactory.ts](/Users/jiatwork/Works/nile/apps/cli/src/NileCliResultFactory.ts).
