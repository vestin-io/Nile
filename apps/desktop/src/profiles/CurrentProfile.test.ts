import { describe, expect, it } from "vitest";

import type { AgentId } from "@nile/core/models/agent/definitions";

import type { WorkspaceProfile } from "../electron/profiles/Store";
import type { DesktopAdvancedState, DesktopAgentState } from "../state/Types";
import { readCurrentProfile, readCurrentProfileIds } from "./CurrentProfile";

describe("CurrentProfile", () => {
  it("prefers the most specific matching profile", () => {
    const agents = [
      createAgent("codex", "codex-personal"),
      createAgent("claude", "claude-work"),
    ];
    const agentHomes = [
      createHome("codex", "/Users/test/.codex", "/tmp/codex-personal"),
      createHome("claude", "/Users/test/.claude", "/Users/test/.claude"),
    ];
    const profiles: WorkspaceProfile[] = [
      {
        id: "profile-connection-only",
        name: "Connection only",
        assignments: [{ agentId: "codex", connectionId: "codex-personal" }],
      },
      {
        id: "profile-connection-and-home",
        name: "Connection and home",
        assignments: [{ agentId: "codex", connectionId: "codex-personal", homePath: "/tmp/codex-personal" }],
      },
    ];

    expect([...readCurrentProfileIds(profiles, agents, agentHomes)]).toEqual(["profile-connection-and-home"]);
    expect(readCurrentProfile(profiles, agents, agentHomes)?.id).toBe("profile-connection-and-home");
  });

  it("treats equally specific matches as ambiguous", () => {
    const agents = [createAgent("codex", "codex-work")];
    const agentHomes = [createHome("codex", "/Users/test/.codex", "/Users/test/.codex")];
    const profiles: WorkspaceProfile[] = [
      {
        id: "profile-a",
        name: "A",
        assignments: [{ agentId: "codex", connectionId: "codex-work" }],
      },
      {
        id: "profile-b",
        name: "B",
        assignments: [{ agentId: "codex", connectionId: "codex-work" }],
      },
    ];

    expect([...readCurrentProfileIds(profiles, agents, agentHomes)]).toEqual([]);
    expect(readCurrentProfile(profiles, agents, agentHomes)).toBeNull();
  });

  it("ignores profiles that do not match the current agent state", () => {
    const agents = [createAgent("codex", "codex-work")];
    const agentHomes = [createHome("codex", "/Users/test/.codex", "/Users/test/.codex")];
    const profiles: WorkspaceProfile[] = [
      {
        id: "profile-personal",
        name: "Personal",
        assignments: [{ agentId: "codex", connectionId: "codex-personal" }],
      },
    ];

    expect([...readCurrentProfileIds(profiles, agents, agentHomes)]).toEqual([]);
    expect(readCurrentProfile(profiles, agents, agentHomes)).toBeNull();
  });
});

function createAgent(agentId: AgentId, connectionId: string): DesktopAgentState {
  return {
    agentId,
    agentLabel: agentId,
    canRollback: false,
    latestRollbackableMutationId: null,
    currentConnection: {
      id: connectionId,
      label: connectionId,
      endpointLabel: connectionId,
      endpointFamily: "openai",
      authMode: "api_key",
      isCurrent: true,
      enabledAgents: [agentId],
      configurableAgents: [agentId],
      selectedByAgents: [agentId],
    },
    currentUsage: null,
    currentConnectionState: "saved",
    liveConnection: null,
    reconciliationState: "already_saved",
    connections: [],
  };
}

function createHome(agentId: AgentId, defaultPath: string, path: string): DesktopAdvancedState["agentHomes"][number] {
  return {
    agentId,
    agentLabel: agentId,
    defaultPath,
    path,
  };
}
