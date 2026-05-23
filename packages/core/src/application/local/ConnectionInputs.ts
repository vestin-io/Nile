import type { LocalCredentialRequest } from "./CredentialRequest";
import type { AgentId } from "../../models/agent/Definitions";
import type { ConnectionPresetFamily } from "../../models/connection/preset";
import type { CredentialStorageBackend } from "../../services/credential/Store";

export type CreateLocalConnectionInput = {
  preset: ConnectionPresetFamily;
  authMode: "api_key" | "openai_session" | "claude_session" | "cursor_session" | "gemini_cli_session";
  label?: string;
  endpointUrl?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
  credentialStorageBackend?: CredentialStorageBackend;
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
  endpointUrl?: string;
  credentialRequest?: LocalCredentialRequest;
};
