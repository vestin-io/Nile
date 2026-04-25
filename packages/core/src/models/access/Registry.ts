import {
  type CredentialStore,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
} from "../../services/credential/Store";
import {
  LocalCredentialSourceFactory,
  type CredentialSourceFactory,
} from "../../services/credential/Factory";
import type { CredentialSource } from "../../services/credential/Source";
import { isEnvKeyApiKeyCredential, type StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { SUPPORTED_AGENT_IDS, type AgentId } from "../agent";
import { EndpointRegistry, type EndpointRecord } from "../endpoint";
import { SUPPORTED_AUTH_MODES, type AuthMode } from "./AuthMode";
import { SqliteAccessStore } from "./store/SqliteStore";
import type { AccessStore } from "./store/Store";
import type { AccessRecord, AccessRegistryInput, AccessRegistryUpdate } from "./Types";

export class AccessRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessRegistryValidationError";
  }
}

export class DuplicateAccessIdError extends Error {
  constructor(accessId: string) {
    super(`Access already exists: ${accessId}`);
    this.name = "DuplicateAccessIdError";
  }
}

export class AccessNotFoundError extends Error {
  constructor(accessId: string) {
    super(`Access not found: ${accessId}`);
    this.name = "AccessNotFoundError";
  }
}

export class AccessRegistryConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessRegistryConsistencyError";
  }
}

export class AccessRegistry {
  static open(
    databasePath: string,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ): AccessRegistry {
    const database = SqliteDatabase.open(databasePath);
    return new AccessRegistry(
      new SqliteAccessStore(database),
      EndpointRegistry.fromDatabase(database),
      credentialStore,
      credentialSourceFactory,
      database,
    );
  }

  static fromDatabase(
    database: SqliteDatabase,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ): AccessRegistry {
    return new AccessRegistry(
      new SqliteAccessStore(database),
      EndpointRegistry.fromDatabase(database),
      credentialStore,
      credentialSourceFactory,
      null,
    );
  }

