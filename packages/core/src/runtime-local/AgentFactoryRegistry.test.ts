import { describe, expect, it } from "vitest";

import { SUPPORTED_AGENT_IDS } from "../models/agent";
import { AGENT_FACTORY_REGISTRY } from "./AgentFactoryRegistry";

describe("AgentFactoryRegistry", () => {
  it("registers one runtime factory per supported agent", () => {
    expect(AGENT_FACTORY_REGISTRY.list().map((entry) => entry.agentId)).toEqual(SUPPORTED_AGENT_IDS);
  });
});
