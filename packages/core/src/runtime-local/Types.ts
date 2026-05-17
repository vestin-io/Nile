import type { AgentAdapter } from "../models/agent/Adapter";
import type { AgentId } from "../models/agent/Ids";
import type { AgentHomes } from "../models/agent/Homes";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import { NileLogger } from "../services/NileLogger";
import type { CredentialStore } from "../services/credential/Store";
import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";

export type RuntimeFactoryInput = {
  databasePath: string;
  credentialStore: CredentialStore;
  agentHomes?: AgentHomes;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: AgentWorkspaceContext;
};

export type AgentFactoryRegistration = {
  agentId: AgentId;
  create(input: RuntimeFactoryInput): AgentAdapter;
};
