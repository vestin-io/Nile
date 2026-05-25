import {
  type LocalCredentialRequest,
  LocalCredentialRequestBuilder,
} from "@nile/builtins/local";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type {
  CredentialStorageBackend,
  StoredCredential,
} from "@nile/core/services/credential";
import { isEnvKeyApiKeyCredential } from "@nile/core/services/credential";

import type {
  DesktopAddConnectionInput,
  DesktopUpdateConnectionInput,
} from "./contracts";

type ProbeCredentialResolver = {
  resolveProbeCredential(request: LocalCredentialRequest): StoredCredential;
};

export class DesktopConnectionInputBuilder {
  private readonly requests = new LocalCredentialRequestBuilder();

  resolveCredentialRequest(input: DesktopAddConnectionInput): LocalCredentialRequest {
    return this.requests.build({
      authMode: input.authMode,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      sessionSource: input.sessionSource,
      sessionAuthJsonPath: input.sessionAuthJsonPath,
    });
  }

  resolveUpdateCredentialRequest(
    input: DesktopUpdateConnectionInput,
    authMode: SavedConnectionSummary["authMode"],
  ): LocalCredentialRequest | undefined {
    return this.requests.buildUpdate(authMode, {
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      sessionSource: input.sessionSource,
      sessionAuthJsonPath: input.sessionAuthJsonPath,
    });
  }

  buildLocalConnectionInput(
    input: DesktopAddConnectionInput,
    credentialStorageBackend: CredentialStorageBackend,
  ) {
    if (input.authMode === "openclaw_openai_session") {
      throw new Error("OpenClaw-only OpenAI sessions cannot be created from the add-connection form");
    }

    return {
      preset: input.preset,
      authMode: input.authMode,
      credentialRequest: this.resolveCredentialRequest(input),
      credentialStorageBackend,
      endpointUrl: input.endpointUrl,
      label: input.label,
      enabledAgents: input.enabledAgents,
      allowUndetectedGateway: input.allowUndetectedGateway,
    };
  }

  resolveProbeCredential(
    request: LocalCredentialRequest | undefined,
    credential: StoredCredential,
    resolver: ProbeCredentialResolver,
  ): StoredCredential {
    if (request?.authMode === "api_key" && request.source === "env_key") {
      return resolver.resolveProbeCredential(request);
    }

    if (isEnvKeyApiKeyCredential(credential)) {
      return resolver.resolveProbeCredential({
        authMode: "api_key",
        source: "env_key",
        envKey: credential.envKey,
      });
    }

    return credential;
  }
}
