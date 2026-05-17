import type { AgentId } from "../models/agent/Ids";
import type { AccessRecord } from "../models/access";
import type { EndpointRecord } from "../models/endpoint";
import type { StoredCredential } from "../services/credential/Types";

export type ProjectionInput = {
  endpoint: EndpointRecord;
  access: AccessRecord;
  credential: StoredCredential;
  modelId?: string;
};

export type AgentProjection = {
  agentId: AgentId;
  endpointId: string;
  endpointLabel: string;
  accessId: string;
  accessLabel: string;
  modelId?: string;
};
export type AgentProjectionRegistration<TProjection extends AgentProjection = AgentProjection> = {
  agentId: AgentId;
  resolve(input: ProjectionInput): TProjection;
};
