import { describe, expect, it } from "vitest";

import { RollbackLatest } from "./RollbackLatest";

describe("RollbackLatest", () => {
  it("runs the shared rollback lifecycle and logs the result", () => {
    const history = new StubMutationHistory();
    const selection = new StubAgentSelection();
    const reconciler = new StubReconciler();
    const logger = new StubLogger();
    const rollback = new RollbackLatest(
      history as never,
      selection as never,
      reconciler,
      logger as never,
    );

    const result = rollback.execute({
      agentId: "codex",
      startEvent: "codex.rollback.start",
      successEvent: "codex.rollback.success",
    });

    expect(result).toEqual({
      rolledBackMutationId: "applied-1",
      rollbackMutationId: "rollback-1",
    });
    expect(selection.cleared).toEqual(["codex"]);
    expect(reconciler.reconciled).toBe(1);
    expect(logger.infos).toEqual([
      { event: "codex.rollback.start", fields: {} },
      {
        event: "codex.rollback.success",
        fields: {
          rollbackMutationId: "rollback-1",
          rolledBackMutationId: "applied-1",
        },
      },
    ]);
  });
});

class StubMutationHistory {
  rollbackLatest() {
    return {
      agentId: "codex",
      rollbackEntry: { id: "rollback-1" },
      rolledBackEntry: { id: "applied-1" },
    };
  }

  close(): void {}
}

class StubAgentSelection {
  readonly cleared: string[] = [];

  clear(agentId: string): void {
    this.cleared.push(agentId);
  }
}

class StubReconciler {
  reconciled = 0;

  reconcileAgentSelection(): void {
    this.reconciled += 1;
  }

  close(): void {}
}

class StubLogger {
  readonly infos: Array<{
    event: string;
    fields: Record<string, unknown>;
  }> = [];

  info(event: string, fields?: Record<string, unknown>): void {
    this.infos.push({
      event,
      fields: fields ?? {},
    });
  }
}
