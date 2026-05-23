import type { AuthMode } from "../access";
import type { EndpointFamily } from "../endpoint";
import type { AgentSelectionRecord } from "../selection/Types";
import type { AgentId } from "./Ids";
import type { CredentialStorageBackend } from "../../services/credential/Store";

export type AgentCapabilitySupport = "yes" | "partial" | "no";

export type AgentLiveStateValidity =
  | "invalid_structure"
  | "invalid_semantics"
  | "valid_unverified"
  | "valid_matched"
  | "valid_import_candidate";

export type DetectedAgentEndpoint = {
  endpointFamily: EndpointFamily | "unknown";
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  wireApi?: string;
  envKey?: string;
};

export type DetectedAgentAccess = {
  authMode: AuthMode | "unknown";
  labelHint: string;
  identityKey?: string;
};

export type MatchedAgentConnection = {
  connectionId: string;
  endpointId: string;
  accessId: string;
  matchesAgentSelection: boolean;
};

export type DetectedAgentState = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: DetectedAgentEndpoint | null;
  access: DetectedAgentAccess | null;
  modelId?: string;
  matchedConnection: MatchedAgentConnection | null;
};

export type AgentDetectionResult = {
  agentSelection: AgentSelectionRecord | null;
  detectedState: DetectedAgentState;
};

export type ApplyAgentSelectionResult = {
  agentId: AgentId;
  connectionId: string;
  connectionLabel: string;
  endpointId: string;
  endpointLabel: string;
  accessId: string;
  appliedAt: string;
};

export type ImportCurrentConnectionResult = {
  id: string;
  label: string;
  endpointId: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily;
  authMode: AuthMode;
  reused?: boolean;
};

export type ImportCurrentConnectionInput = {
  credentialStorageBackend?: CredentialStorageBackend;
};

export type RollbackLatestAgentResult = {
  agentId: AgentId;
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

export interface AgentAdapter {
  readonly agentId: AgentId;
  readonly rollbackSupport: AgentCapabilitySupport;

  detectAgentSelection(): AgentDetectionResult;
  applySelection(connectionId: string): ApplyAgentSelectionResult;
  importCurrentConnection(input?: ImportCurrentConnectionInput): Promise<ImportCurrentConnectionResult>;
  rollbackLatestMutation(): RollbackLatestAgentResult;
}

export interface AgentAdapterLookup {
  get(agentId: AgentId): Pick<AgentAdapter, "detectAgentSelection" | "importCurrentConnection">;
  listAgents(): AgentId[];
}
