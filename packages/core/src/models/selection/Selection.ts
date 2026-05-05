import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { isAgentId, type AgentId } from "../agent/Types";
import type { AccessRecord } from "../access/Types";
import { SqliteAccessStore } from "../access/SqliteAccessStore";
import { SqliteAgentSelectionStore } from "./SqliteAgentSelectionStore";
import { type AgentSelectionRecord } from "./Types";

export class AgentSelectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentSelectionValidationError";
  }
}

export class AgentSelection {
  static open(databasePath: string): AgentSelection {
    const database = SqliteDatabase.open(databasePath);
    return new AgentSelection(
      new SqliteAccessStore(database),
      new SqliteAgentSelectionStore(database),
      database,
    );
  }

  static fromDatabase(database: SqliteDatabase): AgentSelection {
    return new AgentSelection(
      new SqliteAccessStore(database),
      new SqliteAgentSelectionStore(database),
      null,
    );
  }

  constructor(
    private readonly accessStore: SqliteAccessStore,
    private readonly agentSelectionStore: SqliteAgentSelectionStore,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {}

  get(agentId: AgentId): AgentSelectionRecord | null {
    this.validateAgent(agentId);
    return this.agentSelectionStore.get(agentId);
  }

  list(): AgentSelectionRecord[] {
    return this.agentSelectionStore.list();
  }

  clear(agentId: AgentId): void {
    this.validateAgent(agentId);
    this.agentSelectionStore.clear(agentId);
  }

  setApplied(
    agentId: AgentId,
    connectionId: string,
    appliedAt: string = new Date().toISOString(),
  ): AgentSelectionRecord {
    this.validateAgent(agentId);
    const normalizedConnectionId = connectionId.trim();
    const normalizedAppliedAt = appliedAt.trim();

    if (!normalizedConnectionId) {
      throw new AgentSelectionValidationError("Connection id is required");
    }
    if (!normalizedAppliedAt) {
      throw new AgentSelectionValidationError("Applied at is required");
    }

    const access = this.requireAccess(normalizedConnectionId);

    const record = {
      agentId,
      connectionId: access.id,
      endpointId: access.endpointId,
      accessId: access.id,
      appliedAt: normalizedAppliedAt,
    };

    this.agentSelectionStore.set(record);
    return this.getOrThrow(agentId);
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private getOrThrow(agentId: AgentId): AgentSelectionRecord {
    const current = this.agentSelectionStore.get(agentId);
    if (!current) {
      throw new AgentSelectionValidationError("Agent selection was not persisted");
    }
    return current;
  }

  private validateAgent(agentId: string): void {
    if (!isAgentId(agentId)) {
      throw new AgentSelectionValidationError(`Unsupported agent: ${agentId}`);
    }
  }

  private requireAccess(accessId: string): AccessRecord {
    const access = this.accessStore.get(accessId);
    if (!access) {
      throw new AgentSelectionValidationError(`Connection not found: ${accessId}`);
    }
    return access;
  }
}
