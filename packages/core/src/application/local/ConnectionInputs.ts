import type { LocalCredentialRequest } from "./LocalCredentialResolver";
import type { AgentId } from "../../models/agent/Types";

export type CreateLocalConnectionInput = {
  preset: "openai" | "gateway" | "azure-openai" | "anthropic";
  authMode: "api_key" | "openai_session" | "claude_session" | "cursor_session";
  label?: string;
  endpointUrl?: string;
  openclawModelId?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
  credentialRequest: LocalCredentialRequest;
};

export type RemoveConnectionResult = {
  id: string;
  removed: true;
  clearedAgents: AgentId[];
};

export type UpdateConnectionInput = {
  connectionId: string;
  label?: string;
  enabledAgents?: AgentId[];
  openclawModelId?: string | null;
  endpointUrl?: string;
  credentialRequest?: LocalCredentialRequest;
};
