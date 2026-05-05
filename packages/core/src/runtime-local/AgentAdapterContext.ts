import { LocalWorkspaceState } from "../application/local/WorkspaceState";
import type { SharedAgentAdapterContext } from "../application/local/AgentAdapterContext";
import { AgentSelection } from "../models/selection/Selection";
import type { CredentialStore } from "../services/credential/Store";

export type { SharedAgentAdapterContext } from "../application/local/AgentAdapterContext";

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

  readonly sharedContext: SharedAgentAdapterContext;

  close(): void {
    this.workspaceState.close();
  }
}
