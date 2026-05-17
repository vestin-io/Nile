import type { AccessRecord } from "@nile/core/models/access";
import type { EndpointAnthropicProtocol } from "@nile/core/models/endpoint";
import { AgentProjectionError } from "@nile/core/projection/ProjectionError";
import type { AgentProjectionRegistration, ProjectionInput } from "@nile/core/projection/Types";
import { isEnvKeyApiKeyCredential, type StoredCredential } from "@nile/core/services/credential";
import { joinEndpointUrl } from "@nile/core/projection/Url";
import type { ClaudeProjection } from "./ProjectionTypes";

class ClaudeProjectionStrategy {
  resolve(input: ProjectionInput): ClaudeProjection {
    const protocol = input.endpoint.protocols.anthropic;
    if (!protocol) {
      throw new AgentProjectionError(`Endpoint ${input.endpoint.id} does not support the Anthropic protocol required by claude`);
    }

    this.validateAccess(input.access, input.credential);

    const authScheme = this.selectAuthScheme(protocol, input.access.authMode);
    const envKey = input.access.authMode === "api_key"
      ? this.selectEnvKey(protocol, authScheme, input.credential)
      : undefined;

    return {
      agentId: "claude",
      protocol: "anthropic",
      endpointId: input.endpoint.id,
      endpointLabel: input.endpoint.label,
      accessId: input.access.id,
      accessLabel: input.access.label,
      authMode: input.access.authMode as ClaudeProjection["authMode"],
      ...(authScheme ? { authScheme } : {}),
      baseUrl: joinEndpointUrl(input.endpoint.rootUrl, protocol.basePath),
      ...(envKey ? { envKey } : {}),
    };
  }

  private validateAccess(access: AccessRecord, credential: StoredCredential): void {
    if (access.authMode !== "api_key" && access.authMode !== "claude_session") {
      throw new AgentProjectionError(`Claude does not support access auth mode ${access.authMode}`);
    }

    if (access.authMode === "api_key" && credential.kind !== "api_key") {
      throw new AgentProjectionError("Claude api_key access requires an api_key credential");
    }

    if (access.authMode === "claude_session" && credential.kind !== "claude_session") {
      throw new AgentProjectionError("Claude claude_session access requires a claude_session credential");
    }
  }

  private selectAuthScheme(
    protocol: EndpointAnthropicProtocol,
    authMode: AccessRecord["authMode"],
  ): ClaudeProjection["authScheme"] {
    if (authMode !== "api_key") {
      return undefined;
    }

    if (protocol.authSchemes.includes("bearer")) {
      return "bearer";
    }
    if (protocol.authSchemes.includes("x_api_key")) {
      return "x_api_key";
    }

    throw new AgentProjectionError("Claude API-key access requires an Anthropic auth scheme");
  }

  private selectEnvKey(
    protocol: EndpointAnthropicProtocol,
    authScheme: ClaudeProjection["authScheme"],
    credential: StoredCredential,
  ): string {
    if (isEnvKeyApiKeyCredential(credential)) {
      return credential.envKey;
    }
    if (protocol.envKeyOverride) {
      return protocol.envKeyOverride;
    }

    return authScheme === "bearer" ? "ANTHROPIC_AUTH_TOKEN" : "ANTHROPIC_API_KEY";
  }
}

const STRATEGY = new ClaudeProjectionStrategy();

export const CLAUDE_PROJECTION = {
  agentId: "claude",
  resolve: (input) => STRATEGY.resolve(input),
} as const satisfies AgentProjectionRegistration;
