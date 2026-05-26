import { describe, expect, it } from "vitest";

import type { AgentStatusView } from "@nile/core/actions/local-setup";
import { SUPPORTED_AGENT_IDS, type AgentId } from "@nile/core/models/agent/definitions";
import type { NileLogger } from "@nile/core/services/NileLogger";
import type { NileSession } from "@nile/builtins/runtime";

import { DesktopConnectionListPresenter } from "./connection/List";
import { DesktopConnectionStatusPresenter } from "./connection/Status";
import { DesktopStatusEntryStateQuery } from "./StatusEntryQuery";
import { DesktopUsageCache } from "./UsageCache";

describe("DesktopStatusEntryStateQuery", () => {
  it("reads agent status in one batched session call", async () => {
    let getAgentStatusCallCount = 0;
    let listAgentStatusesCallCount = 0;
    const session = {
      listSavedConnections() {
        return [];
      },
      getAgentStatus() {
        getAgentStatusCallCount += 1;
        throw new Error("Desktop status-entry query should not call getAgentStatus per agent");
      },
      listAgentStatuses(agentIds?: AgentId[]) {
        listAgentStatusesCallCount += 1;
        return (agentIds ?? [...SUPPORTED_AGENT_IDS]).map((agentId) => createStatus(agentId));
      },
    } as unknown as NileSession;
    const logger = {
      info() {},
      warn() {},
    } as unknown as NileLogger;

    const query = new DesktopStatusEntryStateQuery(
      new DesktopConnectionListPresenter(),
      new DesktopConnectionStatusPresenter(),
      new DesktopUsageCache(logger),
    );

    const state = await query.read(session);

    expect(state.agents).toHaveLength(SUPPORTED_AGENT_IDS.length);
    expect(getAgentStatusCallCount).toBe(0);
    expect(listAgentStatusesCallCount).toBe(1);
  });
});

function createStatus(agentId: AgentId): AgentStatusView {
  return {
    agent: agentId,
    currentConnection: null,
    currentConnectionState: "none",
    liveConnection: null,
    reconciliation: {
      state: "unavailable",
      hasLiveSetup: false,
    },
  };
}
