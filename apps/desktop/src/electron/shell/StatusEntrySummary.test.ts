import { describe, expect, it } from "vitest";

import type { DesktopStatusEntryState } from "../../state/Types";
import { DesktopStatusEntrySummary } from "./StatusEntrySummary";

describe("DesktopStatusEntrySummary", () => {
  it("formats a Windows tray tooltip summary from the selected agents", () => {
    expect(DesktopStatusEntrySummary.formatTrayTooltip(
      "Nile",
      createState(),
      {
        hasConfiguredSelectedAgents: true,
        mode: "ticker",
        selectedAgentIds: ["codex", "cursor", "claude"],
      },
      {},
    )).toBe("Nile · Codex 72% · Cursor 6%");
  });

  it("falls back to the app name when no summary is available", () => {
    expect(DesktopStatusEntrySummary.formatTrayTooltip(
      "Nile",
      createState(),
      {
        hasConfiguredSelectedAgents: true,
        mode: "app_entry",
        selectedAgentIds: ["claude"],
      },
      {},
    )).toBe("Nile");
  });

  it("reads the full quota text for an agent when usage is available", () => {
    expect(DesktopStatusEntrySummary.readQuotaText(createState().agents[0]!, {})).toBe("5h 72% left");
  });
});

function createState(): DesktopStatusEntryState {
  return {
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        currentConnection: { id: "codex-work" } as never,
        currentUsage: {
          status: "available",
          windows: [
            { key: "5h", label: "5h", remainingPercent: 72, resetsAt: null },
            { key: "weekly", label: "weekly", remainingPercent: 88, resetsAt: null },
          ],
          windowLabel: "5h",
          remainingPercent: 72,
          text: "5h 72% left",
        },
        connections: [],
      },
      {
        agentId: "cursor",
        agentLabel: "Cursor",
        currentConnection: { id: "cursor-work" } as never,
        currentUsage: {
          status: "available",
          windows: [
            { key: "monthly", label: "monthly", remainingPercent: 6, resetsAt: null },
          ],
          windowLabel: "monthly",
          remainingPercent: 6,
          text: "monthly 6% left",
        },
        connections: [],
      },
      {
        agentId: "claude",
        agentLabel: "Claude",
        currentConnection: null,
        currentUsage: null,
        connections: [],
      },
    ],
  };
}
