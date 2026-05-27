import type { AuthMode } from "../../models/access";
import type { EndpointFamily } from "../../models/endpoint";
import type { ConnectionPresetFamily } from "../../models/connection";

export class PortableConnectionIdentity {
  createStableKey(input: {
    endpointFamily: EndpointFamily | "unknown";
    endpointId: string;
    endpointUrl: string | null;
    authMode: AuthMode;
    identityKey?: string | null;
  }): string {
    const family = input.endpointFamily.trim().toLowerCase();
    const endpointId = input.endpointId.trim().toLowerCase();
    const authMode = input.authMode.trim().toLowerCase();
    const identityKey = input.identityKey?.trim();
    const endpointUrl = this.normalizeEndpointUrl(input.endpointUrl);
    return [
      family,
      endpointId,
      authMode,
      identityKey ? `identity:${identityKey}` : `endpoint:${endpointUrl ?? "none"}`,
    ].join("|");
  }

  normalizeEndpointUrl(value: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      const normalizedPath = parsed.pathname.replace(/\/+$/, "");
      const path = normalizedPath && normalizedPath !== "/" ? normalizedPath : "";
      return `${parsed.origin.toLowerCase()}${path}`;
    } catch {
      return trimmed.replace(/\/+$/, "");
    }
  }

  readPreset(
    input: { endpointFamily: EndpointFamily | "unknown"; endpointId: string },
  ): ConnectionPresetFamily | null {
    if (input.endpointFamily !== "unknown") {
      return input.endpointFamily;
    }

    const fallback = input.endpointId.trim();
    if (
      fallback === "openai"
      || fallback === "gateway"
      || fallback === "cursor"
      || fallback === "azure-openai"
      || fallback === "anthropic"
      || fallback === "gemini"
    ) {
      return fallback;
    }
    return null;
  }
}

export const PORTABLE_CONNECTION_IDENTITY = new PortableConnectionIdentity();
