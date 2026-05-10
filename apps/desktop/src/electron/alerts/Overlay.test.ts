import { describe, expect, it } from "vitest";

import type { SettingsState } from "../../state/Types";
import { ConnectionAlertOverlay } from "./Overlay";

describe("ConnectionAlertOverlay", () => {
  it("decorates settings connections with alert metrics, alerts, and active counts", () => {
    const state = createSettingsState();
    const overlay = new ConnectionAlertOverlay({
      listByConnectionId: () => new Map([
        ["codex-work", [{ id: "alert-1", type: "low-percent", metricKey: "5h", metricLabel: "5h", thresholdPercent: 65, enabled: true }]],
      ]),
    } as never);

    const decorated = overlay.decorateSettingsState(state);
    const connection = decorated.connections[0];

    expect(connection?.activeAlertCount).toBe(1);
    expect(connection?.alerts).toEqual([{ id: "alert-1", type: "low-percent", metricKey: "5h", metricLabel: "5h", thresholdPercent: 65, enabled: true }]);
    expect(connection?.alertMetrics).toEqual([{ key: "5h", label: "5h", remainingPercent: 42, resetsAt: null }]);
  });
});

function createSettingsState(): SettingsState {
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
      usage: {
        status: "available",
        windows: [{ key: "5h", label: "5h", remainingPercent: 42, resetsAt: null }],
        windowLabel: "5h",
        remainingPercent: 42,
        text: "5h 42% left",
      },
      activeAlertCount: 0,
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
