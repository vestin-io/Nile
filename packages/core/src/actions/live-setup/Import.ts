import type { AccessRegistry } from "../../models/access";
import type { AccessRecord } from "../../models/access";
import type { AccessRegistryInput } from "../../models/access";
import type { AuthMode } from "../../models/access";
import type { AgentId } from "../../models/agent/Definitions";
import type { AgentConnectionSettings } from "../../models/agent-settings";
import { ConnectionUpsert } from "../../models/connection/Upsert";
import { CONNECTION_RUNTIME_REGISTRY, type GatewayCapabilityProbe } from "../../models/connection";
import type { EndpointRegistry } from "../../models/endpoint";
import { EndpointShape, type EndpointFamily, type EndpointRegistryInput } from "../../models/endpoint";
import { SHARED_CONNECTION_AGENT_POLICY } from "../../models/connection/AgentPolicy";
import type { AgentSelection } from "../../models/selection/Selection";
import type { StoredCredential } from "../../services/credential/Types";
import type { NileLogger } from "../../services/NileLogger";
import type { DetectedAgentState, ImportCurrentConnectionResult } from "../../models/agent";
import { joinEndpointUrl } from "../../projection/Url";

export type AgentImportCandidate = {
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  credential: StoredCredential;
  modelId?: string;
};

type ResolvedImportState = {
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: { labelHint: string };
  credential: StoredCredential;
  detectedAccess: { labelHint: string };
  modelId?: string;
};

export class LiveSetupImportSupport {
  private readonly upsert: ConnectionUpsert;

  constructor(
    private readonly agentId: AgentId,
    private readonly agentLabel: string,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    private readonly agentConnectionSettings: AgentConnectionSettings,
    private readonly logger: NileLogger,
    private readonly gatewayProbe: GatewayCapabilityProbe = CONNECTION_RUNTIME_REGISTRY.read().createGatewayProbe(),
  ) {
    this.upsert = new ConnectionUpsert(endpointRegistry, accessRegistry);
  }

  async importDetected(
    detected: DetectedAgentState,
    resolveCandidate: () => AgentImportCandidate,
  ): Promise<ImportCurrentConnectionResult> {
    if (detected.validity === "invalid_structure" || detected.validity === "invalid_semantics") {
      throw new Error(detected.issues.join("; ") || `Current ${this.agentLabel} state is not importable`);
    }
    if (!detected.endpoint || !detected.access) {
      throw new Error(`Current ${this.agentLabel} state is incomplete and cannot be imported`);
    }

    if (detected.validity !== "valid_import_candidate" && detected.validity !== "valid_matched") {
      throw new Error(`Current ${this.agentLabel} state is valid but cannot be safely imported yet`);
    }

    const candidate = await this.enrichCandidate(resolveCandidate());
    if (detected.validity === "valid_matched" && detected.matchedConnection) {
      this.refreshMatchedConnection(detected.matchedConnection, candidate);
      this.writeModelSetting(detected.matchedConnection.accessId, candidate.modelId);
      return this.selectAndSummarize(
        detected.matchedConnection.endpointId,
        detected.matchedConnection.accessId,
        true,
      );
    }

    const result = this.upsert.upsert({
      endpoint: candidate.endpoint,
      access: {
        label: candidate.access.label,
        authMode: candidate.access.authMode,
        credential: candidate.credential,
        identityKey: candidate.access.identityKey ?? null,
        enabledAgents: this.readImportedEnabledAgents(candidate.endpoint, candidate.access.authMode),
        enabledAgentsMode: "merge",
        apiKeyEnvKeyFallback: candidate.endpoint.protocols.openai?.envKeyOverride,
      },
    });
    this.logger.info(`${this.agentId}.import-current.created`, {
      endpointId: result.endpoint.id,
      accessId: result.access.id,
      endpointFamily: EndpointShape.readFamily(result.endpoint),
      authMode: result.access.authMode,
    });
    this.writeModelSetting(result.access.id, candidate.modelId);
    return this.selectAndSummarize(result.endpoint.id, result.access.id, result.reused);
  }

  private refreshMatchedConnection(
    matchedConnection: NonNullable<DetectedAgentState["matchedConnection"]>,
    candidate: AgentImportCandidate,
  ): void {
    const currentEndpoint = this.endpointRegistry.get(matchedConnection.endpointId);
    if (!currentEndpoint) {
      throw new Error(`Matched current ${this.agentLabel} endpoint is missing from Nile`);
    }
    this.endpointRegistry.update(matchedConnection.endpointId, {
      protocols: EndpointShape.mergeProtocols(currentEndpoint.protocols, candidate.endpoint.protocols),
    });

    const accessUpdate: {
      identityKey?: string | null;
      enabledAgents?: AgentId[];
    } = {};
    if (candidate.access.identityKey !== undefined) {
      accessUpdate.identityKey = candidate.access.identityKey ?? null;
    }
    const currentAccess = this.accessRegistry.get(matchedConnection.accessId);
    if (!currentAccess) {
      throw new Error(`Matched current ${this.agentLabel} access is missing from Nile`);
    }
    accessUpdate.enabledAgents = [...new Set([
      ...currentAccess.enabledAgents,
      ...this.readImportedEnabledAgents(candidate.endpoint, candidate.access.authMode),
    ])];

    this.accessRegistry.update(matchedConnection.accessId, accessUpdate);
    this.refreshMatchedCredential(currentAccess, candidate.credential);
  }

