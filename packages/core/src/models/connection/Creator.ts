import { sameApiKeyCredential, type StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import type { AccessRegistry } from "../access";
import type { AccessRecord, AccessRegistryInput, AuthMode } from "../access";
import type { AgentId } from "../agent";
import type { EndpointRegistry } from "../endpoint";
import { EndpointShape, type EndpointFamily, type EndpointRecord, type EndpointRegistryInput } from "../endpoint";
import type { ConnectionPresetFamily } from "./PresetTypes";
import { ConnectionLabeler } from "./Labeler";
import { ConnectionNaming } from "./Naming";
import { GatewayProbe, type GatewayCapabilityProbe } from "./GatewayProbe";
import { ConnectionEndpointBuilder } from "./EndpointBuilder";
import { ConnectionIdentityKeyResolver } from "./IdentityKeyResolver";
import { ConnectionOnboardingPolicy, type ConnectionOnboardingSuggestion } from "./OnboardingPolicy";

export type CreateConnectionInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
  credential: StoredCredential;
  probeCredential?: StoredCredential;
  endpointUrl?: string;
  id?: string;
  label?: string;
  openclawModelId?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
};

export type CreateConnectionResult = {
  id: string;
  label: string;
  endpointId: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily;
  authMode: AuthMode;
  reused?: true;
};

export class ConnectionCreator {
  private readonly labeler = new ConnectionLabeler();
  private readonly endpointBuilder: ConnectionEndpointBuilder;
  private readonly onboardingPolicy = new ConnectionOnboardingPolicy();
  private readonly identityKeyResolver = new ConnectionIdentityKeyResolver();

  constructor(
    private readonly database: SqliteDatabase,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    gatewayProbe: GatewayCapabilityProbe = new GatewayProbe(),
  ) {
    this.endpointBuilder = new ConnectionEndpointBuilder(gatewayProbe);
  }

  async create(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    const endpointCandidate = await this.endpointBuilder.build({
      ...input,
      credential: input.probeCredential ?? input.credential,
    });
    const onboarding = this.onboardingPolicy.suggest(input.preset, endpointCandidate);
    return this.database.transaction(() => {
      const endpoint = this.ensureEndpoint(endpointCandidate);
      const label = input.label?.trim() || this.suggestAccessLabel(input);
      const identityKey = this.identityKeyResolver.resolve(input.authMode, input.credential);
      const existing = this.findExistingAccess(endpoint.id, input, identityKey);

      if (existing) {
        const updated = this.accessRegistry.update(
          existing.id,
          {
            label,
            identityKey: identityKey ?? null,
            openclawModelId: input.openclawModelId ?? null,
            enabledAgents: input.enabledAgents ?? onboarding.defaultEnabledAgents,
          },
          input.credential,
        );
        return this.toResult(endpoint, updated, true);
      }

      const access = this.accessRegistry.add(
        {
          id: this.resolveAccessId(input.id, label),
          endpointId: endpoint.id,
          label,
          authMode: input.authMode,
          ...(input.openclawModelId?.trim() ? { openclawModelId: input.openclawModelId.trim() } : {}),
          enabledAgents: input.enabledAgents ?? onboarding.defaultEnabledAgents,
          ...(identityKey ? { identityKey } : {}),
        },
        input.credential,
      );
      return this.toResult(endpoint, access);
    });
  }

  async describeOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion> {
    const endpointCandidate = await this.endpointBuilder.build({
      ...input,
      credential: input.probeCredential ?? input.credential,
    });
    return this.onboardingPolicy.suggest(input.preset, endpointCandidate);
  }

  private ensureEndpoint(candidate: EndpointRegistryInput): EndpointRecord {
    const hinted = this.endpointRegistry.get(candidate.id);
    if (hinted && this.matchesEndpointIdentity(hinted, candidate)) {
      return this.endpointRegistry.update(hinted.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: this.mergeProtocols(hinted.protocols, candidate.protocols),
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
      ? ConnectionNaming.createUniqueId(candidate.id, this.endpointRegistry.list().map((entry) => entry.id))
      : candidate.id;
    return this.endpointRegistry.add({
      ...candidate,
      id: endpointId,
    });
  }

  private matchesEndpointIdentity(
    record: Pick<EndpointRecord, "rootUrl" | "profile">,
    candidate: Pick<EndpointRegistryInput, "rootUrl" | "profile">,
  ): boolean {
    return record.rootUrl === candidate.rootUrl && record.profile === candidate.profile;
  }

  private mergeProtocols(
    current: EndpointRecord["protocols"],
    next: EndpointRegistryInput["protocols"],
  ): EndpointRegistryInput["protocols"] {
    return {
      ...current,
      ...next,
    };
  }

  private findExistingAccess(
    endpointId: string,
    input: CreateConnectionInput,
    identityKey: string | null,
  ): AccessRecord | null {
    return this.accessRegistry
      .list()
      .filter((access) => access.endpointId === endpointId && access.authMode === input.authMode)
      .find((access) => this.matchesCredential(access, input.credential, identityKey, input.openclawModelId)) ?? null;
  }

  private matchesCredential(
    access: AccessRecord,
    credential: StoredCredential,
    identityKey: string | null,
    openclawModelId: string | undefined,
  ): boolean {
    const requestedOpenClawModelId = openclawModelId?.trim() || undefined;
    const currentOpenClawModelId = access.openclawModelId?.trim() || undefined;
    if (requestedOpenClawModelId !== currentOpenClawModelId) {
      return false;
    }

    if (credential.kind === "api_key") {
      try {
        const stored = this.accessRegistry.readCredential(access.id);
        return stored.kind === "api_key" && sameApiKeyCredential(stored, credential);
      } catch {
        return false;
      }
    }

    if (credential.kind === "openai_session" && access.authMode === "openai_session") {
      return this.matchesOpenAiSessionCredential(access, credential, identityKey);
    }

    return Boolean(identityKey && access.identityKey === identityKey);
  }

  private matchesOpenAiSessionCredential(
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

  private suggestAccessLabel(input: CreateConnectionInput): string {
    return this.labeler.suggestAccessLabel(input.preset, input.authMode, input.credential, {
      endpointUrl: input.endpointUrl,
    });
  }

  private toResult(
    endpoint: EndpointRecord,
    access: Pick<AccessRegistryInput, "id" | "label" | "authMode">,
    reused = false,
  ): CreateConnectionResult {
    const result: CreateConnectionResult = {
      id: access.id,
      label: access.label,
      endpointId: endpoint.id,
      endpointLabel: endpoint.label,
      endpointFamily: EndpointShape.readFamily(endpoint),
      authMode: access.authMode,
    };
    if (reused) {
      result.reused = true;
    }
    return result;
  }
}
