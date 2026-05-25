import { describe, expect, it } from "vitest";

import type { DesktopStatusEntryState } from "../../state/Types";
import { DesktopStatusEntryTitle } from "./StatusEntryTitle";

describe("DesktopStatusEntryTitle", () => {
  it("returns an empty title outside summary mode", () => {
    expect(DesktopStatusEntryTitle.format(createState(), {
      hasConfiguredSelectedAgents: true,
      mode: "app_entry",
      selectedAgentIds: ["codex"],
    }, {})).toBe("");
  });

  it("formats selected agents with available current usage", () => {
    expect(DesktopStatusEntryTitle.format(createState(), {
      hasConfiguredSelectedAgents: true,
      mode: "summary",
      selectedAgentIds: ["codex", "cursor", "claude"],
    }, {})).toBe("Codex 72% | Cursor 6%");
  });

  it("omits selected agents that do not have available usage", () => {
    expect(DesktopStatusEntryTitle.format(createState(), {
      hasConfiguredSelectedAgents: true,
      mode: "summary",
      selectedAgentIds: ["claude"],
    }, {})).toBe("");
  });

  it("defaults to the first available quota agent when selected agents were never configured", () => {
    expect(DesktopStatusEntryTitle.format(createState(), {
      hasConfiguredSelectedAgents: false,
      mode: "summary",
      selectedAgentIds: [],
    }, {})).toBe("Codex 72%");
  });

  it("uses the pinned connection metric when one is configured", () => {
    expect(DesktopStatusEntryTitle.format(createState(), {
      hasConfiguredSelectedAgents: true,
      mode: "summary",
      selectedAgentIds: ["codex"],
    }, {
      "codex-work": "weekly",
    })).toBe("Codex 88%");
  });

  it("can remove the inferred default selection before any explicit selection config exists", () => {
    expect(DesktopStatusEntryTitle.toggleSelectedAgentIds(createState(), {
      hasConfiguredSelectedAgents: false,
      mode: "app_entry",
      selectedAgentIds: [],
    }, "codex")).toEqual([]);
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
          windows: [{ key: "monthly", label: "monthly", remainingPercent: 6, resetsAt: null }],
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
