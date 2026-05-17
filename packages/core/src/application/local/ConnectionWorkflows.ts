import type { LocalCredentialResolver } from "./LocalCredentialResolver";
import {
  isEnvKeyApiKeyCredential,
  type StoredCredential,
} from "../../services/credential/Types";
import type {
  ConnectionCreatorContract,
  ConnectionOnboardingSuggestion,
  CreateConnectionInput,
  CreateConnectionResult,
} from "../../models/connection/Runtime";
import type { SavedConnections, SavedConnectionSummary } from "../../models/connection/SavedConnections";
import type { CreateLocalConnectionInput, UpdateConnectionInput } from "./ConnectionInputs";

export class LocalConnectionWorkflows {
  constructor(
    private readonly savedConnections: SavedConnections,
    private readonly connectionCreator: ConnectionCreatorContract,
    private readonly createLocalCredentialResolver: () => LocalCredentialResolver,
  ) {}

  async update(
    input: UpdateConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.createLocalCredentialResolver(),
  ): Promise<SavedConnectionSummary> {
    const currentCredential = input.credentialRequest === undefined && input.endpointUrl !== undefined
      ? this.savedConnections.readCredential(input.connectionId)
      : undefined;
    const credential = input.credentialRequest
      ? await localCredentialResolver.resolveAsync(input.credentialRequest)
      : currentCredential;
    return await this.savedConnections.update({
      connectionId: input.connectionId,
      label: input.label,
      enabledAgents: input.enabledAgents,
      endpointUrl: input.endpointUrl,
      credential,
      probeCredential: input.credentialRequest
        ? localCredentialResolver.resolveProbeCredential(input.credentialRequest)
        : currentCredential
          ? this.readProbeCredential(currentCredential, localCredentialResolver)
          : undefined,
    });
  }

  async createLocalWithResolver(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver,
  ): Promise<CreateConnectionResult> {
    return await this.connectionCreator.create(
      await this.buildCreateConnectionInput(input, localCredentialResolver, input.enabledAgents),
    );
  }

  async describeLocalOnboardingWithResolver(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver,
  ): Promise<ConnectionOnboardingSuggestion> {
    return await this.connectionCreator.describeOnboarding(
      await this.buildCreateConnectionInput(input, localCredentialResolver),
    );
  }

  private async buildCreateConnectionInput(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver,
    enabledAgents?: CreateLocalConnectionInput["enabledAgents"],
  ): Promise<CreateConnectionInput> {
    const credential = await localCredentialResolver.resolveAsync(input.credentialRequest);
    return {
      preset: input.preset,
      authMode: input.authMode,
      credential,
      probeCredential: this.resolveProbeCredential(input.credentialRequest, credential, localCredentialResolver),
      endpointUrl: input.endpointUrl,
      label: input.label?.trim() || undefined,
      enabledAgents,
      allowUndetectedGateway: input.allowUndetectedGateway,
    };
  }

  private readProbeCredential(
    credential: StoredCredential,
    localCredentialResolver: LocalCredentialResolver,
  ): StoredCredential {
    if (!isEnvKeyApiKeyCredential(credential)) {
      return credential;
    }
    return localCredentialResolver.resolveProbeCredential({
      authMode: "api_key",
      source: "env_key",
      envKey: credential.envKey,
    });
  }

  private resolveProbeCredential(
    request: CreateLocalConnectionInput["credentialRequest"],
    credential: StoredCredential,
    localCredentialResolver: LocalCredentialResolver,
  ): StoredCredential {
    if (request.authMode === "api_key" && request.source === "env_key") {
      return localCredentialResolver.resolveProbeCredential(request);
    }

    return credential;
  }
}
