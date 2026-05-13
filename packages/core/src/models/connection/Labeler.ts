import type { StoredCredential } from "../../services/credential/Types";
import { JWT_PAYLOAD_DECODER } from "../../services/JwtPayloadDecoder";
import type { AuthMode } from "../access";
import type { ConnectionPresetFamily } from "./setup/PresetTypes";
import { ConnectionNaming } from "./Naming";

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
    if (authMode === "openai_session" && credential.kind === "openai_session") {
      return this.readOpenAiSessionLabel(credential.idToken) ?? `${this.suggestEndpointLabel(preset, input)} Session`;
    }
    if (authMode === "openclaw_openai_session" && credential.kind === "openclaw_openai_session") {
      return credential.email?.trim()
        || credential.accountId?.trim()
        || `${this.suggestEndpointLabel(preset, input)} Session`;
    }
    if (authMode === "claude_session" && credential.kind === "claude_session") {
      return credential.email?.trim()
        || credential.displayName?.trim()
        || credential.accountUuid?.trim()
        || `${this.suggestEndpointLabel(preset, input)} Session`;
    }
    if (authMode === "cursor_session" && credential.kind === "cursor_session") {
      return credential.email?.trim()
        || credential.displayName?.trim()
        || credential.authId?.trim()
        || `${this.suggestEndpointLabel(preset, input)} Session`;
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
    if (
      authMode === "openai_session"
      || authMode === "openclaw_openai_session"
      || authMode === "claude_session"
      || authMode === "cursor_session"
    ) {
      const fallback = `${this.suggestEndpointLabel(preset, input)} Session`;
      return suggested === fallback ? null : suggested;
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

  private readOpenAiSessionLabel(idToken: string): string | null {
    const claims = this.decodeJwtPayload(idToken);
    if (!claims) {
      return null;
    }

    const value = this.readStringClaim(claims, "email")
      ?? this.readStringClaim(claims, "name")
      ?? this.readStringClaim(claims, "preferred_username");
    return value?.trim() || null;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    return JWT_PAYLOAD_DECODER.decode(token);
  }

  private readStringClaim(claims: Record<string, unknown>, key: string): string | null {
    const value = claims[key];
    return typeof value === "string" && value.trim() ? value : null;
  }
}
