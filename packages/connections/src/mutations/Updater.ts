import type { StoredCredential } from "@nile/core/services/credential/Types";
import { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";
import type { AccessRecord, AccessRegistry } from "@nile/core/models/access";
import type { AgentId } from "@nile/core/models/agent";
import type { EndpointRecord, EndpointRegistry, EndpointRegistryInput } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection/Selection";
import type { GatewayCapabilityProbe, UpdateConnectionInput } from "@nile/core/models/connection";

import { ConnectionEndpointUpdateSupport } from "./EndpointUpdate";
import { ConnectionPreparationSupport } from "./Preparation";
import { ConnectionUpdaterValidationError } from "./Error";
import { GatewayProbe } from "../setup";

export class ConnectionUpdater {
  private readonly preparation: ConnectionPreparationSupport;
  private readonly endpointUpdate: ConnectionEndpointUpdateSupport;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    gatewayProbe: GatewayCapabilityProbe = new GatewayProbe(),
  ) {
    this.preparation = new ConnectionPreparationSupport(gatewayProbe);
    this.endpointUpdate = new ConnectionEndpointUpdateSupport(endpointRegistry, accessRegistry);
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
      ? (prepared?.identityKey ?? null)
      : undefined;

    const currentAccess = this.requireAccess(input.connectionId);
    const endpoint = prepared
      ? this.endpointUpdate.resolveUpdatedEndpoint(currentAccess, currentEndpoint, prepared.endpointCandidate)
      : this.requireEndpoint(currentAccess.endpointId);
    const updated = this.accessRegistry.update(
      currentAccess.id,
      {
        endpointId: endpoint.id,
        label: input.label ?? currentAccess.label,
        identityKey: nextIdentityKey === undefined ? undefined : nextIdentityKey,
        enabledAgents: nextEnabledAgents,
      },
      nextCredential,
    );

    if (currentAccess.endpointId !== endpoint.id) {
      this.refreshSelectedAgents(selectedRecords, updated.id);
      this.endpointUpdate.removeIfOrphaned(currentAccess.endpointId);
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
    identityKey: string | null;
  }> {
    try {
      const preset = this.endpointUpdate.resolveUpdatablePreset(currentEndpoint);
      return await this.preparation.prepareUpdate({
        preset,
        authMode: current.authMode,
        credential,
        probeCredential,
        endpointUrl: endpointUrl?.trim() || this.endpointUpdate.readPreparationUrl(currentEndpoint),
      });
    } catch (error) {
      throw error instanceof ConnectionUpdaterValidationError
        ? error
        : new ConnectionUpdaterValidationError(error instanceof Error ? error.message : String(error));
    }
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

  private refreshSelectedAgents(
    records: Array<{ agentId: string; appliedAt: string }>,
    connectionId: string,
  ): void {
    for (const record of records) {
      this.agentSelection.setApplied(record.agentId as AgentId, connectionId, record.appliedAt);
    }
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
