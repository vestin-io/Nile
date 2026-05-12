import { LocalWorkspaceState } from "../application/local/WorkspaceState";
import { AgentConnectionSettings } from "../models/agent-settings";
import { AgentSelection } from "../models/selection/Selection";
import type { CredentialStore } from "../services/credential/Store";
import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";

export class AgentWorkspaceSession {
  static open(databasePath: string, credentialStore: CredentialStore): AgentWorkspaceSession {
    const workspaceState = LocalWorkspaceState.open(databasePath, credentialStore);
    const agentSelection = AgentSelection.fromDatabase(workspaceState.database);
    const agentConnectionSettings = AgentConnectionSettings.fromDatabase(workspaceState.database);

    return new AgentWorkspaceSession(
      workspaceState,
      agentSelection,
      agentConnectionSettings,
    );
  }

  private constructor(
    readonly workspaceState: LocalWorkspaceState,
    readonly agentSelection: AgentSelection,
    readonly agentConnectionSettings: AgentConnectionSettings,
  ) {
    this.sharedContext = {
      databasePath: this.workspaceState.databasePath,
      database: this.workspaceState.database,
      endpointRegistry: this.workspaceState.getEndpointRegistry(),
      accessRegistry: this.workspaceState.getAccessRegistry(),
      agentSelection: this.agentSelection,
      agentConnectionSettings: this.agentConnectionSettings,
    };
  }

  readonly sharedContext: AgentWorkspaceContext;

  close(): void {
    this.workspaceState.close();
  }
}
