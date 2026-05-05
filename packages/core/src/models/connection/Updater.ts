import type { StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import type { AccessRecord, AccessRegistry } from "../access";
import type { AgentId } from "../agent";
import { EndpointShape, type EndpointRecord, type EndpointRegistry, type EndpointRegistryInput } from "../endpoint";
import { AgentSelection } from "../selection/Selection";
import { ConnectionEndpointBuilder } from "./EndpointBuilder";
import { GatewayProbe, type GatewayCapabilityProbe } from "./GatewayProbe";
import { ConnectionIdentityKeyResolver } from "./IdentityKeyResolver";
import { ConnectionNaming } from "./Naming";
import { ConnectionOnboardingPolicy } from "./OnboardingPolicy";
import type { ConnectionPresetFamily } from "./PresetTypes";

export type UpdateConnectionInput = {
  connectionId: string;
  label?: string;
  enabledAgents?: AgentId[];
  openclawModelId?: string | null;
  endpointUrl?: string;
  credential?: StoredCredential;
  probeCredential?: StoredCredential;
};

export class ConnectionUpdaterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionUpdaterValidationError";
  }
}

export class ConnectionUpdater {
  private readonly endpointBuilder: ConnectionEndpointBuilder;
  private readonly onboardingPolicy = new ConnectionOnboardingPolicy();
  private readonly identityKeyResolver = new ConnectionIdentityKeyResolver();

  constructor(
    private readonly database: SqliteDatabase,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    gatewayProbe: GatewayCapabilityProbe = new GatewayProbe(),
  ) {
    this.endpointBuilder = new ConnectionEndpointBuilder(gatewayProbe);
  }

  async update(input: UpdateConnectionInput): Promise<AccessRecord> {
    const current = this.requireAccess(input.connectionId);
    const currentEndpoint = this.requireEndpoint(current.endpointId);
    const selectedRecords = this.agentSelection
      .list()
      .filter((selection) => selection.connectionId === current.id);
    const selectedAgents = selectedRecords.map((selection) => selection.agentId as AgentId);
    const currentCredential = input.credential === undefined && input.endpointUrl !== undefined
      ? this.accessRegistry.readCredential(current.id)
      : undefined;
    const nextCredential = input.credential ?? currentCredential;

    const prepared = nextCredential
      ? await this.prepareEndpointUpdate(
          current,
          currentEndpoint,
          nextCredential,
          input.probeCredential ?? nextCredential,
          input.endpointUrl,
        )
      : null;
    const nextEnabledAgents = this.resolveEnabledAgents(
      current,
      input.enabledAgents,
      selectedAgents,
      prepared?.supportedAgents,
    );
    const nextIdentityKey = nextCredential
      ? this.identityKeyResolver.resolve(current.authMode, nextCredential)
      : undefined;

    const currentAccess = this.requireAccess(input.connectionId);
    const endpoint = prepared
      ? this.resolveEndpointForUpdate(currentAccess, currentEndpoint, prepared.endpointCandidate)
      : this.requireEndpoint(currentAccess.endpointId);
    const updated = this.accessRegistry.update(
      currentAccess.id,
      {
        endpointId: endpoint.id,
        label: input.label ?? currentAccess.label,
        identityKey: nextIdentityKey === undefined ? undefined : nextIdentityKey,
        openclawModelId:
          input.openclawModelId === undefined
            ? currentAccess.openclawModelId
            : input.openclawModelId,
        enabledAgents: nextEnabledAgents,
      },
      nextCredential,
    );

    if (currentAccess.endpointId !== endpoint.id) {
      this.refreshSelectedAgents(selectedRecords, updated.id);
      this.removeEndpointIfOrphaned(currentAccess.endpointId);
    }

    return updated;
  }

  private async prepareEndpointUpdate(
    current: AccessRecord,
    currentEndpoint: EndpointRecord,
    credential: StoredCredential,
    probeCredential: StoredCredential,
    endpointUrl: string | undefined,
  ): Promise<{
    endpointCandidate: EndpointRegistryInput;
    supportedAgents: AgentId[];
  }> {
    const preset = this.resolvePreset(currentEndpoint);
    const endpointCandidate = await this.endpointBuilder.build({
      preset,
      authMode: current.authMode,
      credential: probeCredential,
      endpointUrl: endpointUrl?.trim() || this.buildEndpointUrl(currentEndpoint),
    });
    const onboarding = this.onboardingPolicy.suggest(preset, endpointCandidate);
    return {
      endpointCandidate,
      supportedAgents: onboarding.suggestedAgents.length > 0
        ? onboarding.suggestedAgents
        : onboarding.defaultEnabledAgents,
    };
  }

