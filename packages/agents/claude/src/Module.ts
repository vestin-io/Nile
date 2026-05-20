import type { AgentModule } from "@nile/core/models/agent/module/Types";
import { CLAUDE_CURRENT_SESSION_SOURCE } from "./CurrentSessionSource";
import { CLAUDE_LOCAL_RUNTIME_INFO } from "./LocalRuntimeInfo";
import { CLAUDE_LOGIN_SOURCE } from "./LoginSource";
import { CLAUDE_MANIFEST } from "./Manifest";
import { CLAUDE_MODEL_CATALOG_SOURCE } from "./ModelCatalogSource";
import { CLAUDE_PROJECTION } from "./Projection";
import { CLAUDE_RUNTIME_FACTORY } from "./RuntimeFactory";

export const CLAUDE_AGENT_MODULE: AgentModule = {
  get manifest() { return CLAUDE_MANIFEST; },
  get runtimeFactory() { return CLAUDE_RUNTIME_FACTORY; },
  get projection() { return CLAUDE_PROJECTION; },
  get currentSessionSource() { return CLAUDE_CURRENT_SESSION_SOURCE; },
  get interactiveSessionLogin() { return CLAUDE_LOGIN_SOURCE; },
  get localRuntimeInfo() { return CLAUDE_LOCAL_RUNTIME_INFO; },
  get localModelCatalogSources() { return [CLAUDE_MODEL_CATALOG_SOURCE]; },
};
