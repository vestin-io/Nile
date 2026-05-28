import type { AgentModule } from "@nile/core/models/agent/module/Types";
import { OPENCODE_LOCAL_RUNTIME_INFO } from "./LocalRuntimeInfo";
import { OPENCODE_MANIFEST } from "./Manifest";
import { OPENCODE_PROJECTION } from "./Projection";
import { OPENCODE_RUNTIME_FACTORY } from "./RuntimeFactory";

export const OPENCODE_AGENT_MODULE: AgentModule = {
  get manifest() { return OPENCODE_MANIFEST; },
  get runtimeFactory() { return OPENCODE_RUNTIME_FACTORY; },
  get projection() { return OPENCODE_PROJECTION; },
  get localRuntimeInfo() { return OPENCODE_LOCAL_RUNTIME_INFO; },
};
