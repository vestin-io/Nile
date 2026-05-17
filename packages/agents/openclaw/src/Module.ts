import type { AgentModule } from "@nile/core/models/agent/module/Types";
import { OPENCLAW_MANIFEST } from "./Manifest";
import { OPENCLAW_PROJECTION } from "./Projection";
import { OPENCLAW_RUNTIME_FACTORY } from "./RuntimeFactory";

export const OPENCLAW_AGENT_MODULE: AgentModule = {
  get manifest() { return OPENCLAW_MANIFEST; },
  get runtimeFactory() { return OPENCLAW_RUNTIME_FACTORY; },
  get projection() { return OPENCLAW_PROJECTION; },
};
