import type { EndpointProfile, EndpointRegistryInput } from "@nile/core/models/endpoint";
import { ConnectionLabeler } from "../labeling";
import { ConnectionNaming } from "@nile/core/models/connection/Naming";

export class OpenAiEndpointBuilder {
  private readonly labeler = new ConnectionLabeler();

  buildOfficial(): EndpointRegistryInput {
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
  }

  buildCompatible(
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
