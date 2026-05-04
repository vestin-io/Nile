import { LocalWorkspaceState } from "../application/local/WorkspaceState";
import { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import type { CursorUsageSessionProbe } from "../application/local/CursorUsageSessionProbe";
import type { AgentHomes } from "../models/agent/Homes";
import { AgentSelection } from "../models/selection/Selection";
import type { CredentialStore } from "../services/credential/Store";
import { SqliteDatabase } from "../services/database/SqliteDatabase";
import { EnvironmentSource, type EnvironmentSource as EnvironmentSourceType } from "../services/EnvironmentSource";
import { MutationHistory } from "../services/history/MutationHistory";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import type { NileLogger } from "../services/NileLogger";
import { CodexSessionLogin } from "../agents/codex/CodexSessionLogin";
import { AgentAdapterRegistry } from "./AgentAdapterRegistry";
import { SessionConnections } from "./Connections";
import { SessionAgents } from "./Agents";
import { SessionUsageAccess } from "./UsageAccess";

export type NileSessionRuntimeOptions = {
  databasePath: string;
  database: SqliteDatabase;
  credentialStore: CredentialStore;
  agentHomes: AgentHomes;
  environment?: EnvironmentSourceType;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  cursorUsageSessionProbe?: CursorUsageSessionProbe;
};

export class NileSessionRuntime {
  private workspaceState: LocalWorkspaceState | null = null;
  private agentSelection: AgentSelection | null = null;
  private adapterRegistry: AgentAdapterRegistry | null = null;
  private history: MutationHistory | null = null;
  private connections: SessionConnections | null = null;
  private agents: SessionAgents | null = null;
  private usageAccess: SessionUsageAccess | null = null;

  constructor(private readonly options: NileSessionRuntimeOptions) {}

  getConnections(): SessionConnections {
    return (this.connections ??= new SessionConnections(
      this.getWorkspaceState().createSavedConnections(this.getAgentSelection()),
      this.getWorkspaceState().createConnectionCreator(),
      () => this.createLocalCredentialResolver(),
    ));
  }

  getAgents(): SessionAgents {
    if (this.agents) {
      return this.agents;
    }

    const workspaceState = this.getWorkspaceState();
    const agentAdapterRegistry = this.getAgentAdapterRegistry();
    const agentActions = workspaceState.createAgentActions(agentAdapterRegistry);

    this.agents = new SessionAgents(
      agentAdapterRegistry,
      agentActions.status,
      agentActions.scanLocal,
      agentActions.importDetectedSetups,
      (scope) => this.getMutationHistory(scope),
    );
    return this.agents;
  }

  getUsageAccess(): SessionUsageAccess {
    return (this.usageAccess ??= new SessionUsageAccess(
      this.getWorkspaceState(),
      this.getWorkspaceState().createUsage(),
      this.options.cursorUsageSessionProbe,
    ));
  }

  getMutationHistory(scope?: string): MutationHistory {
    if (!scope) {
      return (this.history ??= this.createMutationHistory("mutation-history"));
    }
    return this.createMutationHistory(scope);
  }

  getLogger(): NileLogger | undefined {
    return this.options.logger;
  }

  createLocalCredentialResolver(
    codexSessionLogin: CodexSessionLogin = new CodexSessionLogin(),
  ): LocalCredentialResolver {
    return new LocalCredentialResolver(
      this.options.agentHomes,
      this.options.environment ?? EnvironmentSource.empty(),
      codexSessionLogin,
    );
  }

  close(): void {
    this.options.database.close();
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

  private getAgentAdapterRegistry(): AgentAdapterRegistry {
    return (this.adapterRegistry ??= AgentAdapterRegistry.fromSharedContext(
      this.getWorkspaceState().createSharedAgentAdapterContext(this.getAgentSelection()),
      {
        credentialStore: this.options.credentialStore,
        environment: this.options.environment,
        secureSnapshotStore: this.options.secureSnapshotStore,
        logger: this.options.logger,
        agentHomes: this.options.agentHomes,
      },
    ));
  }

  private createMutationHistory(scope?: string): MutationHistory {
    return MutationHistory.fromDatabase(this.options.databasePath, this.options.database, {
      secureSnapshotStore: this.options.secureSnapshotStore,
      logger: scope ? this.options.logger?.child({ scope }) : this.options.logger,
    });
  }
}
