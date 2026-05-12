import { join } from "node:path";

import { LocalAgentWorkflows } from "../application/local/AgentWorkflows";
import { ConnectionModelCatalog } from "../application/local/ConnectionModelCatalog";
import { LocalConnectionWorkflows } from "../application/local/ConnectionWorkflows";
import { ClaudeGatewayModelCatalog } from "../agents/claude/GatewayModelCatalog";
import type { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import { LocalWorkspaceState } from "../application/local/WorkspaceState";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { Usage } from "../actions/usage/Usage";
import type { AgentAdapterLookup } from "../models/agent";
import type { AgentId } from "../models/agent/Types";
import { resolveAgentHome } from "../models/agent/Homes";
import { AgentConnectionSettings } from "../models/agent-settings";
import type { ConnectionCreator } from "../models/connection/Creator";
import type { SavedConnections } from "../models/connection/SavedConnections";
import { AgentSelection } from "../models/selection/Selection";
import { EnvironmentSource } from "../services/EnvironmentSource";
import type { MatchedImportStateSnapshot } from "./ImportState";
import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";
import type { SessionRuntimeOptions } from "./SessionRuntimeOptions";

export class SessionWorkspaceResources {
  private workspaceState: LocalWorkspaceState | null = null;
  private agentSelection: AgentSelection | null = null;
  private agentConnectionSettings: AgentConnectionSettings | null = null;
  private savedConnections: SavedConnections | null = null;
  private connectionCreator: ConnectionCreator | null = null;
  private localConnectionWorkflows: LocalConnectionWorkflows | null = null;
  private connectionModelCatalog: ConnectionModelCatalog | null = null;
  private claudeGatewayModels: ClaudeGatewayModelCatalog | null = null;
  private agentActions: LocalAgentWorkflows | null = null;
  private usage: Usage | null = null;

  constructor(
    private readonly options: SessionRuntimeOptions,
    private readonly createLocalCredentialResolver: () => LocalCredentialResolver,
  ) {}

  getSavedConnections(): SavedConnections {
    return (this.savedConnections ??= this.getWorkspaceState().createSavedConnections(this.getAgentSelection()));
  }

  getConnectionCreator(): ConnectionCreator {
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
      agentAdapterRegistry,
    ));
  }

  getUsage(): Usage {
    return (this.usage ??= this.getWorkspaceState().createUsage());
  }

  getConnectionModelCatalog(connectionId: string) {
    return this.getConnectionModelCatalogReader().read(connectionId);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.getWorkspaceState().createCursorUsageBinder().bind(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.getWorkspaceState().createCursorUsageAutoBinder(this.options.cursorUsageSessionProbe).autoBind(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.getWorkspaceState().createCursorUsageAutoBinder(this.options.cursorUsageSessionProbe).autoBindAllMissing();
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
    this.getWorkspaceState().clearCursorUsageArtifacts(connectionId);
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

  private getConnectionModelCatalogReader(): ConnectionModelCatalog {
    return (this.connectionModelCatalog ??= new ConnectionModelCatalog(
      this.getWorkspaceState().getEndpointRegistry(),
      this.getWorkspaceState().getAccessRegistry(),
      this.options.environment ?? EnvironmentSource.empty(),
      this.getClaudeGatewayModels(),
    ));
  }

  private getClaudeGatewayModels(): ClaudeGatewayModelCatalog {
    return (this.claudeGatewayModels ??= new ClaudeGatewayModelCatalog(
      join(resolveAgentHome("claude", this.options.agentHomes), "settings.json"),
    ));
  }
}
