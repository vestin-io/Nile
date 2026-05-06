import {
  isDirectApiKeyCredential,
  type StoredCredential,
} from "../../../services/credential/Types";
import type { AuthMode } from "../../access";
import type { AgentId } from "../../agent/Types";
import type { EndpointProfile, EndpointRegistryInput } from "../../endpoint";
import { ConnectionLabeler } from "../Labeler";
import { ConnectionNaming } from "../Naming";
import type { ConnectionPresetFamily } from "./PresetTypes";
import { GatewayProbe, type GatewayCapabilityProbe } from "./GatewayProbe";

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export class ConnectionEndpointBuilder {
  private readonly labeler = new ConnectionLabeler();

  constructor(private readonly gatewayProbe: GatewayCapabilityProbe = new GatewayProbe()) {}

  async build(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    credential: StoredCredential;
    endpointUrl?: string;
    enabledAgents?: AgentId[];
    allowUndetectedGateway?: boolean;
  }): Promise<EndpointRegistryInput> {
    switch (input.preset) {
      case "openai":
        return {
          id: "openai",
          label: "OpenAI",
          rootUrl: "https://api.openai.com",
          profile: "openai-official",
          protocols: {
            openai: {
              basePath: "/v1",
              wireApis: ["responses"],
              authSchemes: ["bearer"],
            },
          },
        };
      case "gateway":
        return await this.buildGateway(
          input.endpointUrl,
          input.credential,
          input.enabledAgents,
          input.allowUndetectedGateway === true,
        );
      case "azure-openai":
        return this.buildOpenAi("azure-openai", input.endpointUrl, "azure-openai");
      case "anthropic":
        return this.buildAnthropic(input.endpointUrl, input.authMode);
      default:
        throw new Error(`Unsupported connection preset: ${input.preset}`);
    }
  }

  private async buildGateway(
    endpointUrl: string | undefined,
    credential: StoredCredential,
    enabledAgents: AgentId[] | undefined,
    allowUndetectedGateway: boolean,
  ): Promise<EndpointRegistryInput> {
    const normalizedEndpointUrl = endpointUrl?.trim();
    if (!normalizedEndpointUrl) {
      throw new Error("Endpoint URL is required for gateway connections");
    }
    if (!isDirectApiKeyCredential(credential)) {
      throw new Error("Gateway probing requires an api_key credential");
    }

    const parsed = new URL(normalizedEndpointUrl);
    const rootUrl = parsed.origin;
    const basePath = this.normalizePath(parsed.pathname);
    const label = this.labeler.suggestEndpointLabel("gateway", { endpointUrl: normalizedEndpointUrl });
    let protocols: EndpointRegistryInput["protocols"];

    try {
      const detected = await this.gatewayProbe.probe(normalizedEndpointUrl, credential.apiKey);
      protocols = {};

      if (detected.openai) {
        protocols.openai = detected.openai;
      }
      if (detected.anthropic) {
        protocols.anthropic = detected.anthropic;
      }
    } catch (error) {
      if (!allowUndetectedGateway) {
        throw error;
      }
      protocols = this.buildFallbackGatewayProtocols(basePath, enabledAgents);
    }

    return {
      id: this.suggestEndpointId("gateway", label, rootUrl),
      label,
      rootUrl,
      profile: "generic-gateway",
      protocols,
    };
  }

  private buildFallbackGatewayProtocols(
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

  private buildOpenAi(
    profile: EndpointProfile,
    endpointUrl: string | undefined,
    preset: "gateway" | "azure-openai",
  ): EndpointRegistryInput {
    const normalizedEndpointUrl = endpointUrl?.trim();
    if (!normalizedEndpointUrl) {
      throw new Error(`Endpoint URL is required for ${preset} connections`);
    }

    const parsed = new URL(normalizedEndpointUrl);
    const rootUrl = parsed.origin;
    const basePath = this.normalizePath(parsed.pathname);
    const label = preset === "azure-openai"
      ? this.labeler.suggestEndpointLabel("azure-openai", { endpointUrl: normalizedEndpointUrl })
      : this.labeler.suggestEndpointLabel("gateway", { endpointUrl: normalizedEndpointUrl });

    return {
      id: this.suggestEndpointId(preset === "azure-openai" ? "azure-openai" : "gateway", label, rootUrl),
      label,
      rootUrl,
      profile,
      protocols: {
        openai: {
          ...(basePath ? { basePath } : {}),
          wireApis: ["responses"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
      },
    };
  }

  private buildAnthropic(endpointUrl: string | undefined, authMode: AuthMode): EndpointRegistryInput {
    const normalizedEndpointUrl = endpointUrl?.trim() || DEFAULT_ANTHROPIC_BASE_URL;
    const parsed = new URL(normalizedEndpointUrl);
    const rootUrl = parsed.origin;
    const basePath = this.normalizePath(parsed.pathname);
    const isOfficial = normalizedEndpointUrl === DEFAULT_ANTHROPIC_BASE_URL;

    return {
      id: isOfficial
        ? "claude"
        : this.suggestEndpointId("claude-gateway", "Claude Gateway", rootUrl),
      label: this.labeler.suggestEndpointLabel("anthropic", { endpointUrl: normalizedEndpointUrl }),
      rootUrl,
      profile: isOfficial ? "anthropic-official" : "generic-gateway",
      protocols: {
        anthropic: {
          ...(basePath ? { basePath } : {}),
          authSchemes: [authMode === "api_key" ? "x_api_key" : "bearer"],
          versionHeader: "2023-06-01",
        },
      },
    };
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
