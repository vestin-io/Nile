import { describe, expect, it } from "vitest";

import { DesktopTrayTickerTitle } from "./TickerTitle";
import type { MenubarState } from "../../state/Types";

describe("DesktopTrayTickerTitle", () => {
  it("returns an empty title outside ticker mode", () => {
    expect(DesktopTrayTickerTitle.format(createState(), {
      hasConfiguredTickerAgents: true,
      mode: "app_entry",
      tickerAgentIds: ["codex"],
    })).toBe("");
  });

  it("formats selected agents with available current usage", () => {
    expect(DesktopTrayTickerTitle.format(createState(), {
      hasConfiguredTickerAgents: true,
      mode: "ticker",
      tickerAgentIds: ["codex", "cursor", "claude"],
    })).toBe("Codex 72% · Cursor 6%");
  });

  it("omits selected agents that do not have available usage", () => {
    expect(DesktopTrayTickerTitle.format(createState(), {
      hasConfiguredTickerAgents: true,
      mode: "ticker",
      tickerAgentIds: ["claude"],
    })).toBe("");
  });

  it("defaults to the first available quota agent when ticker agents were never configured", () => {
    expect(DesktopTrayTickerTitle.format(createState(), {
      hasConfiguredTickerAgents: false,
      mode: "ticker",
      tickerAgentIds: [],
    })).toBe("Codex 72%");
  });

  it("can remove the inferred default selection before any explicit ticker config exists", () => {
    expect(DesktopTrayTickerTitle.toggleSelectedAgentIds(createState(), {
      hasConfiguredTickerAgents: false,
      mode: "app_entry",
      tickerAgentIds: [],
    }, "codex")).toEqual([]);
  });
});

function createState(): MenubarState {
  return {
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        currentConnection: null,
        currentUsage: {
          status: "available",
          windows: [],
          windowLabel: "5h",
          remainingPercent: 72,
          text: "5h 72% left",
        },
        connections: [],
      },
      {
        agentId: "cursor",
        agentLabel: "Cursor",
        currentConnection: null,
        currentUsage: {
          status: "available",
          windows: [],
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
