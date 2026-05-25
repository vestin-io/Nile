import { describe, expect, it } from "vitest";

import type { DesktopStatusEntryState } from "./Types";
import { DesktopStatusEntryPresenter } from "./StatusEntryPresenter";

describe("DesktopStatusEntryPresenter", () => {
  it("filters configured agents for the popup view", () => {
    const presenter = new DesktopStatusEntryPresenter(createState(), {});

    expect(presenter.readConfiguredAgents().map((agent) => agent.agentId)).toEqual(["codex"]);
  });

  it("builds connection summaries and quota summaries from the current connection", () => {
    const presenter = new DesktopStatusEntryPresenter(createState(), { "codex-work": "weekly" });
    const codex = presenter.readConfiguredAgent("codex");

    expect(codex).toEqual({
      agentId: "codex",
      agentLabel: "Codex",
      connections: [
        {
          authMode: "openai_session",
          endpointLabel: "OpenAI",
          id: "codex-work",
          isCurrent: true,
          label: "Work",
        },
        {
          authMode: "api_key",
          endpointLabel: "OpenAI",
          id: "codex-personal",
          isCurrent: false,
          label: "Personal",
        },
      ],
      currentConnectionSummary: "OpenAI / Work",
      hasCurrentConnection: true,
      quotaBadgeText: "weekly 88%",
      quotaText: "weekly 88% left",
    });
  });

  it("returns null quota summaries when live usage is unavailable", () => {
    const presenter = new DesktopStatusEntryPresenter(createState(), {});
    const claude = presenter.readAgents().find((agent) => agent.agentId === "claude");

    expect(claude?.quotaBadgeText).toBeNull();
    expect(claude?.quotaText).toBeNull();
  });
});

function createState(): DesktopStatusEntryState {
  return {
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        currentConnection: {
          id: "codex-work",
          label: "Work",
          endpointLabel: "OpenAI",
        } as never,
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
        connections: [
          {
            id: "codex-work",
            label: "Work",
            endpointLabel: "OpenAI",
            endpointFamily: "openai",
            authMode: "openai_session",
            isCurrent: true,
            activeAlertCount: 0,
            enabledAgents: [],
            configurableAgents: [],
            selectedByAgents: [],
          },
          {
            id: "codex-personal",
            label: "Personal",
            endpointLabel: "OpenAI",
            endpointFamily: "openai",
            authMode: "api_key",
            isCurrent: false,
            activeAlertCount: 0,
            enabledAgents: [],
            configurableAgents: [],
            selectedByAgents: [],
          },
        ],
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
