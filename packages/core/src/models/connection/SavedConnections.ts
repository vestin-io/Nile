import type { CredentialStore } from "../../services/credential/Store";
import {
  isEnvKeyApiKeyCredential,
  type StoredCredential,
} from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import type { AgentId } from "../agent/Types";
import { CLAUDE_AGENT_ID } from "../../agents/claude/types";
import { CODEX_AGENT_ID } from "../../agents/codex/types";
import { CURSOR_AGENT_ID } from "../../agents/cursor/types";
import { OPENCLAW_AGENT_ID } from "../../agents/openclaw/types";
import type { AccessRegistry, AuthMode } from "../access";
import type { AccessRecord } from "../access";
import { AccessRegistry as OpenAccessRegistry } from "../access";
import type { EndpointFamily, EndpointRegistry } from "../endpoint";
import type { EndpointRecord } from "../endpoint";
import { EndpointRegistry as OpenEndpointRegistry } from "../endpoint";
import { EndpointShape } from "../endpoint";
import { AgentSelection } from "../selection/Selection";
import { SHARED_CONNECTION_AGENT_POLICY } from "./AgentPolicy";
import { ConnectionUpdater, type UpdateConnectionInput } from "./Updater";

export type SavedConnectionSummary = {
  id: string;
  endpointId: string;
  endpointUrl: string | null;
  label: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily | null;
  authMode: AuthMode;
  openclawModelId?: string;
  apiKeySource?: "direct" | "env_key";
  envKey?: string | null;
  enabledAgents: AgentId[];
  configurableAgents: AgentId[];
  selectedByAgents: string[];
};

export class SavedConnections {
  static open(
    databasePath: string,
    credentialStore: CredentialStore,
  ): SavedConnections {
    const database = SqliteDatabase.open(databasePath);
    return new SavedConnections(
      database,
      OpenEndpointRegistry.fromDatabase(database),
      OpenAccessRegistry.fromDatabase(database, credentialStore),
      AgentSelection.fromDatabase(database),
      database,
    );
  }

