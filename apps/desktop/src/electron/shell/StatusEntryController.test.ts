import { describe, expect, it, vi } from "vitest";

import type { AgentId } from "@nile/core/models/agent";

import type { DesktopStatusEntryDisplayState } from "../../state/StatusEntryDisplay";
import type { DesktopStatusEntryState } from "../../state/Types";
import { DesktopStatusEntryController } from "./StatusEntryController";

describe("DesktopStatusEntryController", () => {
  it("syncs a Windows tray tooltip from the shared status-entry summary", () => {
    const shell = createShell();
    const controller = new DesktopStatusEntryController({
      appName: "Nile",
      platform: "win32",
      readConnectionQuotaMetricPreferences: () => ({}),
      readDisplayState: () => createDisplayState(),
      readStatusEntryState: () => createState(),
      shell,
      writeSelectedAgentIds: vi.fn(),
    });

    controller.sync();

    expect(shell.setTrayTitle).not.toHaveBeenCalled();
    expect(shell.setTrayToolTip).toHaveBeenCalledWith("Nile | Codex 72%");
  });

  it("toggles selected agents through the shared display store adapter", () => {
    const writeSelectedAgentIds = vi.fn((agentIds: AgentId[]) => ({
      hasConfiguredSelectedAgents: true,
      mode: "summary" as const,
      selectedAgentIds: agentIds,
    }));
    const controller = new DesktopStatusEntryController({
      appName: "Nile",
      platform: "darwin",
      readConnectionQuotaMetricPreferences: () => ({}),
      readDisplayState: () => createDisplayState(),
      readStatusEntryState: () => createState(),
      shell: createShell(),
      writeSelectedAgentIds,
    });

    const next = controller.toggleSelectedAgent("cursor");

    expect(writeSelectedAgentIds).toHaveBeenCalledWith(["codex", "cursor"]);
    expect(next.selectedAgentIds).toEqual(["codex", "cursor"]);
  });
});

function createShell() {
  return {
    setTrayTitle: vi.fn(),
    setTrayToolTip: vi.fn(),
  };
}

function createDisplayState(): DesktopStatusEntryDisplayState {
  return {
    hasConfiguredSelectedAgents: true,
    mode: "summary",
    selectedAgentIds: ["codex"],
  };
}

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
            { key: "weekly", label: "weekly", remainingPercent: 72, resetsAt: null },
          ],
          windowLabel: "weekly",
          remainingPercent: 72,
          text: "weekly 72% left",
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
            { key: "monthly", label: "monthly", remainingPercent: 55, resetsAt: null },
          ],
          windowLabel: "monthly",
          remainingPercent: 55,
          text: "monthly 55% left",
        },
        connections: [],
      },
    ],
  };
}
