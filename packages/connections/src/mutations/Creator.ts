import type { AccessRegistry } from "@nile/core/models/access";
import type { AccessRegistryInput } from "@nile/core/models/access";
import type { EndpointRegistry } from "@nile/core/models/endpoint";
import { EndpointShape, type EndpointRecord } from "@nile/core/models/endpoint";
import {
  type ConnectionOnboardingSuggestion,
  type CreateConnectionInput,
  type CreateConnectionResult,
  type GatewayCapabilityProbe,
} from "@nile/core/models/connection";
import { ConnectionUpsert } from "@nile/core/models/connection/Upsert";

import { ConnectionPreparationSupport } from "./Preparation";
import { GatewayProbe } from "../setup";

export class ConnectionCreator {
  private readonly preparation: ConnectionPreparationSupport;
  private readonly upsert: ConnectionUpsert;

  constructor(
    endpointRegistry: EndpointRegistry,
    accessRegistry: AccessRegistry,
    gatewayProbe: GatewayCapabilityProbe = new GatewayProbe(),
  ) {
    this.preparation = new ConnectionPreparationSupport(gatewayProbe);
    this.upsert = new ConnectionUpsert(endpointRegistry, accessRegistry);
  }

  async create(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    const prepared = await this.preparation.prepareCreate(input);
    const result = this.upsert.upsert({
      endpoint: prepared.endpointCandidate,
      access: {
        idHint: input.id,
        label: prepared.label,
        authMode: input.authMode,
        credential: input.credential,
        identityKey: prepared.identityKey,
        enabledAgents: prepared.enabledAgents,
        enabledAgentsMode: "replace",
      },
    });
    return this.toResult(result.endpoint, result.access, result.reused);
  }

  async describeOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion> {
    return await this.preparation.describeOnboarding(input);
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
