import type { AgentId } from "@nile/core/models/agent";

export type DesktopAppBridge = {
  openGitHubIssues(): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  openSettings(): Promise<void>;
  openSupportEmail(): Promise<void>;
  updateAgentHome(agentId: AgentId, path: string | null): Promise<void>;
  updateAgentRuntimeCommand(agentId: AgentId, path: string | null): Promise<void>;
};
