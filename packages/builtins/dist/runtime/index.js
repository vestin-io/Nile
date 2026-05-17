// src/runtime/NileSession.ts
import { LocalCredentialResolver } from "@nile/core/application/local/LocalCredentialResolver";
import { defaultAgentHomes, mergeAgentHomes } from "@nile/core/models/agent/Homes";
import { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";
import {
  EnvironmentSource as EnvironmentSource2
} from "@nile/core/services/EnvironmentSource";

// src/runtime/SessionResources.ts
import { BuiltInAgentAdapters } from "@nile/core/runtime-local/BuiltInAdapters";
import { AgentAdapterRegistry } from "@nile/core/runtime-local/AgentAdapterRegistry";

// src/runtime/SessionHistoryResources.ts
import { MutationHistory } from "@nile/core/services/history/MutationHistory";
var SessionHistoryResources = class {
  constructor(options) {
    this.options = options;
  }
  history = null;
  getLatestRollbackableMutation(agentId, scope) {
    return this.getMutationHistory(scope).findLatestRollbackCandidate(agentId);
  }
  listMutationHistory(limit, scope) {
    return this.getMutationHistory(scope).list(limit);
  }
  getMutationHistory(scope) {
    if (!scope) {
      return this.history ??= this.createMutationHistory("mutation-history");
    }
    return this.createMutationHistory(scope);
  }
  createMutationHistory(scope) {
    return MutationHistory.fromDatabase(this.options.databasePath, this.options.database, {
      secureSnapshotStore: this.options.secureSnapshotStore,
      logger: scope ? this.options.logger?.child({ scope }) : this.options.logger
    });
  }
};

// src/runtime/SessionWorkspaceResources.ts
import { LocalAgentWorkflows } from "@nile/core/application/local/AgentWorkflows";
import {
  LOCAL_MODEL_CATALOG_SOURCE_REGISTRY
} from "@nile/core/application/local/ModelCatalogSource";
import { LocalConnectionWorkflows } from "@nile/core/application/local/ConnectionWorkflows";
import { LocalWorkspaceState } from "@nile/core/application/local/WorkspaceState";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import {
  CONNECTION_RUNTIME_REGISTRY
} from "@nile/core/models/connection/Runtime";
import { AgentSelection } from "@nile/core/models/selection/Selection";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
var SessionWorkspaceResources = class {
  constructor(options, createLocalCredentialResolver) {
    this.options = options;
    this.createLocalCredentialResolver = createLocalCredentialResolver;
  }
  workspaceState = null;
  agentSelection = null;
  agentConnectionSettings = null;
  savedConnections = null;
  connectionCreator = null;
  localConnectionWorkflows = null;
  connectionModelCatalog = null;
  localModelCatalogSources = null;
  agentActions = null;
  usage = null;
  getSavedConnections() {
    return this.savedConnections ??= this.getWorkspaceState().createSavedConnections(this.getAgentSelection());
  }
  getConnectionCreator() {
    return this.connectionCreator ??= this.getWorkspaceState().createConnectionCreator();
  }
  getLocalConnectionWorkflows() {
    return this.localConnectionWorkflows ??= new LocalConnectionWorkflows(
      this.getSavedConnections(),
      this.getConnectionCreator(),
      this.createLocalCredentialResolver
    );
  }
  getAgentActions(agentAdapterRegistry) {
    return this.agentActions ??= new LocalAgentWorkflows(
      this.getWorkspaceState().getEndpointRegistry(),
      this.getWorkspaceState().getAccessRegistry(),
      this.getAgentSelection(),
      agentAdapterRegistry
    );
  }
  getUsage() {
    return this.usage ??= this.getWorkspaceState().createUsage();
  }
  getConnectionModelCatalog(connectionId) {
    return this.getConnectionModelCatalogReader().read(connectionId);
  }
  getAgentConnectionModel(agentId, connectionId) {
    return this.getAgentConnectionSettings().get(agentId, connectionId.trim())?.modelId ?? null;
  }
  setAgentConnectionModel(agentId, connectionId, modelId) {
    const normalizedConnectionId = connectionId.trim();
    if (!normalizedConnectionId) {
      throw new Error("Connection id is required");
    }
    const normalizedModelId = modelId?.trim() ?? "";
    if (!normalizedModelId) {
      this.getAgentConnectionSettings().clear(agentId, normalizedConnectionId);
      return null;
    }
    return this.getAgentConnectionSettings().setModelId(agentId, normalizedConnectionId, normalizedModelId).modelId;
  }
  clearConnectionArtifacts(connectionId) {
    this.getWorkspaceState().clearConnectionArtifacts(connectionId);
  }
  captureMatchedImportState(agentId, connectionId) {
    const normalizedConnectionId = connectionId.trim();
    if (!normalizedConnectionId) {
      throw new Error("Connection id is required");
    }
    const accessRegistry = this.getWorkspaceState().getAccessRegistry();
    const endpointRegistry = this.getWorkspaceState().getEndpointRegistry();
    const access = accessRegistry.get(normalizedConnectionId);
    if (!access) {
      throw new Error(`Connection not found: ${normalizedConnectionId}`);
    }
    const endpoint = endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${access.endpointId}`);
    }
    return {
      agentId,
      connectionId: normalizedConnectionId,
      endpointId: endpoint.id,
      endpointProtocols: endpoint.protocols,
      identityKey: access.identityKey ?? null,
      credential: accessRegistry.readCredential(normalizedConnectionId),
      selection: this.getAgentSelection().get(agentId),
      modelSetting: this.getAgentConnectionSettings().get(agentId, normalizedConnectionId)
    };
  }
  restoreMatchedImportState(snapshot) {
    this.getWorkspaceState().getEndpointRegistry().update(snapshot.endpointId, {
      protocols: snapshot.endpointProtocols
    });
    this.getWorkspaceState().getAccessRegistry().update(snapshot.connectionId, {
      identityKey: snapshot.identityKey
    });
    this.getWorkspaceState().getAccessRegistry().syncCredential(snapshot.connectionId, snapshot.credential);
    if (snapshot.selection) {
      this.getAgentSelection().setApplied(
        snapshot.selection.agentId,
        snapshot.selection.connectionId,
        snapshot.selection.appliedAt
      );
    } else {
      this.getAgentSelection().clear(snapshot.agentId);
    }
    if (snapshot.modelSetting) {
      this.getAgentConnectionSettings().setModelId(
        snapshot.modelSetting.agentId,
        snapshot.modelSetting.connectionId,
        snapshot.modelSetting.modelId
      );
      return;
    }
    this.getAgentConnectionSettings().clear(snapshot.agentId, snapshot.connectionId);
  }
  createAgentWorkspaceContext() {
    const workspaceState = this.getWorkspaceState();
    return {
      databasePath: workspaceState.databasePath,
      database: workspaceState.database,
      endpointRegistry: workspaceState.getEndpointRegistry(),
      accessRegistry: workspaceState.getAccessRegistry(),
      agentSelection: this.getAgentSelection(),
      agentConnectionSettings: this.getAgentConnectionSettings()
    };
  }
  getWorkspaceState() {
    return this.workspaceState ??= LocalWorkspaceState.fromDatabase(
      this.options.database,
      this.options.credentialStore,
      void 0,
      this.options.databasePath
    );
  }
  getAgentSelection() {
    return this.agentSelection ??= AgentSelection.fromDatabase(this.options.database);
  }
  getAgentConnectionSettings() {
    return this.agentConnectionSettings ??= AgentConnectionSettings.fromDatabase(this.options.database);
  }
  getConnectionModelCatalogReader() {
    return this.connectionModelCatalog ??= CONNECTION_RUNTIME_REGISTRY.read().createModelCatalog({
      endpointRegistry: this.getWorkspaceState().getEndpointRegistry(),
      accessRegistry: this.getWorkspaceState().getAccessRegistry(),
      environment: this.options.environment ?? EnvironmentSource.empty(),
      localModelCatalogSources: this.getLocalModelCatalogSources()
    });
  }
  getLocalModelCatalogSources() {
    return this.localModelCatalogSources ??= LOCAL_MODEL_CATALOG_SOURCE_REGISTRY.createAll(
      this.options.agentHomes
    );
  }
};

// src/runtime/SessionResources.ts
var SessionResources = class {
  constructor(options, createLocalCredentialResolver) {
    this.options = options;
    this.workspace = new SessionWorkspaceResources(options, createLocalCredentialResolver);
    this.history = new SessionHistoryResources(options);
  }
  adapterRegistry = null;
  workspace;
  history;
  getSavedConnections() {
    return this.workspace.getSavedConnections();
  }
  getConnectionCreator() {
    return this.workspace.getConnectionCreator();
  }
  getLocalConnectionWorkflows() {
    return this.workspace.getLocalConnectionWorkflows();
  }
  getAgentAdapterRegistry() {
    return this.adapterRegistry ??= AgentAdapterRegistry.fromAdapters(
      BuiltInAgentAdapters.fromSharedContext(
        this.workspace.createAgentWorkspaceContext(),
        {
          credentialStore: this.options.credentialStore,
          environment: this.options.environment,
          secureSnapshotStore: this.options.secureSnapshotStore,
          logger: this.options.logger,
          agentHomes: this.options.agentHomes
        }
      )
    );
  }
  getAgentActions() {
    return this.workspace.getAgentActions(this.getAgentAdapterRegistry());
  }
  getUsage() {
    return this.workspace.getUsage();
  }
  getConnectionModelCatalog(connectionId) {
    return this.workspace.getConnectionModelCatalog(connectionId);
  }
  getLatestRollbackableMutation(agentId, scope) {
    return this.history.getLatestRollbackableMutation(agentId, scope);
  }
  listMutationHistory(limit, scope) {
    return this.history.listMutationHistory(limit, scope);
  }
  getAgentConnectionModel(agentId, connectionId) {
    return this.workspace.getAgentConnectionModel(agentId, connectionId);
  }
  setAgentConnectionModel(agentId, connectionId, modelId) {
    return this.workspace.setAgentConnectionModel(agentId, connectionId, modelId);
  }
  clearConnectionArtifacts(connectionId) {
    this.workspace.clearConnectionArtifacts(connectionId);
  }
  captureMatchedImportState(agentId, connectionId) {
    return this.workspace.captureMatchedImportState(agentId, connectionId);
  }
  restoreMatchedImportState(snapshot) {
    this.workspace.restoreMatchedImportState(snapshot);
  }
};

// src/runtime/NileSession.ts
var NileSession = class _NileSession {
  constructor(resources, createLocalCredentialResolver, closeDatabase) {
    this.resources = resources;
    this.createLocalCredentialResolver = createLocalCredentialResolver;
    this.closeDatabase = closeDatabase;
  }
  static open(options) {
    const database = SqliteDatabase.open(options.databasePath);
    const runtimeOptions = {
      databasePath: options.databasePath,
      database,
      credentialStore: options.credentialStore,
      agentHomes: mergeAgentHomes(defaultAgentHomes(), options.agentHomes),
      environment: options.environment,
      secureSnapshotStore: options.secureSnapshotStore,
      logger: options.logger
    };
    const createLocalCredentialResolver = () => new LocalCredentialResolver(
      runtimeOptions.agentHomes,
      runtimeOptions.environment ?? EnvironmentSource2.empty()
    );
    const resources = new SessionResources(runtimeOptions, createLocalCredentialResolver);
    return new _NileSession(resources, createLocalCredentialResolver, () => database.close());
  }
  listSavedConnections() {
    return this.resources.getSavedConnections().list();
  }
  listSavedConnectionsForAgent(agentId) {
    return this.resources.getSavedConnections().listForAgent(agentId);
  }
  readConnectionCredential(connectionId) {
    return this.resources.getSavedConnections().readCredential(connectionId);
  }
  setConnectionDirectApiKeyEnvKey(connectionId, envKey) {
    return this.resources.getSavedConnections().setDirectApiKeyEnvKey(connectionId, envKey);
  }
  removeConnection(connectionId) {
    this.resources.clearConnectionArtifacts(connectionId);
    return this.resources.getSavedConnections().remove(connectionId);
  }
  async updateConnection(input) {
    return await this.resources.getLocalConnectionWorkflows().update(input, this.createLocalCredentialResolver());
  }
  useConnection(agentId, connectionId) {
    return this.resources.getAgentAdapterRegistry().get(agentId).applySelection(connectionId);
  }
  getAgentStatus(agentId) {
    const detections = this.resources.getAgentActions().selectionSync.run([agentId]);
    return this.resources.getAgentActions().status.get(agentId, detections.get(agentId));
  }
  listAgentStatuses(agentIds) {
    const detections = this.resources.getAgentActions().selectionSync.run(agentIds);
    return this.resources.getAgentActions().status.list(agentIds, detections);
  }
  scanLocalSetups(agentIds) {
    const detections = this.resources.getAgentActions().selectionSync.run(agentIds);
    return this.resources.getAgentActions().scanLocal.run(agentIds, detections);
  }
  async importDetectedSetups(input) {
    return await this.resources.getAgentActions().importDetectedSetups.run(input);
  }
  getConnectionUsage(connectionId) {
    return this.resources.getUsage().get(connectionId);
  }
  getConnectionModelCatalog(connectionId) {
    return this.resources.getConnectionModelCatalog(connectionId);
  }
  getAgentConnectionModel(agentId, connectionId) {
    return this.resources.getAgentConnectionModel(agentId, connectionId);
  }
  setAgentConnectionModel(agentId, connectionId, modelId) {
    return this.resources.setAgentConnectionModel(agentId, connectionId, modelId);
  }
  captureMatchedImportState(agentId, connectionId) {
    return this.resources.captureMatchedImportState(agentId, connectionId);
  }
  restoreMatchedImportState(snapshot) {
    this.resources.restoreMatchedImportState(snapshot);
  }
  async describeConnectionOnboarding(input) {
    return await this.resources.getConnectionCreator().describeOnboarding(input);
  }
  async createConnection(input) {
    return await this.resources.getConnectionCreator().create(input);
  }
  async createLocalConnection(input, localCredentialResolver = this.createLocalCredentialResolver()) {
    return await this.resources.getLocalConnectionWorkflows().createLocalWithResolver(input, localCredentialResolver);
  }
  async describeLocalConnectionOnboarding(input, localCredentialResolver = this.createLocalCredentialResolver()) {
    return await this.resources.getLocalConnectionWorkflows().describeLocalOnboardingWithResolver(
      input,
      localCredentialResolver
    );
  }
  async importCurrentConnection(agentId) {
    return await this.resources.getAgentAdapterRegistry().get(agentId).importCurrentConnection();
  }
  rollbackLatestMutation(agentId) {
    return this.resources.getAgentAdapterRegistry().get(agentId).rollbackLatestMutation();
  }
  listAgentRollbackSupport() {
    return this.resources.getAgentAdapterRegistry().listRollbackSupport();
  }
  getLatestRollbackableMutation(agentId, scope) {
    return this.resources.getLatestRollbackableMutation(agentId, scope);
  }
  listMutationHistory(limit = 20, scope) {
    return this.resources.listMutationHistory(limit, scope);
  }
  close() {
    this.closeDatabase();
  }
};

// src/runtime/SessionWork.ts
function runWithSession(openSession, work) {
  const session = openSession();
  try {
    return work(session);
  } finally {
    session.close();
  }
}
async function runWithSessionAsync(openSession, work) {
  const session = openSession();
  try {
    return await work(session);
  } finally {
    session.close();
  }
}
export {
  NileSession,
  runWithSession,
  runWithSessionAsync
};
