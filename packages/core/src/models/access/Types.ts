import type { CredentialSource } from "../../services/credential/Source";
import type { CredentialStorageBackend } from "../../services/credential/Store";
import type { AuthMode } from "./AuthMode";
import type { AgentId } from "../agent";

export type AccessRegistryInput = {
  id: string;
  endpointId: string;
  label: string;
  authMode: AuthMode;
  identityKey?: string;
  credentialStorageBackend?: CredentialStorageBackend;
  enabledAgents?: AgentId[];
};

export type AccessRegistryUpdate = {
  endpointId?: string;
  label?: string;
  authMode?: AuthMode;
  identityKey?: string | null;
  credentialStorageBackend?: CredentialStorageBackend;
  enabledAgents?: AgentId[];
};

export type AccessCredentialSyncState =
  | "ready"
  | "pending_write"
  | "write_failed"
  | "pending_delete"
  | "delete_failed";

export type AccessRecord = {
  id: string;
  endpointId: string;
  label: string;
  authMode: AuthMode;
  identityKey?: string;
  apiKeySource?: "direct" | "env_key";
  envKey?: string;
  enabledAgents: AgentId[];
  credentialSource: CredentialSource;
  credentialStorageBackend?: CredentialStorageBackend;
  credentialSyncIssue?: string;
  credentialSyncState?: AccessCredentialSyncState;
  createdAt: string;
  updatedAt: string;
};
