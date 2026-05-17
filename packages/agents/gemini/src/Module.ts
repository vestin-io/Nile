import type { AgentModule } from "@nile/core/models/agent/module/Types";
import { GEMINI_CURRENT_SESSION_SOURCE } from "./CurrentSessionSource";
import { GEMINI_LOGIN_SOURCE } from "./LoginSource";
import { GEMINI_MANIFEST } from "./Manifest";
import { GEMINI_PROJECTION } from "./Projection";
import { GEMINI_RUNTIME_FACTORY } from "./RuntimeFactory";

export const GEMINI_AGENT_MODULE: AgentModule = {
  get manifest() { return GEMINI_MANIFEST; },
  get runtimeFactory() { return GEMINI_RUNTIME_FACTORY; },
  get projection() { return GEMINI_PROJECTION; },
  get currentSessionSource() { return GEMINI_CURRENT_SESSION_SOURCE; },
  get interactiveSessionLogin() { return GEMINI_LOGIN_SOURCE; },
};
