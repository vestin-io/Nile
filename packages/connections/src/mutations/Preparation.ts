import type { StoredCredential } from "@nile/core/services/credential/Types";
import type { AuthMode } from "@nile/core/models/access";
import type { AgentId } from "@nile/core/models/agent";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { ConnectionPresetFamily } from "@nile/core/models/connection/preset";

import { ConnectionEndpointBuilder } from "../setup";
import { GatewayProbe, type GatewayCapabilityProbe } from "../setup";
import {
  ConnectionIdentityKeyResolver,
  ConnectionOnboardingPolicy,
  type ConnectionOnboardingSuggestion,
} from "../support";
import { ConnectionLabeler } from "../labeling";

export type CreateConnectionPreparationInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
  credential: StoredCredential;
  probeCredential?: StoredCredential;
  endpointUrl?: string;
  label?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
};

export type CreateConnectionPreparation = {
  endpointCandidate: EndpointRegistryInput;
  onboarding: ConnectionOnboardingSuggestion;
  label: string;
  identityKey: string | null;
  enabledAgents: AgentId[];
};

export type UpdateConnectionPreparation = {
  endpointCandidate: EndpointRegistryInput;
  supportedAgents: AgentId[];
  identityKey: string | null;
};

export class ConnectionPreparationSupport {
  private readonly labeler = new ConnectionLabeler();
  private readonly endpointBuilder: ConnectionEndpointBuilder;
  private readonly onboardingPolicy = new ConnectionOnboardingPolicy();
  private readonly identityKeyResolver = new ConnectionIdentityKeyResolver();

  constructor(gatewayProbe: GatewayCapabilityProbe = new GatewayProbe()) {
    this.endpointBuilder = new ConnectionEndpointBuilder(gatewayProbe);
  }

  async prepareCreate(input: CreateConnectionPreparationInput): Promise<CreateConnectionPreparation> {
    const described = await this.describe(input);
    const label = input.label?.trim() || this.labeler.suggestAccessLabel(
      input.preset,
      input.authMode,
      input.credential,
      { endpointUrl: input.endpointUrl },
    );
    const identityKey = this.identityKeyResolver.resolve(input.authMode, input.credential);

    return {
      endpointCandidate: described.endpointCandidate,
      onboarding: described.onboarding,
      label,
      identityKey,
      enabledAgents: input.enabledAgents ?? described.onboarding.defaultEnabledAgents,
    };
  }

  async describeOnboarding(input: CreateConnectionPreparationInput): Promise<ConnectionOnboardingSuggestion> {
    return (await this.describe(input)).onboarding;
  }

  async prepareUpdate(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    credential: StoredCredential;
    probeCredential: StoredCredential;
    endpointUrl: string;
  }): Promise<UpdateConnectionPreparation> {
    const endpointCandidate = await this.endpointBuilder.build({
      preset: input.preset,
      authMode: input.authMode,
      credential: input.probeCredential,
      endpointUrl: input.endpointUrl,
    });
    const onboarding = this.onboardingPolicy.suggest(input.preset, endpointCandidate);

    return {
      endpointCandidate,
      supportedAgents: onboarding.defaultEnabledAgents,
      identityKey: this.identityKeyResolver.resolve(input.authMode, input.credential),
    };
  }

  private async describe(input: CreateConnectionPreparationInput): Promise<{
    endpointCandidate: EndpointRegistryInput;
    onboarding: ConnectionOnboardingSuggestion;
  }> {
    const endpointCandidate = await this.endpointBuilder.build({
      ...input,
      credential: input.probeCredential ?? input.credential,
    });
    return {
      endpointCandidate,
      onboarding: this.onboardingPolicy.suggest(input.preset, endpointCandidate),
    };
  }
}
