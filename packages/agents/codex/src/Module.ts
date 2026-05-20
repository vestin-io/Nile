import type { AgentModule } from "@nile/core/models/agent/module/Types";
import { CODEX_CURRENT_SESSION_SOURCE } from "./CurrentSessionSource";
import { CODEX_LOGIN_SOURCE } from "./LoginSource";
import { CODEX_LOCAL_RUNTIME_INFO } from "./LocalRuntimeInfo";
import { CODEX_MANIFEST } from "./Manifest";
import { CODEX_PROJECTION } from "./Projection";
import { CODEX_RUNTIME_FACTORY } from "./RuntimeFactory";

export const CODEX_AGENT_MODULE: AgentModule = {
  get manifest() { return CODEX_MANIFEST; },
  get runtimeFactory() { return CODEX_RUNTIME_FACTORY; },
  get projection() { return CODEX_PROJECTION; },
  get currentSessionSource() { return CODEX_CURRENT_SESSION_SOURCE; },
  get interactiveSessionLogin() { return CODEX_LOGIN_SOURCE; },
  get localRuntimeInfo() { return CODEX_LOCAL_RUNTIME_INFO; },
};
