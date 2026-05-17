import {
  isDirectApiKeyCredential,
  type StoredCredential,
} from "@nile/core/services/credential/Types";
import type { AgentId } from "@nile/core/models/agent/definitions";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { GatewayCapabilityProbe } from "@nile/core/models/connection";
import { ConnectionLabeler } from "../labeling";
import { ConnectionNaming } from "@nile/core/models/connection/Naming";

export class GatewayEndpointBuilder {
  private readonly labeler = new ConnectionLabeler();

  constructor(private readonly gatewayProbe: GatewayCapabilityProbe) {}

  async build(input: {
    endpointUrl?: string;
    credential: StoredCredential;
    enabledAgents?: AgentId[];
    allowUndetectedGateway: boolean;
  }): Promise<EndpointRegistryInput> {
    const normalizedEndpointUrl = input.endpointUrl?.trim();
    if (!normalizedEndpointUrl) {
      throw new Error("Endpoint URL is required for gateway connections");
    }
    if (!isDirectApiKeyCredential(input.credential)) {
      throw new Error("Gateway probing requires an api_key credential");
    }

    const parsed = new URL(normalizedEndpointUrl);
    const rootUrl = parsed.origin;
    const basePath = this.normalizePath(parsed.pathname);
    const label = this.labeler.suggestEndpointLabel("gateway", { endpointUrl: normalizedEndpointUrl });
    let protocols: EndpointRegistryInput["protocols"];

    try {
      const detected = await this.gatewayProbe.probe(normalizedEndpointUrl, input.credential.apiKey);
      protocols = {};

      if (detected.openai) {
        protocols.openai = detected.openai;
      }
      if (detected.anthropic) {
        protocols.anthropic = detected.anthropic;
      }
    } catch (error) {
      if (!input.allowUndetectedGateway) {
        throw error;
      }
      protocols = this.buildFallbackProtocols(basePath, input.enabledAgents);
    }

    return {
      id: this.suggestEndpointId("gateway", label, rootUrl),
      label,
      rootUrl,
      profile: "generic-gateway",
      protocols,
    };
  }

  private buildFallbackProtocols(
    basePath: string | undefined,
    enabledAgents: AgentId[] | undefined,
  ): EndpointRegistryInput["protocols"] {
    const selectedAgents = new Set(enabledAgents ?? []);
    const protocols: EndpointRegistryInput["protocols"] = {};

    if (selectedAgents.has("codex")) {
      protocols.openai = {
        ...(basePath ? { basePath } : {}),
        wireApis: ["responses"],
        authSchemes: ["bearer"],
        envKeyOverride: "OPENAI_API_KEY",
      };
    }

    if (selectedAgents.has("claude")) {
      protocols.anthropic = {
        ...(basePath ? { basePath } : {}),
        authSchemes: ["x_api_key"],
        envKeyOverride: "ANTHROPIC_API_KEY",
        versionHeader: "2023-06-01",
      };
    }

    if (!protocols.openai && !protocols.anthropic) {
      protocols.openai = {
        ...(basePath ? { basePath } : {}),
        wireApis: ["responses"],
        authSchemes: ["bearer"],
        envKeyOverride: "OPENAI_API_KEY",
      };
    }

    return protocols;
  }

  private suggestEndpointId(prefix: string, label: string, rootUrl: string): string {
    const host = ConnectionNaming.prettifyHost(rootUrl);
    if (host) {
      return ConnectionNaming.createSlug(`${prefix}-${host}`);
    }
    return ConnectionNaming.createSlug(`${prefix}-${label}`);
  }

  private normalizePath(pathname: string): string | undefined {
    const normalized = pathname.replace(/\/+$/, "");
    if (!normalized || normalized === "/") {
      return undefined;
    }
    return normalized;
  }
}
