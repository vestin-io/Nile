import { describe, expect, it, vi } from "vitest";

import type { SettingsState } from "../../state/Types";
import { ConnectionUsageAlertEvaluator } from "./Evaluator";

describe("ConnectionUsageAlertEvaluator", () => {
  it("does not notify on first observation", () => {
    const notify = vi.fn();
    const evaluator = new ConnectionUsageAlertEvaluator({ notify });

    evaluator.evaluate(createState({ remainingPercent: 60, thresholds: [65] }));

    expect(notify).not.toHaveBeenCalled();
  });

  it("notifies when remaining percent crosses below a threshold", () => {
    const notify = vi.fn();
    const evaluator = new ConnectionUsageAlertEvaluator({ notify });

    evaluator.evaluate(createState({ remainingPercent: 80, thresholds: [65] }));
    evaluator.evaluate(createState({ remainingPercent: 60, thresholds: [65] }));

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      kind: "usage-threshold",
      scope: "connection",
      target: { page: "connections", connectionId: "codex-work" },
    }));
  });

  it("notifies only the most severe threshold crossed for a metric in one evaluation", () => {
    const notify = vi.fn();
    const evaluator = new ConnectionUsageAlertEvaluator({ notify });

    evaluator.evaluate(createState({ remainingPercent: 80, thresholds: [65, 45, 25] }));
    evaluator.evaluate(createState({ remainingPercent: 20, thresholds: [65, 45, 25] }));

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      body: "5h is down to 20% remaining, below your 25% alert.",
      dedupeKey: "usage-threshold:codex-work:5h:alert-25",
    }));
  });

  it("can notify again after the metric recovers and drops below the threshold again", () => {
    const notify = vi.fn();
    const evaluator = new ConnectionUsageAlertEvaluator({ notify });

    evaluator.evaluate(createState({ remainingPercent: 80, thresholds: [65] }));
    evaluator.evaluate(createState({ remainingPercent: 60, thresholds: [65] }));
    evaluator.evaluate(createState({ remainingPercent: 90, thresholds: [65] }));
    evaluator.evaluate(createState({ remainingPercent: 50, thresholds: [65] }));

    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("notifies when a metric renews after its reset time changes", () => {
    const notify = vi.fn();
    const evaluator = new ConnectionUsageAlertEvaluator({ notify });

    evaluator.evaluate(createState({
      remainingPercent: 18,
      resetsAt: "2026-05-09T10:00:00.000Z",
      alerts: [{ type: "renewed" }],
    }));
    evaluator.evaluate(createState({
      remainingPercent: 100,
      resetsAt: "2026-05-09T15:00:00.000Z",
      alerts: [{ type: "renewed" }],
    }));

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      kind: "usage-renewed",
      body: "5h is back to 100% remaining.",
      dedupeKey: "usage-renewed:codex-work:5h:alert-renewed",
      resetAt: "2026-05-09T15:00:00.000Z",
    }));
  });

  it("does not notify renewed alerts when the remaining percent only recovers without a reset time change", () => {
    const notify = vi.fn();
    const evaluator = new ConnectionUsageAlertEvaluator({ notify });

    evaluator.evaluate(createState({
      remainingPercent: 22,
      resetsAt: null,
      alerts: [{ type: "renewed" }],
    }));
    evaluator.evaluate(createState({
      remainingPercent: 100,
      resetsAt: null,
      alerts: [{ type: "renewed" }],
    }));

    expect(notify).not.toHaveBeenCalled();
  });

  it("forgets removed metrics so they do not retain stale observations forever", () => {
    const notify = vi.fn();
    const evaluator = new ConnectionUsageAlertEvaluator({ notify });

    evaluator.evaluate(createState({ remainingPercent: 80, thresholds: [65] }));
    evaluator.evaluate({
      ...createState({ remainingPercent: 80, thresholds: [65] }),
      connections: [],
    });
    evaluator.evaluate(createState({ remainingPercent: 60, thresholds: [65] }));

    expect(notify).not.toHaveBeenCalled();
  });
});

function createState(input: {
  remainingPercent: number;
  resetsAt?: string | null;
  thresholds?: number[];
  alerts?: Array<
    | { type: "low-percent"; thresholdPercent: number }
    | { type: "renewed" }
  >;
}): SettingsState {
  const alerts = input.alerts
    ?? (input.thresholds ?? []).map((threshold) => ({ type: "low-percent" as const, thresholdPercent: threshold }));
  return {
    onboarding: null,
    currentConnection: null,
    currentConnectionState: "none",
    liveConnection: null,
    syncState: "synced",
    connections: [{
      id: "codex-work",
      label: "Codex Work",
      endpointLabel: "Codex Work",
      endpointFamily: "openai",
      authMode: "api_key",
      isCurrent: false,
      usage: null,
      alertMetrics: [{ key: "5h", label: "5h", remainingPercent: input.remainingPercent, resetsAt: input.resetsAt ?? null }],
      alerts: alerts.map((alert) => alert.type === "renewed"
        ? {
          id: "alert-renewed",
          type: "renewed" as const,
          metricKey: "5h",
          metricLabel: "5h",
          enabled: true,
        }
        : {
          id: `alert-${alert.thresholdPercent}`,
          type: "low-percent" as const,
          metricKey: "5h",
          metricLabel: "5h",
          thresholdPercent: alert.thresholdPercent,
          enabled: true,
        }),
      activeAlertCount: alerts.length,
      enabledAgents: ["codex"],
      configurableAgents: ["codex"],
      selectedByAgents: [],
    }],
    currentAgentConnections: [],
    agents: [],
    detectedSetups: { mode: "empty", importableCount: 0, items: [] },
    advanced: { agentHomes: [], supportedAgents: [], savedConnectionCount: 1, importableSetupCount: 0 },
  };
}
