import type { AccessRecord } from "../../models/access";
import type { EndpointAuthScheme, EndpointRecord } from "../../models/endpoint";
import type { StoredCredential } from "../../services/credential/Types";
import { AgentProjectionError } from "../ProjectionError";
import type { OpenClawProjection, ProjectionInput } from "../Types";
import { joinEndpointUrl } from "../Url";

export class OpenClawProjectionStrategy {
  resolve(input: ProjectionInput): OpenClawProjection {
    const modelId = input.access.openclawModelId?.trim();
    if (!modelId) {
      throw new AgentProjectionError(
        "OpenClaw requires a saved openclawModelId on the selected connection",
      );
    }

    if (this.isOfficialOpenAiEndpoint(input) && this.supportsOfficialOpenAiAuth(input.access, input.credential)) {
      return {
        agentId: "openclaw",
        protocol: "openai",
        configKind: "auth_profile",
        endpointId: input.endpoint.id,
        endpointLabel: input.endpoint.label,
        accessId: input.access.id,
        accessLabel: input.access.label,
        authMode: input.access.authMode === "openai_session" ? "openai_session" : "api_key",
        providerId: input.access.authMode === "openai_session" ? "openai-codex" : "openai",
        profileMode: input.access.authMode === "openai_session" ? "oauth" : "api_key",
        modelId,
      };
    }

    if (this.isOfficialAnthropicEndpoint(input) && this.supportsOfficialAnthropicAuth(input.access, input.credential)) {
      return {
        agentId: "openclaw",
        protocol: "anthropic",
        configKind: "auth_profile",
        endpointId: input.endpoint.id,
        endpointLabel: input.endpoint.label,
        accessId: input.access.id,
        accessLabel: input.access.label,
        authMode: input.access.authMode === "claude_session" ? "claude_session" : "api_key",
        providerId: "anthropic",
        profileMode:
          input.access.authMode === "claude_session"
            ? "oauth"
            : this.selectAnthropicAuthScheme(input.endpoint, input.access) === "bearer"
              ? "token"
              : "api_key",
        modelId,
      };
    }

    this.validateProviderAccess(input.access, input.credential);

    if (input.endpoint.protocols.openai) {
      const protocol = input.endpoint.protocols.openai;
      return {
        agentId: "openclaw",
        protocol: "openai",
        configKind: "provider",
        endpointId: input.endpoint.id,
        endpointLabel: input.endpoint.label,
        accessId: input.access.id,
        accessLabel: input.access.label,
        authMode: "api_key",
        baseUrl: joinEndpointUrl(input.endpoint.rootUrl, protocol.basePath),
        wireApi: protocol.wireApis[0] ?? "responses",
        modelId,
      };
    }

    if (input.endpoint.protocols.anthropic) {
      const protocol = input.endpoint.protocols.anthropic;
      return {
        agentId: "openclaw",
        protocol: "anthropic",
        configKind: "provider",
        endpointId: input.endpoint.id,
        endpointLabel: input.endpoint.label,
        accessId: input.access.id,
        accessLabel: input.access.label,
        authMode: "api_key",
        baseUrl: joinEndpointUrl(input.endpoint.rootUrl, protocol.basePath),
        authScheme: this.selectAnthropicAuthScheme(input.endpoint, input.access),
        modelId,
      };
    }

    throw new AgentProjectionError(
      `Endpoint ${input.endpoint.id} does not support an OpenClaw-compatible protocol`,
    );
  }

  private validateProviderAccess(access: AccessRecord, credential: StoredCredential): void {
    if (access.authMode !== "api_key") {
      throw new AgentProjectionError(`OpenClaw does not support access auth mode ${access.authMode}`);
    }
    if (credential.kind !== "api_key") {
      throw new AgentProjectionError("OpenClaw api_key access requires an api_key credential");
    }
  }

  private supportsOfficialOpenAiAuth(access: AccessRecord, credential: StoredCredential): boolean {
    if (access.authMode === "openai_session") {
      if (credential.kind !== "openai_session") {
        throw new AgentProjectionError("OpenClaw openai_session access requires an openai_session credential");
      }
      return true;
    }
    if (access.authMode === "api_key") {
      if (credential.kind !== "api_key") {
        throw new AgentProjectionError("OpenClaw api_key access requires an api_key credential");
      }
      return true;
    }
    return false;
  }

  private supportsOfficialAnthropicAuth(access: AccessRecord, credential: StoredCredential): boolean {
    if (access.authMode === "claude_session") {
      if (credential.kind !== "claude_session") {
        throw new AgentProjectionError("OpenClaw claude_session access requires a claude_session credential");
      }
      return true;
    }
    if (access.authMode === "api_key") {
      if (credential.kind !== "api_key") {
        throw new AgentProjectionError("OpenClaw api_key access requires an api_key credential");
      }
      return true;
    }
    return false;
  }

  private isOfficialOpenAiEndpoint(input: ProjectionInput): boolean {
    return input.endpoint.profile === "openai-official" && Boolean(input.endpoint.protocols.openai);
  }

  private isOfficialAnthropicEndpoint(input: ProjectionInput): boolean {
    return input.endpoint.profile === "anthropic-official" && Boolean(input.endpoint.protocols.anthropic);
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
}
