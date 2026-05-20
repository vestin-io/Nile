import type { AgentModule } from "@nile/core/models/agent/module/Types";
import { CURSOR_CURRENT_SESSION_SOURCE } from "./CurrentSessionSource";
import { CURSOR_LOCAL_RUNTIME_INFO } from "./LocalRuntimeInfo";
import { CURSOR_MANIFEST } from "./Manifest";
import { CURSOR_PROJECTION } from "./Projection";
import { CURSOR_RUNTIME_FACTORY } from "./RuntimeFactory";
import { CURSOR_LOCAL_CONNECTION_SUPPORT_FACTORY } from "./usage/LocalCursorOpsImpl";

export const CURSOR_AGENT_MODULE: AgentModule = {
  get manifest() { return CURSOR_MANIFEST; },
  get runtimeFactory() { return CURSOR_RUNTIME_FACTORY; },
  get projection() { return CURSOR_PROJECTION; },
  get currentSessionSource() { return CURSOR_CURRENT_SESSION_SOURCE; },
  get localRuntimeInfo() { return CURSOR_LOCAL_RUNTIME_INFO; },
  get localConnectionSupportFactory() { return CURSOR_LOCAL_CONNECTION_SUPPORT_FACTORY; },
};
