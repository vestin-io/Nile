import type { AccessRegistry } from "../../models/access";
import type { AccessRecord } from "../../models/access";
import type { AgentId } from "../../models/agent/Types";
import type { EndpointRegistry } from "../../models/endpoint";
import type { EndpointRecord } from "../../models/endpoint";
import type { AgentSelection } from "../../models/selection/Selection";
import {
  type AgentProjection,
  AgentProjectionResolver,
} from "../../projection";
import type { CredentialStore } from "../../services/credential/Store";
import type { StoredCredential } from "../../services/credential/Types";
import type { NileLogger } from "../../services/NileLogger";
import type { ApplyAgentSelectionResult } from "../../models/agent";

export type PreparedAgentApplySelection = {
  connectionId: string;
  endpoint: EndpointRecord;
  access: AccessRecord;
  credential: StoredCredential;
  projection: AgentProjection;
  appliedAt: string;
};

type BuildValidationError = (message: string) => Error;

export class AgentApplySupport {
  constructor(
    private readonly agentId: AgentId,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentSelection: AgentSelection,
    private readonly credentialStore: CredentialStore,
    private readonly logger: NileLogger,
    private readonly buildValidationError: BuildValidationError,
    private readonly projectionResolver: AgentProjectionResolver = new AgentProjectionResolver(),
  ) {}

  prepare(connectionId: string): PreparedAgentApplySelection {
    const access = this.requireAccess(connectionId);
    const endpoint = this.requireEndpoint(access.endpointId);

    const credential = this.credentialStore.get(access.credentialSource.reference);
    let projection: AgentProjection;
    try {
      projection = this.projectionResolver.resolve(this.agentId, {
        endpoint,
        access,
        credential,
      });
    } catch (error) {
      throw this.buildValidationError(error instanceof Error ? error.message : String(error));
    }

    const prepared: PreparedAgentApplySelection = {
      connectionId,
      endpoint,
      access,
      credential,
      projection,
      appliedAt: new Date().toISOString(),
    };

    this.logger.info(`${this.agentId}.apply.start`, {
      connectionId,
      endpointId: endpoint.id,
      accessId: access.id,
      authMode: access.authMode,
    });
    return prepared;
  }

  complete(prepared: PreparedAgentApplySelection): ApplyAgentSelectionResult {
    this.agentSelection.setApplied(
      this.agentId,
      prepared.connectionId,
      prepared.appliedAt,
    );
    this.logger.info(`${this.agentId}.apply.success`, {
      endpointId: prepared.endpoint.id,
      accessId: prepared.access.id,
      authMode: prepared.access.authMode,
      appliedAt: prepared.appliedAt,
    });
    return {
      agentId: this.agentId,
      connectionId: prepared.connectionId,
      connectionLabel: prepared.access.label,
      endpointId: prepared.endpoint.id,
      endpointLabel: prepared.endpoint.label,
      accessId: prepared.access.id,
      appliedAt: prepared.appliedAt,
    };
  }

  logRollback(error: unknown, prepared: PreparedAgentApplySelection): void {
    this.logger.error(`${this.agentId}.apply.rollback`, error, {
      connectionId: prepared.connectionId,
      endpointId: prepared.endpoint.id,
      accessId: prepared.access.id,
    });
  }

  private requireAccess(connectionId: string): AccessRecord {
    const access = this.accessRegistry.get(connectionId.trim());
    if (!access) {
      throw this.buildValidationError(`Connection not found: ${connectionId}`);
    }
    return access;
  }

  private requireEndpoint(endpointId: string): EndpointRecord {
    const endpoint = this.endpointRegistry.get(endpointId.trim());
    if (!endpoint) {
      throw this.buildValidationError(`Endpoint not found: ${endpointId}`);
    }
    return endpoint;
  }
}
