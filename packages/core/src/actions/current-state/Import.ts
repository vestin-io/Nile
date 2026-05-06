import type { AccessRegistry } from "../../models/access";
import type { AccessRegistryInput } from "../../models/access";
import type { AgentId } from "../../models/agent/Types";
import { ConnectionNaming } from "../../models/connection/Naming";
import type { EndpointRegistry } from "../../models/endpoint";
import { EndpointShape, type EndpointFamily, type EndpointRegistryInput } from "../../models/endpoint";
import type { AgentSelection } from "../../models/selection/Selection";
import {
  isEnvKeyApiKeyCredential,
  sameApiKeyCredential,
  type StoredCredential,
} from "../../services/credential/Types";
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
  constructor(
    private readonly agentId: AgentId,
    private readonly agentLabel: string,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    private readonly logger: NileLogger,
  ) {}

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
    const endpoint = this.ensureEndpoint(candidate.endpoint);
    const { access, reused } = this.ensureAccess(endpoint.id, candidate);
    this.logger.info(`${this.agentId}.import-current.created`, {
      endpointId: endpoint.id,
      accessId: access.id,
      endpointFamily: EndpointShape.readFamily(endpoint),
      authMode: access.authMode,
    });
    return this.selectAndSummarize(endpoint.id, access.id, reused);
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

  private ensureEndpoint(candidate: EndpointRegistryInput) {
    const hinted = this.endpointRegistry.get(candidate.id);
    if (hinted && EndpointShape.matchesRecord(hinted, candidate)) {
      return this.endpointRegistry.update(hinted.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: candidate.protocols,
      });
    }

    const existingEquivalent = this.endpointRegistry
      .list()
      .find((endpoint) => EndpointShape.matchesRecord(endpoint, candidate));
    if (existingEquivalent) {
      return this.endpointRegistry.update(existingEquivalent.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: candidate.protocols,
      });
    }

    const endpointId = hinted
      ? ConnectionNaming.createUniqueId(candidate.id || candidate.label, this.endpointRegistry.list().map((entry) => entry.id))
      : candidate.id;
    return this.endpointRegistry.add({
      ...candidate,
      id: endpointId,
    });
  }

  private ensureAccess(
    endpointId: string,
    candidate: AgentImportCandidate,
  ) {
    const existing = this.findExistingAccess(endpointId, candidate);
    if (existing) {
      const current = this.accessRegistry.get(existing.id);
      const enabledAgents = current ? [...new Set([...current.enabledAgents, this.agentId])] : [this.agentId];
      return {
        access: this.accessRegistry.update(existing.id, {
          label: candidate.access.label,
          identityKey: candidate.access.identityKey ?? null,
          openclawModelId: candidate.access.openclawModelId ?? null,
          enabledAgents,
        }, candidate.credential),
        reused: true,
      };
    }

    const accessId = ConnectionNaming.createUniqueId(
      candidate.access.label,
      this.accessRegistry.list().map((entry) => entry.id),
    );
    return {
      access: this.accessRegistry.add({
        id: accessId,
        endpointId,
        label: candidate.access.label,
        authMode: candidate.access.authMode,
        enabledAgents: [this.agentId],
        ...(candidate.access.openclawModelId ? { openclawModelId: candidate.access.openclawModelId } : {}),
        ...(candidate.access.identityKey ? { identityKey: candidate.access.identityKey } : {}),
      }, candidate.credential),
      reused: false,
    };
  }

  private findExistingAccess(
    endpointId: string,
    candidate: AgentImportCandidate,
  ) {
    return this.accessRegistry
      .list()
      .filter((access) => access.endpointId === endpointId && access.authMode === candidate.access.authMode)
      .find((access) => this.matchesCredential(access.id, candidate, candidate.access.identityKey));
  }

  private matchesCredential(
    accessId: string,
    candidate: AgentImportCandidate,
    identityKey?: string,
  ): boolean {
    const credential = candidate.credential;
    if (credential.kind === "api_key") {
      try {
        const stored = this.accessRegistry.readCredential(accessId);
        if (stored.kind !== "api_key") {
          return false;
        }
        if (sameApiKeyCredential(stored, credential)) {
          return this.matchesOpenClawModel(candidate, accessId);
        }
        return isEnvKeyApiKeyCredential(stored)
          && stored.envKey === candidate.endpoint.protocols.openai?.envKeyOverride;
      } catch {
        return false;
      }
    }

    if (!identityKey) {
      return false;
    }

    const access = this.accessRegistry.get(accessId);
    return access?.identityKey === identityKey;
  }

  private matchesOpenClawModel(candidate: AgentImportCandidate, accessId: string): boolean {
    const candidateModelId = candidate.access.openclawModelId?.trim() || undefined;
    const existing = this.accessRegistry.get(accessId);
    const existingModelId = existing?.openclawModelId?.trim() || undefined;
    return candidateModelId === existingModelId;
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
