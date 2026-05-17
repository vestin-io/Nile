import { AccessRegistry } from "../../models/access";
import type { AccessRecord } from "../../models/access";
import type { AccessRegistryInput } from "../../models/access";
import type { AgentConnectionSettings } from "../../models/agent-settings";
import { AgentSelection } from "../../models/selection/Selection";
import type { AgentSelectionRecord } from "../../models/selection/Types";
import type { AuthMode } from "../../models/access";
import type { AgentId } from "../../models/agent/Definitions";
import { EndpointRegistry, EndpointShape } from "../../models/endpoint";
import type { EndpointRecord, EndpointRegistryInput } from "../../models/endpoint";
import { AGENT_CAPABILITIES } from "../../models/agent/registry/Capabilities";
import {
  isEnvKeyApiKeyCredential,
  sameApiKeyCredential,
  type StoredCredential,
} from "../../services/credential/Types";
import type { MatchedAgentConnection } from "../../models/agent";

export type ResolvedLiveSetup = {
  modelId?: string;
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: {
    wireApi?: string;
    envKey?: string;
  };
  credential: StoredCredential;
  detectedAccess: { authMode: AuthMode; identityKey?: string };
};

export type MatchLiveSetupResult = {
  matchedConnection: MatchedAgentConnection | null;
  validity: "valid_matched" | "valid_unverified" | "valid_import_candidate";
};

export class LiveSetupMatcher {
  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    private readonly agentId: AgentId,
    private readonly agentConnectionSettings?: AgentConnectionSettings,
  ) {}

  match(resolved: ResolvedLiveSetup): MatchLiveSetupResult {
    const matchedConnection = this.matchConnection(resolved);
    if (matchedConnection) {
      return { matchedConnection, validity: "valid_matched" };
    }
    return {
      matchedConnection: null,
      validity: this.classifyUnmatchedState(resolved),
    };
  }

  getCurrentSelection(): AgentSelectionRecord | null {
    return this.agentSelection.get(this.agentId);
  }

  matchesCurrentSelection(
    current: AgentSelectionRecord | null,
    matched: MatchedAgentConnection,
  ): boolean {
    return Boolean(current?.connectionId === matched.connectionId);
  }

  reconcileMatchedSelection(matched: MatchedAgentConnection): AgentSelectionRecord {
    return this.agentSelection.setApplied(this.agentId, matched.connectionId);
  }

  private matchConnection(resolved: ResolvedLiveSetup): MatchedAgentConnection | null {
    const endpoint = this.findEndpoint(resolved.endpoint);
    if (!endpoint) {
      return null;
    }

    const access = this.findAccess(endpoint.id, resolved);
    if (!access) {
      return null;
    }

    const current = this.agentSelection.get(this.agentId);
    return {
      connectionId: access.id,
      endpointId: endpoint.id,
      accessId: access.id,
      matchesAgentSelection: Boolean(current?.connectionId === access.id),
    };
  }

  private findEndpoint(candidate: EndpointRegistryInput): EndpointRecord | null {
    const hintedId = candidate.id.trim();
    if (hintedId) {
      const byId = this.endpointRegistry.get(hintedId);
      if (byId && EndpointShape.matchesRecordCandidateSubset(byId, candidate)) {
        return byId;
      }
    }

    const exactMatches = this.endpointRegistry
      .list()
      .filter((endpoint) => EndpointShape.matchesRecord(endpoint, candidate));
    if (exactMatches.length === 1) {
      return exactMatches[0];
    }

    const compatibleMatches = this.endpointRegistry
      .list()
      .filter((endpoint) => EndpointShape.matchesRecordCandidateSubset(endpoint, candidate));

    return compatibleMatches.length === 1 ? compatibleMatches[0] : null;
  }

  private findAccess(
    endpointId: string,
    resolved: ResolvedLiveSetup,
  ): AccessRecord | null {
    const candidates = this.accessRegistry
      .list()
      .filter((access) => access.endpointId === endpointId)
      .filter((access) => this.matchesResolvedAuthMode(access.authMode, resolved))
      .filter((access) => this.accessMatchesResolvedState(access, resolved));

    if (candidates.length === 0) {
      return null;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    const preferredCompatibleCandidate = this.readPreferredCompatibleCandidate(candidates, resolved);
    if (preferredCompatibleCandidate) {
      return preferredCompatibleCandidate;
    }

    const current = this.agentSelection.get(this.agentId);
    if (current) {
      const matchedCurrent = candidates.find((access) => access.id === current.connectionId);
      if (matchedCurrent) {
        return matchedCurrent;
      }
    }

    const labelMatch = candidates.find((access) => access.label === resolved.access.label);
    if (labelMatch) {
      return labelMatch;
    }

    return null;
  }

  private matchesResolvedAuthMode(
    accessAuthMode: AuthMode,
    resolved: ResolvedLiveSetup,
  ): boolean {
    if (accessAuthMode === resolved.access.authMode) {
      return true;
    }

    return resolved.access.authMode === "openclaw_openai_session"
      && resolved.credential.kind === "openclaw_openai_session"
      && accessAuthMode === "openai_session";
  }

  private readPreferredCompatibleCandidate(
    candidates: readonly AccessRecord[],
    resolved: ResolvedLiveSetup,
  ): AccessRecord | null {
    if (
      resolved.access.authMode !== "openclaw_openai_session"
      || resolved.credential.kind !== "openclaw_openai_session"
    ) {
      return null;
    }

    return candidates.find((access) => access.authMode === "openai_session") ?? null;
  }

  private accessMatchesResolvedState(
    access: AccessRecord,
    resolved: ResolvedLiveSetup,
  ): boolean {
    if (resolved.access.authMode === "api_key") {
      if (resolved.credential.kind !== "api_key") {
        return false;
      }

      if (this.requiresSelectedModelMatch()) {
        const resolvedModelId = resolved.modelId?.trim() || undefined;
        const storedModelId = this.readStoredModelId(access);
        if (resolvedModelId !== storedModelId) {
          return false;
        }
      }

      try {
        const stored = this.accessRegistry.readCredential(access.id);
        if (stored.kind !== "api_key") {
          return false;
        }
        if (sameApiKeyCredential(stored, resolved.credential)) {
          return true;
        }
        return isEnvKeyApiKeyCredential(stored)
          && Boolean(resolved.detectedEndpoint.envKey)
          && stored.envKey === resolved.detectedEndpoint.envKey;
      } catch {
        return false;
      }
    }

    const identityKey = resolved.detectedAccess.identityKey?.trim();
    if (!identityKey) {
      return false;
    }

    return access.identityKey === identityKey;
  }

  private classifyUnmatchedState(
    resolved: ResolvedLiveSetup,
  ): "valid_unverified" | "valid_import_candidate" {
    if (resolved.access.authMode === "api_key") {
      return "valid_import_candidate";
    }
    return resolved.detectedAccess.identityKey ? "valid_import_candidate" : "valid_unverified";
  }

  private readStoredModelId(access: AccessRecord): string | undefined {
    const selectedModelId = this.agentConnectionSettings?.get(this.agentId, access.id)?.modelId?.trim();
    return selectedModelId || undefined;
  }

  private requiresSelectedModelMatch(): boolean {
    return AGENT_CAPABILITIES.read(this.agentId).requiredApplyRequirements.includes("selected-model");
  }
}