  private resolveEnabledAgents(
    current: AccessRecord,
    requested: AgentId[] | undefined,
    selectedAgents: AgentId[],
    supportedAgents: AgentId[] | undefined,
  ): AgentId[] {
    const allowedAgents = supportedAgents ? new Set(supportedAgents) : null;
    if (allowedAgents) {
      const unsupportedSelections = selectedAgents.filter((agentId) => !allowedAgents.has(agentId));
      if (unsupportedSelections.length > 0) {
        throw new ConnectionUpdaterValidationError(
          `Selected agents are not supported by the updated connection: ${unsupportedSelections.join(", ")}`,
        );
      }
    }

    const seed = requested ?? current.enabledAgents;
    const filtered = allowedAgents
      ? seed.filter((agentId) => allowedAgents.has(agentId))
      : [...seed];
    return [...new Set([...filtered, ...selectedAgents])];
  }

  private resolveEndpointForUpdate(
    current: AccessRecord,
    currentEndpoint: EndpointRecord,
    candidate: EndpointRegistryInput,
  ): EndpointRecord {
    if (EndpointShape.matchesRecord(currentEndpoint, candidate)) {
      return this.endpointRegistry.update(currentEndpoint.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: candidate.protocols,
      });
    }

    const existingEquivalent = this.endpointRegistry
      .list()
      .find((endpoint) => endpoint.id !== currentEndpoint.id && EndpointShape.matchesRecord(endpoint, candidate));
    if (existingEquivalent) {
      return this.endpointRegistry.update(existingEquivalent.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: candidate.protocols,
      });
    }

    const sharedEndpoint = this.accessRegistry
      .list()
      .some((access) => access.id !== current.id && access.endpointId === currentEndpoint.id);
    if (!sharedEndpoint) {
      return this.endpointRegistry.update(currentEndpoint.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: candidate.protocols,
      });
    }

    const hinted = this.endpointRegistry.get(candidate.id);
    if (hinted && hinted.rootUrl === candidate.rootUrl && hinted.profile === candidate.profile) {
      return this.endpointRegistry.update(hinted.id, {
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

  private refreshSelectedAgents(
    records: Array<{ agentId: string; appliedAt: string }>,
    connectionId: string,
  ): void {
    for (const record of records) {
      this.agentSelection.setApplied(record.agentId as AgentId, connectionId, record.appliedAt);
    }
  }

  private removeEndpointIfOrphaned(endpointId: string): void {
    const stillReferenced = this.accessRegistry.list().some((access) => access.endpointId === endpointId);
    if (!stillReferenced) {
      this.endpointRegistry.remove(endpointId);
    }
  }

  private buildEndpointUrl(endpoint: EndpointRecord): string {
    if (endpoint.protocols.openai?.basePath) {
      return `${endpoint.rootUrl}${endpoint.protocols.openai.basePath}`;
    }
    if (endpoint.protocols.anthropic?.basePath) {
      return `${endpoint.rootUrl}${endpoint.protocols.anthropic.basePath}`;
    }
    return endpoint.rootUrl;
  }

  private resolvePreset(endpoint: EndpointRecord): ConnectionPresetFamily {
    const family = EndpointShape.readFamily(endpoint);
    if (family === "cursor") {
      throw new ConnectionUpdaterValidationError("Cursor connections do not support auth updates");
    }
    return family;
  }

  private requireAccess(connectionId: string): AccessRecord {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new ConnectionUpdaterValidationError(`Connection not found: ${connectionId}`);
    }
    return access;
  }

  private requireEndpoint(endpointId: string): EndpointRecord {
    const endpoint = this.endpointRegistry.get(endpointId);
    if (!endpoint) {
      throw new ConnectionUpdaterValidationError(`Endpoint not found: ${endpointId}`);
    }
    return endpoint;
  }
}
