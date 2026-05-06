import { LocalAgentWorkflows } from "../application/local/AgentWorkflows";
import { LocalConnectionWorkflows } from "../application/local/ConnectionWorkflows";
import type { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import { LocalWorkspaceState } from "../application/local/WorkspaceState";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { Usage } from "../actions/usage/Usage";
import type { AgentAdapterLookup } from "../models/agent";
import type { ConnectionCreator } from "../models/connection/Creator";
import type { SavedConnections } from "../models/connection/SavedConnections";
import { AgentSelection } from "../models/selection/Selection";
import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";
import type { SessionRuntimeOptions } from "./SessionRuntimeOptions";

export class SessionWorkspaceResources {
  private workspaceState: LocalWorkspaceState | null = null;
  private agentSelection: AgentSelection | null = null;
  private savedConnections: SavedConnections | null = null;
  private connectionCreator: ConnectionCreator | null = null;
  private localConnectionWorkflows: LocalConnectionWorkflows | null = null;
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

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.getWorkspaceState().createCursorUsageBinder().bind(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.getWorkspaceState().createCursorUsageAutoBinder(this.options.cursorUsageSessionProbe).autoBind(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.getWorkspaceState().createCursorUsageAutoBinder(this.options.cursorUsageSessionProbe).autoBindAllMissing();
  }

  clearConnectionArtifacts(connectionId: string): void {
    this.getWorkspaceState().clearCursorUsageArtifacts(connectionId);
  }

  createAgentWorkspaceContext(): AgentWorkspaceContext {
    const workspaceState = this.getWorkspaceState();
    return {
      databasePath: workspaceState.databasePath,
      database: workspaceState.database,
      endpointRegistry: workspaceState.getEndpointRegistry(),
      accessRegistry: workspaceState.getAccessRegistry(),
      agentSelection: this.getAgentSelection(),
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
}
