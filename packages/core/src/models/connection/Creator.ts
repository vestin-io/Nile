import type { StoredCredential } from "../../services/credential/Types";
import type { AccessRegistry } from "../access";
import type { AccessRegistryInput, AuthMode } from "../access";
import type { AgentId } from "../agent";
import type { EndpointRegistry } from "../endpoint";
import { EndpointShape, type EndpointFamily, type EndpointRecord } from "../endpoint";
import { ConnectionLabeler } from "./Labeler";
import { ConnectionEndpointBuilder } from "./setup/EndpointBuilder";
import { GatewayProbe, type GatewayCapabilityProbe } from "./setup/GatewayProbe";
import { ConnectionIdentityKeyResolver } from "./setup/IdentityKeyResolver";
import { ConnectionOnboardingPolicy, type ConnectionOnboardingSuggestion } from "./setup/OnboardingPolicy";
import type { ConnectionPresetFamily } from "./setup/PresetTypes";
import { ConnectionUpsert } from "./Upsert";

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
  private readonly upsert: ConnectionUpsert;

  constructor(
    endpointRegistry: EndpointRegistry,
    accessRegistry: AccessRegistry,
    gatewayProbe: GatewayCapabilityProbe = new GatewayProbe(),
  ) {
    this.endpointBuilder = new ConnectionEndpointBuilder(gatewayProbe);
    this.upsert = new ConnectionUpsert(endpointRegistry, accessRegistry);
  }

  async create(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    const endpointCandidate = await this.endpointBuilder.build({
      ...input,
      credential: input.probeCredential ?? input.credential,
    });
    const onboarding = this.onboardingPolicy.suggest(input.preset, endpointCandidate);
    const label = input.label?.trim() || this.suggestAccessLabel(input);
    const identityKey = this.identityKeyResolver.resolve(input.authMode, input.credential);
    const result = this.upsert.upsert({
      endpoint: endpointCandidate,
      access: {
        idHint: input.id,
        label,
        authMode: input.authMode,
        credential: input.credential,
        identityKey,
        openclawModelId: input.openclawModelId ?? null,
        enabledAgents: input.enabledAgents ?? onboarding.defaultEnabledAgents,
        enabledAgentsMode: "replace",
      },
    });
    return this.toResult(result.endpoint, result.access, result.reused);
  }

  async describeOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion> {
    const endpointCandidate = await this.endpointBuilder.build({
      ...input,
      credential: input.probeCredential ?? input.credential,
    });
    return this.onboardingPolicy.suggest(input.preset, endpointCandidate);
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
