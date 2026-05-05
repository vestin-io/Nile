import type { AccessRecord } from "../../models/access";
import type { EndpointRecord } from "../../models/endpoint";
import type { StoredCredential } from "../../services/credential/Types";
import { AgentProjectionError } from "../ProjectionError";
import type { OpenClawProjection, ProjectionInput } from "../Types";
import { joinEndpointUrl } from "../Url";

export class OpenClawProjectionStrategy {
  resolve(input: ProjectionInput): OpenClawProjection {
    this.validateAccess(input.access, input.credential);

    const modelId = input.access.openclawModelId?.trim();
    if (!modelId) {
      throw new AgentProjectionError(
        "OpenClaw requires a saved openclawModelId on the selected connection",
      );
    }

    if (input.endpoint.protocols.openai) {
      const protocol = input.endpoint.protocols.openai;
      return {
        agentId: "openclaw",
        protocol: "openai",
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

  private validateAccess(access: AccessRecord, credential: StoredCredential): void {
    if (access.authMode !== "api_key") {
      throw new AgentProjectionError(`OpenClaw does not support access auth mode ${access.authMode}`);
    }
    if (credential.kind !== "api_key") {
      throw new AgentProjectionError("OpenClaw api_key access requires an api_key credential");
    }
  }

  private selectAnthropicAuthScheme(
    endpoint: EndpointRecord,
    access: AccessRecord,
  ): OpenClawProjection["authScheme"] {
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
