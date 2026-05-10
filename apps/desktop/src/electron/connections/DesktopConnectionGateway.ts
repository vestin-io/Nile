import type { AgentHomes, AgentId, ImportCurrentConnectionResult, RollbackLatestAgentResult } from "@nile/core/models/agent";
import type { CursorUsageAutoBindResult, RemoveConnectionResult } from "@nile/core/application/local";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-state";
import type { BindCursorUsageResult } from "@nile/core/actions/usage/cursor";
import { NileSession } from "@nile/core/runtime-local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { CredentialStore } from "@nile/core/services/credential";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";

import { DesktopConnectionPresenter } from "../../state/ConnectionPresenter";
import type { DesktopConnection } from "../../state/Types";
import { SessionRunner } from "./SessionRunner";
import type { DesktopConnectionSummary } from "./contracts";

type DesktopConnectionGatewayOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  environment: EnvironmentSource;
  credentialStore: CredentialStore;
};

export class DesktopConnectionGateway {
  private readonly cursorUsageSessionProbe = CursorUsageSessionSourceProbe.createDefault();
  private readonly sessions: SessionRunner;
  private readonly connections = new DesktopConnectionPresenter();

  constructor(private readonly options: DesktopConnectionGatewayOptions) {
    this.sessions = new SessionRunner(this);
  }

  importCurrentConnection(agentId: AgentId): DesktopConnectionSummary {
    return this.sessions.run((session) => {
      const imported = session.importCurrentConnectionWithLocalEffects(agentId);
      return this.buildConnectionSummary(imported);
    });
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    return this.sessions.run((session) => session.removeConnection(connectionId));
  }

  async switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection> {
    return await this.sessions.runAsync(async (session) => {
      const applied = session.useConnection(agentId, connectionId);
      const status = session.getAgentStatus(agentId);
      const currentConnection = this.connections.resolveCurrentConnection(
        status.currentConnection,
        session.listSavedConnections(),
      );
      if (!currentConnection) {
        throw new Error(`Current connection missing after apply for ${applied.endpointId}/${applied.accessId}`);
      }
      return currentConnection;
    });
  }

  importDetectedSetups(scanIds: AgentId[]): ImportDetectedSetupsResult {
    return this.sessions.run((session) => session.importDetectedSetups({
      selections: scanIds.map((scanId) => ({ scanId })),
    }));
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.sessions.run((session) => session.rollbackLatestMutation(agentId));
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.sessions.run((session) => session.bindCursorUsage(connectionId, sessionToken));
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.sessions.run((session) => session.autoBindAllCursorUsage());
  }

  openSession(): NileSession {
    return NileSession.open({
      databasePath: this.options.databasePath,
      agentHomes: this.options.agentHomes,
      environment: this.options.environment,
      credentialStore: this.options.credentialStore,
      cursorUsageSessionProbe: this.cursorUsageSessionProbe,
    });
  }

  private buildConnectionSummary(
    result: ImportCurrentConnectionResult,
  ): DesktopConnectionSummary {
    return {
      id: result.id,
      label: result.label,
      endpointId: result.endpointId,
      endpointLabel: result.endpointLabel,
      endpointFamily: result.endpointFamily ?? "unknown",
      authMode: result.authMode,
      ...(result.reused ? { reused: true } : {}),
    };
  }
}