  constructor(
    private readonly accessStore: AccessStore,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly credentialStore: CredentialStore,
    private readonly credentialSourceFactory: CredentialSourceFactory,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {}

  add(input: AccessRegistryInput, credential: StoredCredential): AccessRecord {
    const endpoint = this.requireEndpoint(input.endpointId);
    const record = this.normalizeInput(
      input,
      endpoint,
      new Date().toISOString(),
      this.readCredentialMetadata(input.authMode, credential),
    );

    this.createCredential(record, credential);

    try {
      this.accessStore.insert(record);
    } catch (error) {
      this.rollbackCredentialCreate(record.credentialSource);
      if (this.isUniqueConstraintError(error)) {
        throw new DuplicateAccessIdError(record.id);
      }
      throw error;
    }

    return this.getOrThrow(record.id);
  }

  update(accessId: string, input: AccessRegistryUpdate, credential?: StoredCredential): AccessRecord {
    const current = this.getOrThrow(accessId);
    const endpointId = input.endpointId ?? current.endpointId;
    const endpoint = this.requireEndpoint(endpointId);
    const nextRecord = this.normalizeInput(
      {
        id: current.id,
        endpointId,
        label: input.label ?? current.label,
        authMode: current.authMode,
        identityKey: input.identityKey === null ? undefined : input.identityKey ?? current.identityKey,
        openclawModelId:
          input.openclawModelId === null
            ? undefined
            : input.openclawModelId ?? current.openclawModelId,
        enabledAgents: input.enabledAgents ?? current.enabledAgents,
      },
      endpoint,
      current.createdAt,
      credential !== undefined
        ? this.readCredentialMetadata(current.authMode, credential)
        : this.readExistingCredentialMetadata(current),
    );

    if (credential !== undefined) {
      const previousCredential = this.credentialStore.get(current.credentialSource.reference);
      this.credentialStore.update(current.credentialSource.reference, credential);

      try {
        this.accessStore.update({
          ...nextRecord,
          credentialSource: current.credentialSource,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        this.rollbackCredentialUpdate(current.credentialSource, previousCredential, error);
      }
    } else {
      this.accessStore.update({
        ...nextRecord,
        credentialSource: current.credentialSource,
        updatedAt: new Date().toISOString(),
      });
    }

    return this.getOrThrow(accessId);
  }

  get(accessId: string): AccessRecord | null {
    return this.accessStore.get(accessId);
  }

  readCredential(accessId: string): StoredCredential {
    const record = this.getOrThrow(accessId);
    return this.credentialStore.get(record.credentialSource.reference);
  }

  list(): AccessRecord[] {
    return this.accessStore.list();
  }

  remove(accessId: string): void {
    const current = this.getOrThrow(accessId);
    const previousCredential = this.credentialStore.get(current.credentialSource.reference);

    this.credentialStore.remove(current.credentialSource.reference);

    try {
      this.accessStore.remove(accessId);
    } catch (error) {
      this.restoreCredentialAfterRemove(current.credentialSource, previousCredential, error);
    }
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private getOrThrow(accessId: string): AccessRecord {
    const record = this.accessStore.get(accessId);
    if (!record) {
      throw new AccessNotFoundError(accessId);
    }
    return record;
  }

  private normalizeInput(
    input: AccessRegistryInput,
    endpoint: EndpointRecord,
    createdAt: string,
    credentialMetadata?: { apiKeySource: "direct" | "env_key"; envKey?: string },
  ): AccessRecord {
    const id = input.id.trim();
    const endpointId = input.endpointId.trim();
    const label = input.label.trim();
    const authMode = input.authMode.trim();
    const identityKey = input.identityKey?.trim();
    const openclawModelId = input.openclawModelId?.trim();
    const enabledAgents = this.normalizeEnabledAgents(input.enabledAgents, endpoint);

    if (!id) {
      throw new AccessRegistryValidationError("Access id is required");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new AccessRegistryValidationError(
        "Access id may only contain letters, numbers, underscores, and hyphens",
      );
    }
    if (!endpointId) {
      throw new AccessRegistryValidationError("Endpoint id is required");
    }
    if (!label) {
      throw new AccessRegistryValidationError("Access label is required");
    }
    if (!authMode) {
      throw new AccessRegistryValidationError("Access auth mode is required");
    }
    if (!SUPPORTED_AUTH_MODES.includes(authMode as AuthMode)) {
      throw new AccessRegistryValidationError(`Unsupported auth mode: ${authMode}`);
    }
    if (endpoint.id !== endpointId) {
      throw new AccessRegistryValidationError(`Endpoint mismatch for access ${id}`);
    }

    return {
      id,
      endpointId,
      label,
      authMode: authMode as AuthMode,
      ...(identityKey ? { identityKey } : {}),
      ...(openclawModelId ? { openclawModelId } : {}),
      ...(credentialMetadata?.apiKeySource ? { apiKeySource: credentialMetadata.apiKeySource } : {}),
      ...(credentialMetadata?.envKey ? { envKey: credentialMetadata.envKey } : {}),
      enabledAgents,
      credentialSource: this.credentialSourceFactory.createAccessSource({ accessId: id }),
      createdAt,
      updatedAt: createdAt,
    };
  }

  private readCredentialMetadata(
    authMode: AuthMode,
    credential: StoredCredential,
  ): { apiKeySource: "direct" | "env_key"; envKey?: string } | undefined {
    if (authMode !== "api_key" || credential.kind !== "api_key") {
      return undefined;
    }
    if (isEnvKeyApiKeyCredential(credential)) {
      return {
        apiKeySource: "env_key",
        envKey: credential.envKey.trim(),
      };
    }
    return { apiKeySource: "direct" };
  }

  private readExistingCredentialMetadata(
    current: AccessRecord,
  ): { apiKeySource: "direct" | "env_key"; envKey?: string } | undefined {
    if (current.authMode !== "api_key" || !current.apiKeySource) {
      return undefined;
    }
    if (current.apiKeySource === "env_key") {
      return {
        apiKeySource: "env_key",
        ...(current.envKey ? { envKey: current.envKey } : {}),
      };
    }
    return { apiKeySource: "direct" };
  }

  private requireEndpoint(endpointId: string): EndpointRecord {
    const endpoint = this.endpointRegistry.get(endpointId.trim());
    if (!endpoint) {
      throw new AccessRegistryValidationError(`Endpoint not found: ${endpointId}`);
    }
    return endpoint;
  }

  private normalizeEnabledAgents(
    enabledAgents: AgentId[] | undefined,
    endpoint: EndpointRecord,
  ): AgentId[] {
    const values = enabledAgents ?? this.inferEnabledAgents(endpoint);
    const normalized = [...new Set(values.map((value) => value.trim() as AgentId))];
    if (normalized.length === 0) {
      throw new AccessRegistryValidationError("Access must enable at least one agent");
    }
    for (const agentId of normalized) {
      if (!SUPPORTED_AGENT_IDS.includes(agentId)) {
        throw new AccessRegistryValidationError(`Unsupported agent id: ${agentId}`);
      }
    }
    return normalized;
  }

  private inferEnabledAgents(endpoint: EndpointRecord): AgentId[] {
    const agents: AgentId[] = [];
    if (endpoint.protocols.openai) {
      agents.push("codex");
    }
    if (endpoint.protocols.anthropic) {
      agents.push("claude");
    }
    if (endpoint.protocols.cursor) {
      agents.push("cursor");
    }
    return agents;
  }

  private createCredential(record: AccessRecord, credential: StoredCredential): void {
    try {
      this.credentialStore.create(record.credentialSource.reference, credential);
      return;
    } catch (error) {
      if (!(error instanceof CredentialAlreadyExistsError)) {
        throw error;
      }
    }

    if (this.accessStore.get(record.id)) {
      throw new DuplicateAccessIdError(record.id);
    }

    this.credentialStore.update(record.credentialSource.reference, credential);
  }

  private rollbackCredentialCreate(credentialSource: CredentialSource): void {
    try {
      this.credentialStore.remove(credentialSource.reference);
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        return;
      }
      throw error;
    }
  }

  private rollbackCredentialUpdate(
    credentialSource: CredentialSource,
    previousCredential: StoredCredential,
    cause: unknown,
  ): never {
    try {
      this.credentialStore.update(credentialSource.reference, previousCredential);
    } catch (rollbackError) {
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new AccessRegistryConsistencyError(
        `Failed to restore credential after access update error: ${rollbackMessage}`,
      );
    }
    throw cause;
  }

  private restoreCredentialAfterRemove(
    credentialSource: CredentialSource,
    previousCredential: StoredCredential,
    cause: unknown,
  ): never {
    try {
      this.credentialStore.create(credentialSource.reference, previousCredential);
    } catch (rollbackError) {
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new AccessRegistryConsistencyError(
        `Failed to restore credential after access removal error: ${rollbackMessage}`,
      );
    }
    throw cause;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Error && /unique|constraint/i.test(error.message);
  }
}