  private async enrichCandidate(candidate: AgentImportCandidate): Promise<AgentImportCandidate> {
    if (!this.shouldProbeGateway(candidate)) {
      return candidate;
    }

    const apiKey = this.readProbeApiKey(candidate.credential);
    if (!apiKey) {
      return candidate;
    }

    try {
      const detected = await this.gatewayProbe.probe(this.readGatewayProbeUrl(candidate.endpoint), apiKey);
      return {
        ...candidate,
        endpoint: {
          ...candidate.endpoint,
          protocols: {
            ...candidate.endpoint.protocols,
            ...(detected.openai ? { openai: detected.openai } : {}),
            ...(detected.anthropic ? { anthropic: detected.anthropic } : {}),
          },
        },
      };
    } catch (error) {
      this.logger.warn(`${this.agentId}.import-current.gateway-probe-failed`, {
        endpointId: candidate.endpoint.id,
        rootUrl: candidate.endpoint.rootUrl,
        message: error instanceof Error ? error.message : String(error),
      });
      return candidate;
    }
  }

  private selectAndSummarize(
    endpointId: string,
    accessId: string,
    reused = false,
  ): ImportCurrentConnectionResult {
    const access = this.accessRegistry.get(accessId);
    const endpoint = access ? this.endpointRegistry.get(endpointId) : null;
    if (!access || !endpoint) {
      throw new Error(`Matched current ${this.agentLabel} connection is missing from Nile`);
    }

    this.agentSelection.setApplied(this.agentId, access.id);
    const endpointFamily: EndpointFamily = EndpointShape.readFamily(endpoint);
    const summary: ImportCurrentConnectionResult = {
      id: access.id,
      label: access.label,
      endpointId: endpoint.id,
      endpointLabel: endpoint.label,
      endpointFamily,
      authMode: access.authMode,
    };
    if (reused) {
      summary.reused = true;
    }
    return summary;
  }

  private writeModelSetting(connectionId: string, modelId?: string): void {
    const normalizedModelId = modelId?.trim();
    if (!normalizedModelId) {
      this.agentConnectionSettings.clear(this.agentId, connectionId);
      return;
    }
    this.agentConnectionSettings.setModelId(this.agentId, connectionId, normalizedModelId);
  }

  private shouldProbeGateway(candidate: AgentImportCandidate): boolean {
    return candidate.endpoint.profile === "generic-gateway"
      && candidate.access.authMode === "api_key";
  }

  private readProbeApiKey(credential: StoredCredential): string | null {
    if (credential.kind !== "api_key" || credential.source !== "direct") {
      return null;
    }
    const apiKey = credential.apiKey.trim();
    return apiKey ? apiKey : null;
  }

  private readGatewayProbeUrl(endpoint: EndpointRegistryInput): string {
    const basePath = endpoint.protocols.openai?.basePath
      ?? endpoint.protocols.anthropic?.basePath
      ?? undefined;
    return basePath ? joinEndpointUrl(endpoint.rootUrl, basePath) : endpoint.rootUrl;
  }

  private readImportedEnabledAgents(
    endpoint: EndpointRegistryInput,
    authMode: AuthMode,
  ): AgentId[] {
    const enabledAgents = SHARED_CONNECTION_AGENT_POLICY.readSavedConnectionConfig({
      protocols: endpoint.protocols,
      authMode,
    }).defaultEnabledAgents;
    return enabledAgents.length > 0 ? enabledAgents : [this.agentId];
  }

  private refreshMatchedCredential(
    currentAccess: AccessRecord,
    credential: StoredCredential,
  ): void {
    if (
      currentAccess.authMode === "openai_session"
      && credential.kind === "openclaw_openai_session"
    ) {
      return;
    }
    if (currentAccess.authMode !== "api_key") {
      this.accessRegistry.syncCredential(currentAccess.id, credential);
      return;
    }
    if (credential.kind !== "api_key") {
      return;
    }

    const refreshedCredential = this.readMatchedApiKeyCredential(currentAccess, credential);
    if (!refreshedCredential) {
      return;
    }
    this.accessRegistry.syncCredential(currentAccess.id, refreshedCredential);
  }

  private readMatchedApiKeyCredential(
    currentAccess: AccessRecord,
    credential: Extract<StoredCredential, { kind: "api_key" }>,
  ): Extract<StoredCredential, { kind: "api_key" }> | null {
    const currentEnvKey = currentAccess.envKey?.trim() || null;
    if (currentAccess.apiKeySource === "env_key") {
      return credential.source === "env_key" && currentEnvKey && credential.envKey.trim() === currentEnvKey
        ? credential
        : null;
    }
    if (credential.source === "env_key") {
      return null;
    }
    return currentEnvKey ? { ...credential, envKey: currentEnvKey } : credential;
  }
}

export function requireResolvedImportCandidate(
  agentLabel: string,
  readResult:
    | { kind: "resolved"; value: ResolvedImportState }
    | { kind: string },
): AgentImportCandidate {
  if (readResult.kind !== "resolved" || !("value" in readResult)) {
    throw new Error(`Current ${agentLabel} state changed while importing`);
  }
  const resolved = readResult.value;

  return {
    endpoint: {
      ...resolved.endpoint,
      label: resolved.detectedEndpoint.labelHint,
    },
    access: {
      ...resolved.access,
      label: resolved.detectedAccess.labelHint,
    },
    credential: resolved.credential,
    ...(resolved.modelId ? { modelId: resolved.modelId } : {}),
  };
}
