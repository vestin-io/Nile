import { LocalAgentWorkflows } from "@nile/core/application/local/AgentWorkflows";
import {
  LOCAL_MODEL_CATALOG_SOURCE_REGISTRY,
  type LocalModelCatalogSource,
} from "@nile/core/application/local/ModelCatalogSource";
import { LocalConnectionWorkflows } from "@nile/core/application/local/ConnectionWorkflows";
import type { LocalCredentialResolver } from "@nile/core/application/local/LocalCredentialResolver";
import { LocalWorkspaceState } from "@nile/core/application/local/WorkspaceState";
import { CurrentSessionResolver } from "@nile/core/session";
import type { AgentAdapterLookup } from "@nile/core/models/agent";
import type { AgentId } from "@nile/core/models/agent/Definitions";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import type { SavedConnections } from "@nile/core/models/connection/SavedConnections";
import {
  CONNECTION_RUNTIME_REGISTRY,
  type ConnectionCreatorContract,
  type ConnectionModelCatalogContract,
} from "@nile/core/models/connection/Runtime";
import { AgentSelection } from "@nile/core/models/selection/Selection";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { MatchedImportStateSnapshot } from "@nile/core/runtime-local/import-state";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import type { SessionRuntimeOptions } from "./Types";
import { RecoveringUsage } from "./RecoveringUsage";

export class SessionWorkspaceResources {
  private workspaceState: LocalWorkspaceState | null = null;
  private agentSelection: AgentSelection | null = null;
  private agentConnectionSettings: AgentConnectionSettings | null = null;
  private savedConnections: SavedConnections | null = null;
  private connectionCreator: ConnectionCreatorContract | null = null;
  private localConnectionWorkflows: LocalConnectionWorkflows | null = null;
  private connectionModelCatalog: ConnectionModelCatalogContract | null = null;
  private localModelCatalogSources: LocalModelCatalogSource[] | null = null;
  private agentActions: LocalAgentWorkflows | null = null;
  private usage: RecoveringUsage | null = null;

  constructor(
    private readonly options: SessionRuntimeOptions,
    private readonly createLocalCredentialResolver: () => LocalCredentialResolver,
  ) {}

  getSavedConnections(): SavedConnections {
    return (this.savedConnections ??= this.getWorkspaceState().createSavedConnections(this.getAgentSelection()));
  }

  getConnectionCreator(): ConnectionCreatorContract {
    return (this.connectionCreator ??= this.getWorkspaceState().createConnectionCreator());
  }

  getLocalConnectionWorkflows(): LocalConnectionWorkflows {
    return (this.localConnectionWorkflows ??= new LocalConnectionWorkflows(
      this.getSavedConnections(),
      this.getConnectionCreator(),
      this.createLocalCredentialResolver,
    ));
  }

  getAgentActions(agentAdapterRegistry: AgentAdapterLookup): LocalAgentWorkflows {
    return (this.agentActions ??= new LocalAgentWorkflows(
      this.getWorkspaceState().getEndpointRegistry(),
      this.getWorkspaceState().getAccessRegistry(),
      this.getAgentSelection(),
      agentAdapterRegistry,
    ));
  }

  getUsage(): RecoveringUsage {
    return (this.usage ??= new RecoveringUsage(
      this.getWorkspaceState().createUsage(),
      this.getWorkspaceState().getAccessRegistry(),
      new CurrentSessionResolver(
        this.options.agentHomes,
        this.options.environment ?? EnvironmentSource.empty(),
      ),
      this.options.logger ?? NileLogger.silent(),
    ));
  }

  getConnectionModelCatalog(connectionId: string) {
    return this.getConnectionModelCatalogReader().read(connectionId);
  }

  getAgentConnectionModel(agentId: AgentId, connectionId: string): string | null {
    return this.getAgentConnectionSettings().get(agentId, connectionId.trim())?.modelId ?? null;
  }

  setAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): string | null {
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

  clearConnectionArtifacts(connectionId: string): void {
    this.getWorkspaceState().clearConnectionArtifacts(connectionId);
  }

  captureMatchedImportState(agentId: AgentId, connectionId: string): MatchedImportStateSnapshot {
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
      modelSetting: this.getAgentConnectionSettings().get(agentId, normalizedConnectionId),
    };
  }

  restoreMatchedImportState(snapshot: MatchedImportStateSnapshot): void {
    this.getWorkspaceState().getEndpointRegistry().update(snapshot.endpointId, {
      protocols: snapshot.endpointProtocols,
    });
    this.getWorkspaceState().getAccessRegistry().update(snapshot.connectionId, {
      identityKey: snapshot.identityKey,
    });
    this.getWorkspaceState().getAccessRegistry().syncCredential(snapshot.connectionId, snapshot.credential);

    if (snapshot.selection) {
      this.getAgentSelection().setApplied(
        snapshot.selection.agentId,
        snapshot.selection.connectionId,
        snapshot.selection.appliedAt,
      );
    } else {
      this.getAgentSelection().clear(snapshot.agentId);
    }

    if (snapshot.modelSetting) {
      this.getAgentConnectionSettings().setModelId(
        snapshot.modelSetting.agentId,
        snapshot.modelSetting.connectionId,
        snapshot.modelSetting.modelId,
      );
      return;
    }

    this.getAgentConnectionSettings().clear(snapshot.agentId, snapshot.connectionId);
  }

  createAgentWorkspaceContext(): AgentWorkspaceContext {
    const workspaceState = this.getWorkspaceState();
    return {
      databasePath: workspaceState.databasePath,
      database: workspaceState.database,
      endpointRegistry: workspaceState.getEndpointRegistry(),
      accessRegistry: workspaceState.getAccessRegistry(),
      agentSelection: this.getAgentSelection(),
      agentConnectionSettings: this.getAgentConnectionSettings(),
    };
  }

  private getWorkspaceState(): LocalWorkspaceState {
    return (this.workspaceState ??= LocalWorkspaceState.fromDatabase(
      this.options.database,
      this.options.credentialStore,
      undefined,
      this.options.databasePath,
    ));
  }

  private getAgentSelection(): AgentSelection {
    return (this.agentSelection ??= AgentSelection.fromDatabase(this.options.database));
  }

  private getAgentConnectionSettings(): AgentConnectionSettings {
    return (this.agentConnectionSettings ??= AgentConnectionSettings.fromDatabase(this.options.database));
  }

  private getConnectionModelCatalogReader(): ConnectionModelCatalogContract {
    return (this.connectionModelCatalog ??= CONNECTION_RUNTIME_REGISTRY.read().createModelCatalog({
      endpointRegistry: this.getWorkspaceState().getEndpointRegistry(),
      accessRegistry: this.getWorkspaceState().getAccessRegistry(),
      environment: this.options.environment ?? EnvironmentSource.empty(),
      localModelCatalogSources: this.getLocalModelCatalogSources(),
    }));
  }

  private getLocalModelCatalogSources(): LocalModelCatalogSource[] {
    return (this.localModelCatalogSources ??= LOCAL_MODEL_CATALOG_SOURCE_REGISTRY.createAll(
      this.options.agentHomes,
    ));
  }
}
