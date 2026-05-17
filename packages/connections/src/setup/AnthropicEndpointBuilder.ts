import type { AuthMode } from "@nile/core/models/access";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import { ConnectionLabeler } from "../labeling";
import { ConnectionNaming } from "@nile/core/models/connection/Naming";

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export class AnthropicEndpointBuilder {
  private readonly labeler = new ConnectionLabeler();

  build(endpointUrl: string | undefined, authMode: AuthMode): EndpointRegistryInput {
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
