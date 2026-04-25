import type { AccessRecord } from "../../models/access";
import type { EndpointAnthropicProtocol } from "../../models/endpoint";
import { isEnvKeyApiKeyCredential, type StoredCredential } from "../../services/credential/Types";
import { AgentProjectionError } from "../ProjectionError";
import type { AgentProjectionStrategy, ClaudeProjection, ProjectionInput } from "../Types";
import { joinEndpointUrl } from "../Url";

const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

export class ClaudeProjectionStrategy implements AgentProjectionStrategy {
  readonly agentId = "claude" as const;

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
      agentId: this.agentId,
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
