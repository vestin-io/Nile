import type { CredentialStore } from "../../services/credential/Store";
import {
  isEnvKeyApiKeyCredential,
  type StoredCredential,
} from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import type { AgentId } from "../agent/Definitions";
import { AgentConnectionSettings, type AgentConnectionSettings as AgentConnectionSettingsStore } from "../agent-settings";
import type { AccessRegistry, AuthMode } from "../access";
import type { AccessRecord } from "../access";
import { AccessRegistry as OpenAccessRegistry } from "../access";
import type { EndpointFamily, EndpointRegistry } from "../endpoint";
import type { EndpointRecord } from "../endpoint";
import { EndpointRegistry as OpenEndpointRegistry } from "../endpoint";
import { EndpointShape } from "../endpoint";
import { AgentSelection } from "../selection/Selection";
import { CONNECTION_RUNTIME_REGISTRY, type UpdateConnectionInput } from "./Runtime";
import { SHARED_CONNECTION_AGENT_POLICY } from "./AgentPolicy";

export type SavedConnectionSummary = {
  id: string;
  endpointId: string;
  endpointUrl: string | null;
  label: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily | null;
  authMode: AuthMode;
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
      AgentConnectionSettings.fromDatabase(database),
      database,
    );
  }

  constructor(
    private readonly database: SqliteDatabase,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    private readonly agentConnectionSettings?: AgentConnectionSettingsStore,
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
      .filter((access) => {
        if (!this.isSelectableByAgent(access)) {
          return false;
        }
        const endpoint = endpointsById.get(access.endpointId) ?? null;
        return this.readConfigurableAgents(access, endpoint).includes(agentId);
      })
      .map((access) =>
        this.buildSummary(
          access,
          endpointsById.get(access.endpointId) ?? null,
          selectionsByConnection.get(access.id) ?? [],
        ),
      );
  }

  async update(input: UpdateConnectionInput): Promise<SavedConnectionSummary> {
    const updater = CONNECTION_RUNTIME_REGISTRY.read().createUpdater({
      database: this.database,
      endpointRegistry: this.endpointRegistry,
      accessRegistry: this.accessRegistry,
      agentSelection: this.agentSelection,
    });
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
    this.agentConnectionSettings?.clearConnection(connectionId);
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

  setDirectApiKeyEnvKey(connectionId: string, envKey: string | null): SavedConnectionSummary {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    if (access.authMode !== "api_key") {
      throw new Error(`Connection ${connectionId} is not an API-key connection`);
    }

    const credential = this.accessRegistry.readCredential(connectionId);
    if (credential.kind !== "api_key" || credential.source === "env_key") {
      throw new Error(`Connection ${connectionId} does not use a direct API key`);
    }

    const normalizedEnvKey = envKey?.trim() || null;

    const currentEnvKey = access.envKey?.trim() || credential.envKey?.trim() || null;
    if (currentEnvKey === normalizedEnvKey) {
      return this.buildCurrentSummary(access);
    }

    const updated = this.accessRegistry.update(connectionId, {}, {
      ...credential,
      envKey: normalizedEnvKey ?? undefined,
    });
    return this.buildCurrentSummary(updated);
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
      ...(apiKeyMetadata ?? {}),
      enabledAgents: this.readEnabledAgents(access, endpoint),
      configurableAgents: this.readConfigurableAgents(access, endpoint),
      selectedByAgents,
    };
  }

  private buildCurrentSummary(access: AccessRecord): SavedConnectionSummary {
    const endpoint = this.endpointRegistry.get(access.endpointId);
    const selectedByAgents = this.agentSelection
      .list()
      .filter((selection) => selection.connectionId === access.id)
      .map((selection) => selection.agentId);
    return this.buildSummary(access, endpoint, selectedByAgents);
  }

  private readConfigurableAgents(
    access: AccessRecord,
    endpoint: EndpointRecord | null,
  ): AgentId[] {
    if (!endpoint) {
      return [];
    }
    return SHARED_CONNECTION_AGENT_POLICY.readSavedConnectionConfig({
      protocols: endpoint.protocols,
      authMode: access.authMode,
    }).configurableAgents;
  }

  private readEnabledAgents(
    access: AccessRecord,
    endpoint: EndpointRecord | null,
  ): AgentId[] {
    const configurableAgents = this.readConfigurableAgents(access, endpoint);
    return access.enabledAgents.filter((agentId) => configurableAgents.includes(agentId));
  }

  private isSelectableByAgent(access: AccessRecord): boolean {
    return (access.credentialSyncState ?? "ready") === "ready";
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
        envKey: access.envKey ?? null,
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
        envKey: credential.envKey?.trim() || null,
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
