import type { AgentProjection } from "@nile/core/projection";

export type CursorProjection = AgentProjection & {
  agentId: "cursor";
  protocol: "cursor";
  authMode: "api_key" | "cursor_session";
  backendUrl: string;
};
