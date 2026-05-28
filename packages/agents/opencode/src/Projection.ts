import type { AccessRecord } from "@nile/core/models/access";
import type { EndpointAuthScheme, EndpointRecord } from "@nile/core/models/endpoint";
import { AgentProjectionError } from "@nile/core/projection/ProjectionError";
import type { AgentProjectionRegistration, ProjectionInput } from "@nile/core/projection/Types";
import type { StoredCredential } from "@nile/core/services/credential";
import { joinEndpointUrl } from "@nile/core/projection/Url";
import type { OpenCodeProjection, OpenCodeProviderPackage } from "./ProjectionTypes";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

class OpenCodeProjectionStrategy {
  resolve(input: ProjectionInput): OpenCodeProjection {
    const modelId = input.modelId?.trim();
    if (!modelId) {
      throw new AgentProjectionError("OpenCode requires a saved modelId on the selected connection");
    }

    if (this.isOfficialOpenAiSession(input)) {
      return {
        agentId: "opencode",
        protocol: "openai",
        endpointId: input.endpoint.id,
        endpointLabel: input.endpoint.label,
        accessId: input.access.id,
        accessLabel: input.access.label,
        authMode: "openai_session",
        modelId,
        wireApi: "responses",
      };
    }

    this.validateProviderAccess(input.access, input.credential);

    if (input.endpoint.protocols.openai) {
      const protocol = input.endpoint.protocols.openai;
      const baseUrl = joinEndpointUrl(input.endpoint.rootUrl, protocol.basePath);
      const wireApi = protocol.wireApis[0] ?? "responses";
      const providerPackage = this.selectOpenAiProviderPackage(input.endpoint, wireApi);

      return {
        agentId: "opencode",
        protocol: "openai",
        endpointId: input.endpoint.id,
        endpointLabel: input.endpoint.label,
        accessId: input.access.id,
        accessLabel: input.access.label,
        authMode: "api_key",
        providerPackage,
        ...(this.shouldPersistBaseUrl(providerPackage, baseUrl, "openai") ? { baseUrl } : {}),
        wireApi,
        modelId,
      };
    }

    if (input.endpoint.protocols.anthropic) {
      const protocol = input.endpoint.protocols.anthropic;
      const baseUrl = joinEndpointUrl(input.endpoint.rootUrl, protocol.basePath);
      const authScheme = this.selectAnthropicAuthScheme(input.endpoint, input.access);

      return {
        agentId: "opencode",
        protocol: "anthropic",
        endpointId: input.endpoint.id,
        endpointLabel: input.endpoint.label,
        accessId: input.access.id,
        accessLabel: input.access.label,
        authMode: "api_key",
        providerPackage: "@ai-sdk/anthropic",
        ...(this.shouldPersistBaseUrl("@ai-sdk/anthropic", baseUrl, "anthropic") ? { baseUrl } : {}),
        ...(authScheme ? { authScheme } : {}),
        ...(protocol.versionHeader ? { versionHeader: protocol.versionHeader } : {}),
        modelId,
      };
    }

    throw new AgentProjectionError(`Endpoint ${input.endpoint.id} does not support an OpenCode-compatible protocol`);
  }

  private validateProviderAccess(access: AccessRecord, credential: StoredCredential): void {
    if (access.authMode !== "api_key") {
      throw new AgentProjectionError(`OpenCode does not support access auth mode ${access.authMode}`);
    }
    if (credential.kind !== "api_key") {
      throw new AgentProjectionError("OpenCode api_key access requires an api_key credential");
    }
  }

  private isOfficialOpenAiSession(input: ProjectionInput): boolean {
    if (input.endpoint.profile !== "openai-official" || !input.endpoint.protocols.openai) {
      return false;
    }
    if (input.access.authMode !== "openai_session") {
      return false;
    }
    if (input.credential.kind !== "openai_session") {
      throw new AgentProjectionError("OpenCode openai_session access requires an openai_session credential");
    }
    return true;
  }

  private selectOpenAiProviderPackage(
    endpoint: EndpointRecord,
    wireApi: "chat" | "responses",
  ): OpenCodeProviderPackage {
    if (endpoint.profile === "openai-official" && wireApi === "responses") {
      return "@ai-sdk/openai";
    }
    return "@ai-sdk/openai-compatible";
  }

  private selectAnthropicAuthScheme(
    endpoint: EndpointRecord,
    access: AccessRecord,
  ): Extract<EndpointAuthScheme, "x_api_key" | "bearer"> | undefined {
    const protocol = endpoint.protocols.anthropic;
    if (!protocol) {
      throw new AgentProjectionError(`Endpoint ${endpoint.id} does not support Anthropic`);
    }
    if (access.authMode !== "api_key") {
      return undefined;
    }
    if (protocol.authSchemes.includes("x_api_key")) {
      return "x_api_key";
    }
    if (protocol.authSchemes.includes("bearer")) {
      return "bearer";
    }
    return undefined;
  }

  private shouldPersistBaseUrl(
    providerPackage: OpenCodeProviderPackage,
    baseUrl: string,
    protocol: "openai" | "anthropic",
  ): boolean {
    if (providerPackage === "@ai-sdk/openai-compatible") {
      return true;
    }
    if (providerPackage === "@ai-sdk/openai") {
      return baseUrl !== DEFAULT_OPENAI_BASE_URL;
    }
    if (protocol === "anthropic") {
      return baseUrl !== DEFAULT_ANTHROPIC_BASE_URL;
    }
    return true;
  }
}

const STRATEGY = new OpenCodeProjectionStrategy();

export const OPENCODE_PROJECTION = {
  agentId: "opencode",
  resolve: (input) => STRATEGY.resolve(input),
} as const satisfies AgentProjectionRegistration;
