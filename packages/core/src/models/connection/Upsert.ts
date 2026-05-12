import type { AccessRecord, AccessRegistry, AuthMode } from "../access";
import type { AgentId } from "../agent";
import type { EndpointRecord, EndpointRegistry, EndpointRegistryInput } from "../endpoint";
import { EndpointShape } from "../endpoint";
import {
  isEnvKeyApiKeyCredential,
  sameApiKeyCredential,
  type StoredCredential,
} from "../../services/credential/Types";
import { ConnectionNaming } from "./Naming";

export type ConnectionUpsertInput = {
  endpoint: EndpointRegistryInput;
  access: {
    idHint?: string;
    label: string;
    authMode: AuthMode;
    credential: StoredCredential;
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
  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
  ) {}

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
      return {
        record: this.accessRegistry.update(existing.id, {
          label: input.label,
          identityKey: input.identityKey ?? null,
          enabledAgents,
        }, input.credential),
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
        ...(input.identityKey?.trim() ? { identityKey: input.identityKey.trim() } : {}),
      }, input.credential),
      reused: false,
    };
  }

  private findExistingAccess(
    endpointId: string,
    input: ConnectionUpsertInput["access"],
  ): AccessRecord | null {
    return this.accessRegistry
      .list()
      .filter((access) => access.endpointId === endpointId && access.authMode === input.authMode)
      .find((access) => this.matchesAccess(access, input)) ?? null;
  }

  private matchesAccess(
    access: AccessRecord,
    input: ConnectionUpsertInput["access"],
  ): boolean {
    if (input.credential.kind === "api_key") {
      return this.matchesApiKeyAccess(access, input);
    }

    if (input.credential.kind === "openai_session" && input.authMode === "openai_session") {
      return this.matchesOpenAiSessionAccess(access, input.credential, input.identityKey ?? null);
    }

    const identityKey = input.identityKey?.trim();
    return Boolean(identityKey && access.identityKey === identityKey);
  }

  private matchesApiKeyAccess(
    access: AccessRecord,
    input: ConnectionUpsertInput["access"],
  ): boolean {
    try {
      const stored = this.accessRegistry.readCredential(access.id);
      if (stored.kind !== "api_key") {
        return false;
      }
      if (sameApiKeyCredential(stored, input.credential as Extract<StoredCredential, { kind: "api_key" }>)) {
        return true;
      }
      return Boolean(
        input.apiKeyEnvKeyFallback
          && isEnvKeyApiKeyCredential(stored)
          && stored.envKey === input.apiKeyEnvKeyFallback,
      );
    } catch {
      return false;
    }
  }

  private matchesOpenAiSessionAccess(
    access: AccessRecord,
    credential: Extract<StoredCredential, { kind: "openai_session" }>,
    identityKey: string | null,
  ): boolean {
    if (identityKey && access.identityKey === identityKey) {
      return true;
    }

    try {
      const stored = this.accessRegistry.readCredential(access.id);
      if (stored.kind !== "openai_session") {
        return false;
      }

      if (credential.accountId?.trim() && stored.accountId?.trim()) {
        return credential.accountId.trim() === stored.accountId.trim();
      }

      if (credential.refreshToken && stored.refreshToken) {
        return credential.refreshToken === stored.refreshToken;
      }

      return credential.idToken === stored.idToken;
    } catch {
      return false;
    }
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
