import type { AgentHomes } from "../models/agent/Homes";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import { NileLogger } from "../services/NileLogger";
import type { AgentAdapter } from "../models/agent";
import type { CredentialStore } from "../services/credential/Store";
import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";
import { AGENT_FACTORY_REGISTRY } from "./AgentFactoryRegistry";

export type BuiltInAgentAdapterOptions = {
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  agentHomes?: AgentHomes;
};

export class BuiltInAgentAdapters {
  static create(
    databasePath: string,
    options: BuiltInAgentAdapterOptions,
    sharedContext?: AgentWorkspaceContext,
  ): AgentAdapter[] {
    return AGENT_FACTORY_REGISTRY.createAll({
      databasePath,
      credentialStore: options.credentialStore,
      agentHomes: options.agentHomes,
      environment: options.environment,
      secureSnapshotStore: options.secureSnapshotStore,
      logger: options.logger,
      sharedContext,
    });
  }

  static fromSharedContext(
    context: AgentWorkspaceContext,
    options: BuiltInAgentAdapterOptions,
  ): AgentAdapter[] {
    return BuiltInAgentAdapters.create(context.databasePath, options, context);
  }
}
