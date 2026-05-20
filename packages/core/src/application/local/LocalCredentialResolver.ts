import type { AgentHomes } from "../../models/agent/Homes";
import type { AgentRuntimeCommandOverrides } from "../../models/agent/RuntimeCommands";
import type {
  StoredCredential,
} from "../../services/credential/Types";
import { type EnvironmentSource } from "../../services/EnvironmentSource";
import {
  INTERACTIVE_SESSION_LOGIN_REGISTRY,
  SessionCredentialResolver,
  type InteractiveSessionLoginRegistry,
} from "../../session";
import type { LocalCredentialRequest } from "./CredentialRequest";

export class LocalCredentialResolver {
  private readonly sessionCredentialResolver: SessionCredentialResolver;

  constructor(
    private readonly agentHomes: AgentHomes | undefined,
    private readonly environment: EnvironmentSource,
    private readonly interactiveSessionLoginRegistry: Pick<
      InteractiveSessionLoginRegistry,
      "signInAndRead"
    > = INTERACTIVE_SESSION_LOGIN_REGISTRY,
    openExternalUrl?: (url: string) => Promise<void>,
    agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides,
  ) {
    this.sessionCredentialResolver = new SessionCredentialResolver(
      agentHomes,
      environment,
      interactiveSessionLoginRegistry,
      openExternalUrl,
      agentRuntimeCommandOverrides,
    );
  }

  resolve(request: LocalCredentialRequest): StoredCredential {
    if (request.authMode === "api_key") {
      return request.source === "env_key"
        ? this.resolveApiKeyEnvKey(request.envKey)
        : this.resolveApiKey(request.apiKey, request.envKey);
    }

    return this.sessionCredentialResolver.resolve(request);
  }

  async resolveAsync(request: LocalCredentialRequest): Promise<StoredCredential> {
    if (request.authMode === "api_key") {
      return this.resolve(request);
    }
    return await this.sessionCredentialResolver.resolveAsync(request);
  }

  resolveProbeCredential(request: LocalCredentialRequest): StoredCredential {
    if (request.authMode !== "api_key") {
      return this.resolve(request);
    }

    if (request.source === "env_key") {
      const envKey = request.envKey.trim();
      if (!envKey) {
        throw new Error("Environment variable name is required");
      }
      const apiKey = this.environment.read(envKey);
      if (!apiKey?.trim()) {
        throw new Error(`Environment variable ${envKey} is empty or not available`);
      }
      return this.resolveApiKey(apiKey);
    }

    return this.resolve(request);
  }

  private resolveApiKey(apiKey: string, envKey?: string): StoredCredential {
    const normalized = apiKey.trim();
    if (!normalized) {
      throw new Error("API key is required");
    }

    return {
      kind: "api_key",
      source: "direct",
      apiKey: normalized,
      ...(envKey?.trim() ? { envKey: envKey.trim() } : {}),
    };
  }

  private resolveApiKeyEnvKey(envKey: string): StoredCredential {
    const normalized = envKey.trim();
    if (!normalized) {
      throw new Error("Environment variable name is required");
    }

    return {
      kind: "api_key",
      source: "env_key",
      envKey: normalized,
    };
  }
}
