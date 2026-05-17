import type { StoredCredential } from "@nile/core/services/credential/Types";
import type { AuthMode } from "@nile/core/models/access";
import { CONNECTION_FAMILY_REGISTRY } from "@nile/core/models/connection/family";
import type { ConnectionPresetFamily } from "@nile/core/models/connection/preset";
import { ConnectionNaming } from "@nile/core/models/connection/Naming";

export type ConnectionLabelerInput = {
  endpointUrl?: string;
};

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export class ConnectionLabeler {
  suggestEndpointLabel(
    preset: ConnectionPresetFamily,
    input?: ConnectionLabelerInput,
  ): string {
    if (preset === "gateway") {
      return this.suggestGatewayLabel("Gateway", input?.endpointUrl);
    }
    if (preset === "azure-openai") {
      const resource = input?.endpointUrl ? ConnectionNaming.prettifyAzureResource(input.endpointUrl) : null;
      return resource ? `Azure OpenAI (${resource})` : "Azure OpenAI";
    }
    if (preset === "anthropic") {
      const endpointUrl = input?.endpointUrl?.trim();
      if (endpointUrl && endpointUrl !== DEFAULT_ANTHROPIC_BASE_URL) {
        return "Claude Gateway";
      }
      return "Claude";
    }
    return "OpenAI";
  }

  suggestAccessLabel(
    preset: ConnectionPresetFamily,
    authMode: AuthMode,
    credential: StoredCredential,
    input?: ConnectionLabelerInput,
  ): string {
    if (authMode === "api_key") {
      return this.suggestApiKeyLabel(preset, input);
    }
    const familyFallback = this.readFamilySessionLabel(preset, authMode, credential);
    if (familyFallback) {
      return familyFallback.label ?? familyFallback.fallback;
    }
    return `${this.suggestEndpointLabel(preset, input)} Account`;
  }

  resolveSuggestedAccessLabel(
    preset: ConnectionPresetFamily,
    authMode: AuthMode,
    credential: StoredCredential,
    input?: ConnectionLabelerInput,
  ): string | null {
    const suggested = this.suggestAccessLabel(preset, authMode, credential, input);
    const familyFallback = this.readFamilySessionLabel(preset, authMode, credential);
    if (familyFallback) {
      return suggested === familyFallback.fallback ? null : suggested;
    }
    return null;
  }

  private suggestApiKeyLabel(
    preset: ConnectionPresetFamily,
    input?: ConnectionLabelerInput,
  ): string {
    if (preset === "azure-openai") {
      const resource = input?.endpointUrl ? ConnectionNaming.prettifyAzureResource(input.endpointUrl) : null;
      return resource ? `${resource} API Key` : "Azure API Key";
    }
    return `${this.suggestEndpointLabel(preset, input)} API Key`;
  }

  private suggestGatewayLabel(baseLabel: string, baseUrl?: string): string {
    const host = baseUrl ? ConnectionNaming.prettifyHost(baseUrl) : null;
    return host ? `${baseLabel} (${host})` : baseLabel;
  }

  private readFamilySessionLabel(
    preset: ConnectionPresetFamily,
    authMode: AuthMode,
    credential: StoredCredential,
  ): { label: string | null, fallback: string } | null {
    if (authMode === "api_key") {
      return null;
    }
    const modules = CONNECTION_FAMILY_REGISTRY.readModulesByAuthMode(authMode);
    if (modules.length !== 1) {
      return null;
    }
    const behaviors = modules[0].behaviors;
    return {
      label: behaviors.accessLabelReader?.read(credential) ?? null,
      fallback: behaviors.sessionFallbackLabel ?? `${this.suggestEndpointLabel(preset)} Session`,
    };
  }
}