  constructor(
    private readonly database: SqliteDatabase,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {}

  list(): SavedConnectionSummary[] {
    const selectionsByConnection = this.readSelectionsByConnection();
    const endpointsById = this.readEndpointsById();
    return this.accessRegistry.list().map((access) =>
      this.buildSummary(
        access,
        endpointsById.get(access.endpointId) ?? null,
        selectionsByConnection.get(access.id) ?? [],
      ),
    );
  }

  listForAgent(agentId: AgentId): SavedConnectionSummary[] {
    const selectionsByConnection = this.readSelectionsByConnection();
    const endpointsById = this.readEndpointsById();
    return this.accessRegistry
      .list()
      .filter((access) => access.enabledAgents.includes(agentId))
      .filter((access) => this.endpointSupportsAgent(endpointsById.get(access.endpointId) ?? null, agentId))
      .map((access) =>
        this.buildSummary(
          access,
          endpointsById.get(access.endpointId) ?? null,
          selectionsByConnection.get(access.id) ?? [],
        ),
      );
  }

  async update(input: UpdateConnectionInput): Promise<SavedConnectionSummary> {
    const updater = new ConnectionUpdater(
      this.database,
      this.endpointRegistry,
      this.accessRegistry,
      this.agentSelection,
    );
    const updated = await updater.update(input);
    const endpoint = this.endpointRegistry.get(updated.endpointId);
    const selectedByAgents = this.agentSelection
      .list()
      .filter((selection) => selection.connectionId === updated.id)
      .map((selection) => selection.agentId);
    return this.buildSummary(updated, endpoint, selectedByAgents);
  }

  remove(connectionId: string): { id: string; removed: true; clearedAgents: AgentId[] } {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    const clearedAgents = this.agentSelection
      .list()
      .filter((selection) => selection.connectionId === access.id)
      .map((selection) => selection.agentId as AgentId);
    for (const agentId of clearedAgents) {
      this.agentSelection.clear(agentId);
    }
    this.accessRegistry.remove(connectionId);
    if (this.accessRegistry.list().every((candidate) => candidate.endpointId !== access.endpointId)) {
      this.endpointRegistry.remove(access.endpointId);
    }
    return {
      id: connectionId,
      removed: true,
      clearedAgents,
    };
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  readCredential(connectionId: string): StoredCredential {
    return this.accessRegistry.readCredential(connectionId);
  }

  private endpointSupportsAgent(endpoint: EndpointRecord | null, agentId: AgentId): boolean {
    if (!endpoint) {
      return false;
    }
    if (agentId === CODEX_AGENT_ID) {
      return Boolean(endpoint.protocols.openai);
    }
    if (agentId === CLAUDE_AGENT_ID) {
      return Boolean(endpoint.protocols.anthropic);
    }
    if (agentId === CURSOR_AGENT_ID) {
      return Boolean(endpoint.protocols.cursor);
    }
    if (agentId === OPENCLAW_AGENT_ID) {
      return Boolean(endpoint.protocols.openai || endpoint.protocols.anthropic);
    }
    return false;
  }

  private readEndpointFamily(endpoint: ReturnType<EndpointRegistry["get"]>): EndpointFamily | null {
    if (!endpoint) {
      return null;
    }
    return EndpointShape.readFamily(endpoint);
  }

  private buildSummary(
    access: AccessRecord,
    endpoint: EndpointRecord | null,
    selectedByAgents: string[],
  ): SavedConnectionSummary {
    const apiKeyMetadata = this.readApiKeyMetadata(access);

    return {
      id: access.id,
      endpointId: access.endpointId,
      endpointUrl: this.readEndpointUrl(endpoint),
      label: access.label,
      endpointLabel: endpoint?.label ?? access.endpointId,
      endpointFamily: this.readEndpointFamily(endpoint) ?? null,
      authMode: access.authMode,
      ...(access.openclawModelId ? { openclawModelId: access.openclawModelId } : {}),
      ...(apiKeyMetadata ?? {}),
      enabledAgents: this.readEnabledAgents(access, endpoint),
      configurableAgents: this.readConfigurableAgents(access, endpoint),
      selectedByAgents,
    };
  }

  private readConfigurableAgents(
    access: AccessRecord,
    endpoint: EndpointRecord | null,
  ): AgentId[] {
    if (!endpoint) {
      return [];
    }
    return SHARED_CONNECTION_AGENT_POLICY.readSavedConnectionConfig({
      endpointFamily: EndpointShape.readFamily(endpoint),
      protocols: endpoint.protocols,
      authMode: access.authMode,
      openclawModelId: access.openclawModelId,
    }).configurableAgents;
  }

  private readEnabledAgents(
    access: AccessRecord,
    endpoint: EndpointRecord | null,
  ): AgentId[] {
    return access.enabledAgents.filter((agentId) => this.endpointSupportsAgent(endpoint, agentId));
  }

  private readEndpointUrl(endpoint: EndpointRecord | null): string | null {
    if (!endpoint) {
      return null;
    }

    if (endpoint.protocols.openai?.basePath) {
      return `${endpoint.rootUrl}${endpoint.protocols.openai.basePath}`;
    }
    if (endpoint.protocols.anthropic?.basePath) {
      return `${endpoint.rootUrl}${endpoint.protocols.anthropic.basePath}`;
    }
    return endpoint.rootUrl;
  }

  private readApiKeyMetadata(
    access: AccessRecord,
  ): { apiKeySource: "direct" | "env_key"; envKey?: string | null } | null {
    if (access.authMode !== "api_key") {
      return null;
    }

    if (access.apiKeySource === "env_key") {
      return {
        apiKeySource: "env_key",
        envKey: access.envKey ?? null,
      };
    }

    if (access.apiKeySource === "direct") {
      return {
        apiKeySource: "direct",
        envKey: null,
      };
    }

    // Legacy rows may not have api-key metadata yet.
    try {
      const credential = this.accessRegistry.readCredential(access.id);
      if (credential.kind !== "api_key") {
        return null;
      }
      if (isEnvKeyApiKeyCredential(credential)) {
        return {
          apiKeySource: "env_key",
          envKey: credential.envKey,
        };
      }
      return {
        apiKeySource: "direct",
        envKey: null,
      };
    } catch {
      return null;
    }
  }

  private readSelectionsByConnection(): Map<string, string[]> {
    const selectionsByConnection = new Map<string, string[]>();

    for (const selection of this.agentSelection.list()) {
      const agents = selectionsByConnection.get(selection.connectionId) ?? [];
      agents.push(selection.agentId);
      selectionsByConnection.set(selection.connectionId, agents);
    }

    return selectionsByConnection;
  }

  private readEndpointsById(): Map<string, EndpointRecord> {
    return new Map(this.endpointRegistry.list().map((endpoint) => [endpoint.id, endpoint]));
  }
}
