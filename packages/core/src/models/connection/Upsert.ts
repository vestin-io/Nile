import type { AccessRecord, AccessRegistry, AuthMode } from "../access";
import type { AgentId } from "../agent";
import type { EndpointRecord, EndpointRegistry, EndpointRegistryInput } from "../endpoint";
import { EndpointShape } from "../endpoint";
import type { StoredCredential } from "../../services/credential/Types";
import type { CredentialStorageBackend } from "../../services/credential/Store";
import { ConnectionAccessMatchSupport } from "./AccessMatch";
import { ConnectionNaming } from "./Naming";
import { OpenAiSessionCompatibility } from "./OpenAiSessionCompatibility";

export type ConnectionUpsertInput = {
  endpoint: EndpointRegistryInput;
  access: {
    idHint?: string;
    label: string;
    authMode: AuthMode;
    credential: StoredCredential;
    credentialStorageBackend?: CredentialStorageBackend;
    identityKey?: string | null;
    enabledAgents: AgentId[];
    enabledAgentsMode: "replace" | "merge";
    apiKeyEnvKeyFallback?: string;
  };
};

export type ConnectionUpsertResult = {
  endpoint: EndpointRecord;
  access: AccessRecord;
  endpointCreated: boolean;
  reused: boolean;
};

export class ConnectionUpsert {
  private readonly accessMatch: ConnectionAccessMatchSupport;

  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
  ) {
    this.accessMatch = new ConnectionAccessMatchSupport(accessRegistry, endpointRegistry);
  }

  upsert(input: ConnectionUpsertInput): ConnectionUpsertResult {
    const ensuredEndpoint = this.ensureEndpoint(input.endpoint);
    try {
      const access = this.ensureAccess(ensuredEndpoint.record.id, input.access);
      return {
        endpoint: ensuredEndpoint.record,
        access: access.record,
        endpointCreated: ensuredEndpoint.created,
        reused: access.reused,
      };
    } catch (error) {
      if (ensuredEndpoint.created) {
        this.removeEndpointIfOrphaned(ensuredEndpoint.record.id);
      }
      throw error;
    }
  }

  ensureEndpoint(candidate: EndpointRegistryInput): { created: boolean; record: EndpointRecord } {
    const hinted = this.endpointRegistry.get(candidate.id);
    if (hinted && EndpointShape.matchesIdentity(hinted, candidate)) {
      return {
        created: false,
        record: this.endpointRegistry.update(hinted.id, {
          label: candidate.label,
          rootUrl: candidate.rootUrl,
          profile: candidate.profile ?? null,
          protocols: EndpointShape.mergeProtocols(hinted.protocols, candidate.protocols),
        }),
      };
    }

    const existingMergeable = this.endpointRegistry
      .list()
      .find((endpoint) => EndpointShape.matchesIdentity(endpoint, candidate));
    if (existingMergeable) {
      return {
        created: false,
        record: this.endpointRegistry.update(existingMergeable.id, {
          label: candidate.label,
          rootUrl: candidate.rootUrl,
          profile: candidate.profile ?? null,
          protocols: EndpointShape.mergeProtocols(existingMergeable.protocols, candidate.protocols),
        }),
      };
    }

    const endpointId = hinted
      ? ConnectionNaming.createUniqueId(candidate.id || candidate.label, this.endpointRegistry.list().map((entry) => entry.id))
      : candidate.id;
    return {
      created: true,
      record: this.endpointRegistry.add({
        ...candidate,
        id: endpointId,
      }),
    };
  }

  private ensureAccess(
    endpointId: string,
    input: ConnectionUpsertInput["access"],
  ): { record: AccessRecord; reused: boolean } {
    const existing = this.findExistingAccess(endpointId, input);
    if (existing) {
      const enabledAgents = input.enabledAgentsMode === "merge"
        ? [...new Set([...existing.enabledAgents, ...input.enabledAgents])]
        : input.enabledAgents;
      const authMode = OpenAiSessionCompatibility.readCanonicalAuthMode(existing.authMode, input.authMode);
      const credential = OpenAiSessionCompatibility.shouldPreserveStoredCredential(
        existing.authMode,
        input.credential,
      )
        ? undefined
        : input.credential;
      return {
        record: this.accessRegistry.update(existing.id, {
          label: input.label,
          authMode,
          identityKey: input.identityKey ?? null,
          enabledAgents,
          credentialStorageBackend: existing.credentialStorageBackend,
        }, credential),
        reused: true,
      };
    }

    return {
      record: this.accessRegistry.add({
        id: this.resolveAccessId(input.idHint, input.label),
        endpointId,
        label: input.label,
        authMode: input.authMode,
        enabledAgents: input.enabledAgents,
        ...(input.credentialStorageBackend ? { credentialStorageBackend: input.credentialStorageBackend } : {}),
        ...(input.identityKey?.trim() ? { identityKey: input.identityKey.trim() } : {}),
      }, input.credential),
      reused: false,
    };
  }

  private findExistingAccess(
    endpointId: string,
    input: ConnectionUpsertInput["access"],
  ): AccessRecord | null {
    const candidates = this.accessRegistry
      .list()
      .filter((access) => access.endpointId === endpointId)
      .filter((access) => OpenAiSessionCompatibility.matches(access.authMode, input.authMode))
      .filter((access) => this.matchesAccess(access, input));
    if (candidates.length === 0) {
      return null;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }
    const preferredAuthMode = OpenAiSessionCompatibility.readPreferredSavedAuthMode(
      candidates.map((access) => access.authMode),
    );
    if (preferredAuthMode) {
      return candidates.find((access) => access.authMode === preferredAuthMode) ?? candidates[0];
    }
    return candidates[0];
  }

  private matchesAccess(
    access: AccessRecord,
    input: ConnectionUpsertInput["access"],
  ): boolean {
    return this.accessMatch.matches(
      access,
      input.authMode,
      input.credential,
      input.identityKey ?? null,
      input.apiKeyEnvKeyFallback,
    );
  }

  private resolveAccessId(requestedId: string | undefined, label: string): string {
    const normalizedId = requestedId?.trim();
    if (normalizedId) {
      return normalizedId;
    }

    return ConnectionNaming.createUniqueId(
      label,
      this.accessRegistry.list().map((access) => access.id),
    );
  }

  private removeEndpointIfOrphaned(endpointId: string): void {
    const stillReferenced = this.accessRegistry.list().some((access) => access.endpointId === endpointId);
    if (!stillReferenced) {
      this.endpointRegistry.remove(endpointId);
    }
  }
}
