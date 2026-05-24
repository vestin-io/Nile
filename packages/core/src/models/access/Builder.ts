import {
  LocalCredentialSourceFactory,
  type CredentialSourceFactory,
} from "../../services/credential/Factory";
import { SUPPORTED_CREDENTIAL_STORAGE_BACKENDS, type CredentialStorageBackend } from "../../services/credential/Store";
import { isEnvKeyApiKeyCredential, type StoredCredential } from "../../services/credential/Types";
import { SUPPORTED_AGENT_IDS, type AgentId } from "../agent";
import { EndpointRegistry, type EndpointRecord } from "../endpoint";
import { SUPPORTED_AUTH_MODES, type AuthMode } from "./AuthMode";
import { AccessRegistryValidationError } from "./Errors";
import type { AccessRecord, AccessRegistryInput, AccessRegistryUpdate } from "./Types";

export class AccessRecordBuilder {
  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ) {}

  buildForCreate(
    input: AccessRegistryInput,
    credential: StoredCredential,
    createdAt: string,
  ): AccessRecord {
    const endpoint = this.requireEndpoint(input.endpointId);
    return this.normalizeInput(
      input,
      endpoint,
      createdAt,
      this.readCredentialMetadata(input.authMode, credential),
    );
  }

  buildForUpdate(
    current: AccessRecord,
    input: AccessRegistryUpdate,
    credential?: StoredCredential,
  ): AccessRecord {
    const endpointId = input.endpointId ?? current.endpointId;
    const authMode = input.authMode ?? current.authMode;
    const endpoint = this.requireEndpoint(endpointId);
    return this.normalizeInput(
      {
        id: current.id,
        endpointId,
        label: input.label ?? current.label,
        authMode,
        identityKey: input.identityKey === null ? undefined : input.identityKey ?? current.identityKey,
        credentialStorageBackend: input.credentialStorageBackend ?? current.credentialStorageBackend,
        enabledAgents: input.enabledAgents ?? current.enabledAgents,
      },
      endpoint,
      current.createdAt,
      credential !== undefined
        ? this.readCredentialMetadata(authMode, credential)
        : this.readExistingCredentialMetadata(current),
    );
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
    const credentialStorageBackend = this.normalizeCredentialStorageBackend(input.credentialStorageBackend);
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
      ...(credentialStorageBackend ? { credentialStorageBackend } : {}),
      ...(credentialMetadata?.apiKeySource ? { apiKeySource: credentialMetadata.apiKeySource } : {}),
      ...(credentialMetadata?.envKey ? { envKey: credentialMetadata.envKey } : {}),
      enabledAgents,
      credentialSource: this.credentialSourceFactory.createAccessSource({ accessId: id }),
      credentialSyncState: "ready",
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
    return {
      apiKeySource: "direct",
      ...(credential.envKey?.trim() ? { envKey: credential.envKey.trim() } : {}),
    };
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
    return {
      apiKeySource: "direct",
      ...(current.envKey ? { envKey: current.envKey } : {}),
    };
  }

  private requireEndpoint(endpointId: string): EndpointRecord {
    const endpoint = this.endpointRegistry.get(endpointId.trim());
    if (!endpoint) {
      throw new AccessRegistryValidationError(`Endpoint not found: ${endpointId}`);
    }
    return endpoint;
  }

  private normalizeCredentialStorageBackend(
    backend: CredentialStorageBackend | undefined,
  ): CredentialStorageBackend | undefined {
    if (backend === undefined) {
      return undefined;
    }
    if (!SUPPORTED_CREDENTIAL_STORAGE_BACKENDS.includes(backend)) {
      throw new AccessRegistryValidationError(`Unsupported credential storage backend: ${backend}`);
    }
    return backend;
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
    if (endpoint.protocols.gemini) {
      agents.push("gemini");
    }
    return agents;
  }
}
