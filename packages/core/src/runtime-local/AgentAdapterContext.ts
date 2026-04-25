import { LocalWorkspaceState } from "../application/local/WorkspaceState";
import type { AccessRegistry } from "../models/access";
import type { EndpointRegistry } from "../models/endpoint";
import { AgentSelection } from "../models/selection/Selection";
import type { CredentialStore } from "../services/credential/Store";
import { SqliteDatabase } from "../services/database/SqliteDatabase";

export type SharedAgentAdapterContext = {
  databasePath: string;
  database: SqliteDatabase;
  endpointRegistry: EndpointRegistry;
  accessRegistry: AccessRegistry;
  agentSelection: AgentSelection;
};

export class AgentAdapterContextSession {
  static open(databasePath: string, credentialStore: CredentialStore): AgentAdapterContextSession {
    const workspaceState = LocalWorkspaceState.open(databasePath, credentialStore);
    const agentSelection = AgentSelection.fromDatabase(workspaceState.database);

    return new AgentAdapterContextSession(
      workspaceState,
      agentSelection,
    );
  }

  private constructor(
    readonly workspaceState: LocalWorkspaceState,
    readonly agentSelection: AgentSelection,
  ) {
    this.sharedContext = this.workspaceState.createSharedAgentAdapterContext(this.agentSelection);
  }

  private readonly sharedContext: SharedAgentAdapterContext;

  get databasePath(): string {
    return this.workspaceState.databasePath;
  }

  get database(): SqliteDatabase {
    return this.workspaceState.database;
  }

  get endpointRegistry() {
    return this.sharedContext.endpointRegistry;
  }

  get accessRegistry() {
    return this.sharedContext.accessRegistry;
  }

  close(): void {
    this.workspaceState.close();
  }
}
