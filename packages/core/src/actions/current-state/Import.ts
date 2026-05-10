import type { AccessRegistry } from "../../models/access";
import type { AccessRegistryInput } from "../../models/access";
import type { AgentId } from "../../models/agent/Types";
import { ConnectionUpsert } from "../../models/connection/Upsert";
import type { EndpointRegistry } from "../../models/endpoint";
import { EndpointShape, type EndpointFamily, type EndpointRegistryInput } from "../../models/endpoint";
import type { AgentSelection } from "../../models/selection/Selection";
import type { StoredCredential } from "../../services/credential/Types";
import type { NileLogger } from "../../services/NileLogger";
import type { DetectedAgentState, ImportCurrentConnectionResult } from "../../models/agent";

export type AgentImportCandidate = {
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  credential: StoredCredential;
};

type ResolvedImportState = {
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: { labelHint: string };
  credential: StoredCredential;
  detectedAccess: { labelHint: string };
};

export class CurrentStateImportSupport {
  private readonly upsert: ConnectionUpsert;

  constructor(
    private readonly agentId: AgentId,
    private readonly agentLabel: string,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    private readonly logger: NileLogger,
  ) {
    this.upsert = new ConnectionUpsert(endpointRegistry, accessRegistry);
  }

  importDetected(
    detected: DetectedAgentState,
    resolveCandidate: () => AgentImportCandidate,
  ): ImportCurrentConnectionResult {
    if (detected.validity === "invalid_structure" || detected.validity === "invalid_semantics") {
      throw new Error(detected.issues.join("; ") || `Current ${this.agentLabel} state is not importable`);
    }
    if (!detected.endpoint || !detected.access) {
      throw new Error(`Current ${this.agentLabel} state is incomplete and cannot be imported`);
    }

    if (detected.matchedConnection) {
      return this.reuseMatchedConnection(detected.matchedConnection.connectionId);
    }

    if (detected.validity !== "valid_import_candidate") {
      throw new Error(`Current ${this.agentLabel} state is valid but cannot be safely imported yet`);
    }

    const candidate = resolveCandidate();
    const result = this.upsert.upsert({
      endpoint: candidate.endpoint,
      access: {
        label: candidate.access.label,
        authMode: candidate.access.authMode,
        credential: candidate.credential,
        identityKey: candidate.access.identityKey ?? null,
        openclawModelId: candidate.access.openclawModelId ?? null,
        enabledAgents: [this.agentId],
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
    return this.selectAndSummarize(result.endpoint.id, result.access.id, result.reused);
  }

  private reuseMatchedConnection(connectionId: string): ImportCurrentConnectionResult {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new Error(`Matched current ${this.agentLabel} connection is missing from Nile`);
    }
    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      throw new Error(`Matched current ${this.agentLabel} connection is missing from Nile`);
    }
    return this.selectAndSummarize(endpoint.id, access.id, true);
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
  };
}
