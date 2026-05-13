import type { AgentId, ImportCurrentConnectionResult } from "@nile/core/models/agent";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-setup";
import { NileSession } from "@nile/core/runtime-local";
import type { MatchedImportStateSnapshot } from "@nile/core/runtime-local/import-state";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import { ManagedApiKeyEnvironment, NoopManagedApiKeyEnvironment } from "./ManagedApiKeyEnvironment";

export class DesktopManagedConnectionImports {
  constructor(
    private readonly managedApiKeyEnvironment: ManagedApiKeyEnvironment | NoopManagedApiKeyEnvironment,
  ) {}

  async importCurrentConnection(
    session: NileSession,
    agentId: AgentId,
  ): Promise<ImportCurrentConnectionResult | SavedConnectionSummary> {
    const snapshot = this.captureMatchedImportState(session, agentId);
    const imported = await session.importCurrentConnectionWithLocalEffects(agentId);
    try {
      return await this.ensureManagedConnection(session, imported);
    } catch (error) {
      this.rollbackImportedConnection(session, imported, snapshot);
      throw error;
    }
  }

  async importDetectedSetups(
    session: NileSession,
    scanIds: AgentId[],
  ): Promise<ImportDetectedSetupsResult> {
    const result = await session.importDetectedSetups({
      selections: scanIds.map((scanId) => ({ scanId })),
    });
    await this.ensureManagedDetectedSetups(session, result, scanIds);
    return result;
  }

  private async ensureManagedDetectedSetups(
    session: NileSession,
    result: ImportDetectedSetupsResult,
    scanIds: AgentId[],
  ): Promise<void> {
    const snapshotsByAgent = this.captureMatchedImportStates(session, scanIds);
    for (const item of result.results) {
      if (!item.connectionId) {
        continue;
      }
      try {
        await this.ensureManagedConnectionId(session, item.connectionId);
      } catch (error) {
        this.rollbackDetectedSetupImport(session, item, snapshotsByAgent.get(item.scanId) ?? null);
        item.status = "failed";
        item.message = error instanceof Error ? error.message : String(error);
        delete item.connectionId;
        delete item.connectionLabel;
      }
    }
  }

  private async ensureManagedConnection(
    session: NileSession,
    imported: ImportCurrentConnectionResult | SavedConnectionSummary,
  ): Promise<ImportCurrentConnectionResult | SavedConnectionSummary> {
    return await this.ensureManagedConnectionId(session, imported.id) ?? imported;
  }

  private async ensureManagedConnectionId(
    session: NileSession,
    connectionId: string,
  ): Promise<SavedConnectionSummary | null> {
    return await this.managedApiKeyEnvironment.ensureForConnection(session, connectionId);
  }

  private rollbackImportedConnection(
    session: NileSession,
    imported: ImportCurrentConnectionResult,
    snapshot: MatchedImportStateSnapshot | null,
  ): void {
    if (imported.reused) {
      if (snapshot) {
        session.restoreMatchedImportState(snapshot);
      }
      return;
    }
    this.managedApiKeyEnvironment.removeForConnection(session, imported.id);
    session.removeConnection(imported.id);
  }

  private rollbackDetectedSetupImport(
    session: NileSession,
    item: ImportDetectedSetupsResult["results"][number],
    snapshot: MatchedImportStateSnapshot | null,
  ): void {
    if (!item.connectionId) {
      return;
    }
    if (item.status === "created") {
      this.managedApiKeyEnvironment.removeForConnection(session, item.connectionId);
      session.removeConnection(item.connectionId);
      return;
    }
    if (item.status === "reused" && snapshot) {
      session.restoreMatchedImportState(snapshot);
    }
  }

  private captureMatchedImportState(
    session: NileSession,
    agentId: AgentId,
  ): MatchedImportStateSnapshot | null {
    const matchedConnectionId = this.readSingleMatchedConnectionId(session, agentId);
    return matchedConnectionId
      ? session.captureMatchedImportState(agentId, matchedConnectionId)
      : null;
  }

  private captureMatchedImportStates(
    session: NileSession,
    agentIds: AgentId[],
  ): Map<AgentId, MatchedImportStateSnapshot> {
    return new Map(
      agentIds
        .map((agentId) => {
          const matchedConnectionId = this.readSingleMatchedConnectionId(session, agentId);
          if (!matchedConnectionId) {
            return null;
          }
          return [
            agentId,
            session.captureMatchedImportState(agentId, matchedConnectionId),
          ] as const;
        })
        .filter((entry): entry is readonly [AgentId, MatchedImportStateSnapshot] => entry !== null),
    );
  }

  private readSingleMatchedConnectionId(
    session: NileSession,
    agentId: AgentId,
  ): string | null {
    return this.readMatchedConnectionId(session.getAgentStatus(agentId));
  }

  private readMatchedConnectionId(status: ReturnType<NileSession["getAgentStatus"]>): string | null {
    if (!status || status.reconciliation.state !== "already_saved") {
      return null;
    }
    const matchedConnectionId = status.liveConnection?.id?.trim();
    return matchedConnectionId || null;
  }
}
