import { describe, expect, it } from "vitest";

import { ApplyMutation } from "./ApplyMutation";
import type { PreparedAgentApplySelection } from "../actions/use/ApplySupport";
import type { AgentId } from "../models/agent/Types";
import type { ApplyAgentSelectionResult } from "../runtime-local/AgentAdapterTypes";
import type {
  MutationAfterFileInput,
  MutationTrackedFileInput,
} from "../services/history/MutationHistoryTypes";

describe("ApplyMutation", () => {
  it("runs the shared apply lifecycle and returns the completed result", () => {
    const prepared = createPrepared();
    const support = new StubApplySupport(prepared);
    const history = new StubMutationHistory();
    const logger = new StubLogger();
    const mutation = new ApplyMutation(
      history as never,
      support as never,
      logger as never,
    );

    const result = mutation.execute({
      agentId: "codex",
      connectionId: "work",
      historyMarkFailedEvent: "codex.apply.history_mark_failed",
      buildFiles: () => [{ path: "/tmp/config", content: "before", existedBefore: true }],
      apply: () => {
        support.applied = true;
      },
      readAppliedFiles: () => [{ path: "/tmp/config", content: "after" }],
      restore: () => {
        throw new Error("restore should not run");
      },
    });

    expect(result).toEqual(support.completeResult);
    expect(history.started[0]?.connectionId).toBe("work");
    expect(history.applied).toEqual([
      {
        mutationId: "mutation-1",
        files: [{ path: "/tmp/config", content: "after" }],
      },
    ]);
    expect(support.applied).toBe(true);
  });

  it("restores state and preserves the original error when markFailed also fails", () => {
    const prepared = createPrepared();
    const support = new StubApplySupport(prepared);
    const history = new StubMutationHistory();
    history.markFailedError = new Error("history failed");
    const logger = new StubLogger();
    const mutation = new ApplyMutation(
      history as never,
      support as never,
      logger as never,
    );
    let restored = false;

    expect(() =>
      mutation.execute({
        agentId: "codex",
        connectionId: "work",
        historyMarkFailedEvent: "codex.apply.history_mark_failed",
        buildFiles: () => [{ path: "/tmp/config", content: "before", existedBefore: true }],
        apply: () => {
          throw new Error("apply exploded");
        },
        readAppliedFiles: () => [],
        restore: () => {
          restored = true;
        },
      }),
    ).toThrow("apply exploded");

    expect(restored).toBe(true);
    expect(support.rollbackErrors).toHaveLength(1);
    expect(logger.errors).toEqual([
      {
        event: "codex.apply.history_mark_failed",
        fields: { mutationId: "mutation-1" },
      },
    ]);
  });
});

function createPrepared(): PreparedAgentApplySelection {
  return {
    connection: {
      id: "work",
      endpointId: "openai",
      label: "Work",
      authMode: "api_key",
      enabledAgents: ["codex"],
      credentialSource: {
        kind: "local",
        scope: "access",
        reference: "access:work",
        allowLocalMaterialization: true,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    connectionId: "work",
    endpoint: {
      id: "openai",
      label: "OpenAI",
      rootUrl: "https://api.openai.com",
      profile: "openai-official",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    access: {
      id: "work",
      endpointId: "openai",
      label: "Work",
      authMode: "api_key",
      enabledAgents: ["codex"],
      credentialSource: {
        kind: "local",
        scope: "access",
        reference: "access:work",
        allowLocalMaterialization: true,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    credential: {
      kind: "api_key",
      apiKey: "secret",
    },
    projection: {
      agentId: "codex",
      endpointId: "openai",
    } as never,
    appliedAt: "2026-01-01T00:00:00.000Z",
  };
}

class StubApplySupport {
  applied = false;
  rollbackErrors: unknown[] = [];
  readonly completeResult: ApplyAgentSelectionResult;

  constructor(private readonly prepared: PreparedAgentApplySelection) {
    this.completeResult = {
      agentId: prepared.projection.agentId as AgentId,
      connectionId: prepared.connectionId,
      connectionLabel: prepared.connection.label,
      endpointId: prepared.endpoint.id,
      endpointLabel: prepared.endpoint.label,
      accessId: prepared.access.id,
      appliedAt: prepared.appliedAt,
    };
  }

  prepare(connectionId: string): PreparedAgentApplySelection {
    if (connectionId !== this.prepared.connectionId) {
      throw new Error(`Unexpected connection id: ${connectionId}`);
    }
    return this.prepared;
  }

  complete(): ApplyAgentSelectionResult {
    return this.completeResult;
  }

  logRollback(error: unknown): void {
    this.rollbackErrors.push(error);
  }
}

class StubMutationHistory {
  readonly started: Array<{
    agentId: AgentId;
    connectionId: string;
    files: MutationTrackedFileInput[];
  }> = [];
  readonly applied: Array<{
    mutationId: string;
    files: MutationAfterFileInput[];
  }> = [];
  markFailedError: Error | null = null;

  start(input: {
    agentId: AgentId;
    connectionId: string;
    files: MutationTrackedFileInput[];
  }) {
    this.started.push(input);
    return { id: "mutation-1" };
  }

  markApplied(mutationId: string, files: MutationAfterFileInput[]): void {
    this.applied.push({ mutationId, files });
  }

  markFailed(): void {
    if (this.markFailedError) {
      throw this.markFailedError;
    }
  }

  close(): void {}
}

class StubLogger {
  readonly errors: Array<{
    event: string;
    fields: Record<string, unknown>;
  }> = [];

  error(event: string, _error?: unknown, fields?: Record<string, unknown>): void {
    this.errors.push({
      event,
      fields: fields ?? {},
    });
  }
}
