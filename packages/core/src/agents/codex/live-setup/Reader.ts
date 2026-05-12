import { ConnectionNaming } from "../../../models/connection/Naming";
import type { EndpointRegistryInput, EndpointProfile } from "../../../models/endpoint";
import {
  type StoredCredential,
} from "../../../services/credential/Types";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { splitEndpointUrl } from "../../../projection/Url";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";
import {
  type CodexDetectedAccess,
  type CodexDetectedEndpoint,
} from "../types";
import {
  type CodexEndpointFamily,
  type CodexLiveCredential,
  type ParsedConfigState,
  type ReadLiveSetupResult,
  type ResolvedLiveState,
} from "./Internal";
import { ConfigStateReader } from "./ConfigReader";
import { LiveCredentialResolver } from "./LiveCredentialResolver";
import { SessionIdentityReader } from "./SessionIdentityReader";

export class LiveSetupReader {
  private readonly configStateReader: ConfigStateReader;
  private readonly credentialResolver: LiveCredentialResolver;
  private readonly identityReader: SessionIdentityReader;

  constructor(
    private readonly authStore: CodexAuthStore,
    private readonly configStore: CodexConfigStore,
    environment: EnvironmentSource,
    configStateReader: ConfigStateReader = new ConfigStateReader(),
    credentialResolver: LiveCredentialResolver = new LiveCredentialResolver(environment),
    identityReader: SessionIdentityReader = new SessionIdentityReader(),
  ) {
    this.configStateReader = configStateReader;
    this.credentialResolver = credentialResolver;
    this.identityReader = identityReader;
  }

  read(): ReadLiveSetupResult {
    const configState = this.configStateReader.read(this.configStore.snapshot());
    if ("error" in configState) {
      return { kind: "invalid_structure", issues: [configState.error] };
    }

    const resolved = this.resolveLiveState(configState.value, this.authStore.readCredential());
    if ("error" in resolved) {
      return {
        kind: "invalid_semantics",
        issues: resolved.issues,
        endpoint: resolved.endpoint ?? null,
        access: resolved.access ?? null,
      };
    }

    return {
      kind: "resolved",
      value: resolved.value,
    };
  }

  private resolveLiveState(
    parsedConfig: ParsedConfigState | null,
    authCredential: StoredCredential | null,
  ):
    | { value: ResolvedLiveState }
    | { error: true; issues: string[]; endpoint?: CodexDetectedEndpoint; access?: CodexDetectedAccess } {
    const endpointId = parsedConfig?.endpointId ?? "openai";
    const baseUrl = parsedConfig?.baseUrl;
    const envKey = parsedConfig?.envKey;
    const endpointFamily = this.configStateReader.inferEndpointFamily(endpointId, baseUrl);
    const endpoint = this.buildEndpointInput(endpointFamily, endpointId, baseUrl, parsedConfig?.wireApi, envKey);
    const detectedEndpoint: CodexDetectedEndpoint = {
      endpointFamily,
      endpointIdHint: endpointId,
      labelHint: endpoint.label,
      wireApi: parsedConfig?.wireApi ?? "responses",
    };

    if (baseUrl) {
      detectedEndpoint.baseUrl = baseUrl;
    }
    if (envKey) {
      detectedEndpoint.envKey = envKey;
    }

    const effectiveCredential = this.credentialResolver.resolve(endpointFamily, envKey, authCredential);
    if ("error" in effectiveCredential) {
      return {
        error: true,
        issues: [effectiveCredential.error],
        endpoint: detectedEndpoint,
      };
    }

    const detectedAccess = this.buildDetectedAccess(detectedEndpoint, effectiveCredential.value);
    if ("error" in detectedAccess) {
      return {
        error: true,
        issues: [detectedAccess.error],
        endpoint: detectedEndpoint,
      };
    }

    return {
      value: {
        ...(parsedConfig?.modelId ? { modelId: parsedConfig.modelId } : {}),
        endpoint,
        access: {
          label: detectedAccess.value.labelHint,
          authMode: detectedAccess.value.authMode,
          ...(detectedAccess.value.identityKey ? { identityKey: detectedAccess.value.identityKey } : {}),
        },
        detectedEndpoint,
        credential: effectiveCredential.value,
        detectedAccess: detectedAccess.value,
      },
    };
  }

  private buildDetectedAccess(
    endpoint: CodexDetectedEndpoint,
    credential: CodexLiveCredential,
  ): { value: CodexDetectedAccess } | { error: string } {
    if (credential.kind === "api_key") {
      return {
        value: {
          authMode: "api_key",
          labelHint: this.suggestApiKeyLabelHint(endpoint),
        },
      };
    }

    const labelHint = this.identityReader.readDisplayName(credential) ?? `${endpoint.labelHint} Session`;
    const identityKey = this.identityReader.readIdentityKey(credential);

    return {
      value: {
        authMode: "openai_session",
        labelHint,
        identityKey: identityKey ?? undefined,
      },
    };
  }

  private suggestApiKeyLabelHint(endpoint: CodexDetectedEndpoint): string {
    if (endpoint.endpointFamily === "azure-openai" && endpoint.baseUrl) {
      const resource = ConnectionNaming.prettifyAzureResource(endpoint.baseUrl);
      if (resource) {
        return `${resource} API Key`;
      }
      return "Azure API Key";
    }

    return `${endpoint.labelHint} API Key`;
  }

  private buildEndpointInput(
    endpointFamily: CodexEndpointFamily,
    endpointId: string,
    baseUrl: string | undefined,
    wireApi: string | undefined,
    envKey: string | undefined,
  ): EndpointRegistryInput {
    const resolvedBaseUrl = baseUrl?.trim() || "https://api.openai.com/v1";
    const { rootUrl, path } = splitEndpointUrl(resolvedBaseUrl);
    const profile: EndpointProfile =
      endpointFamily === "azure-openai"
        ? "azure-openai"
        : endpointFamily === "gateway"
          ? "generic-gateway"
          : "openai-official";

    return {
      id: endpointId,
      label: this.suggestEndpointLabel(endpointFamily, rootUrl, resolvedBaseUrl),
      rootUrl,
      profile,
      protocols: {
        openai: {
          ...(path ? { basePath: path } : {}),
          wireApis: [wireApi === "chat" ? "chat" : "responses"],
          authSchemes: ["bearer"],
          ...(envKey?.trim() ? { envKeyOverride: envKey.trim() } : {}),
        },
      },
    };
  }

  private suggestEndpointLabel(
    endpointFamily: CodexEndpointFamily,
    rootUrl: string,
    baseUrl: string,
  ): string {
    if (endpointFamily === "azure-openai") {
      const resource = ConnectionNaming.prettifyAzureResource(baseUrl);
      return resource ? `Azure OpenAI (${resource})` : "Azure OpenAI";
    }
    if (endpointFamily === "gateway") {
      const host = ConnectionNaming.prettifyHost(rootUrl);
      return host === "openrouter.ai" ? "OpenRouter" : host ? `Gateway (${host})` : "Gateway";
    }
    return "OpenAI";
  }
}
