import type { EndpointRegistryInput } from "../../../models/endpoint";
import { ConnectionNaming } from "../../../models/connection/Naming";
import { splitEndpointUrl } from "../../../projection/Url";
import { ClaudeCredentialStore } from "../Store";
import type { ClaudeSessionCredential } from "../../../services/credential/Types";
import type { ClaudeDetectedAccess, ClaudeDetectedEndpoint } from "../types";
import type { ReadCurrentStateResult, ResolvedLiveState } from "./Internal";
import { type ClaudeOauthAccount, ClaudeSettingsStore } from "../SettingsStore";

const DEFAULT_PROVIDER_ID = "claude";
const DEFAULT_BASE_URL = "https://api.anthropic.com";

export class CurrentStateReader {
  constructor(
    private readonly settingsStore: ClaudeSettingsStore,
    private readonly credentialStore: ClaudeCredentialStore,
  ) {}

  read(): ReadCurrentStateResult {
    const sessionResult = this.readSession();
    if (sessionResult) {
      if ("error" in sessionResult) {
        return { kind: "invalid_structure", issues: [sessionResult.error] };
      }

      return this.resolveSessionState(sessionResult.value.credential, sessionResult.value.account);
    }

    const envResult = this.readEnv();
    if ("error" in envResult) {
      return { kind: "invalid_structure", issues: [envResult.error] };
    }

    return this.resolveLiveState(envResult.value);
  }

  private readSession():
    | { value: { credential: ClaudeSessionCredential; account: ClaudeOauthAccount } }
    | { error: string }
    | null {
    try {
      const oauth = this.credentialStore.readOauth();
      if (!oauth) {
        return null;
      }

      const accessToken = this.readRequiredString(oauth, "accessToken");
      const refreshToken = this.readRequiredString(oauth, "refreshToken");
      if (!accessToken || !refreshToken) {
        return { error: "Claude .credentials.json is missing accessToken or refreshToken" };
      }

      const account = this.settingsStore.readOauthAccount();
      if (!account?.emailAddress || !account.accountUuid) {
        return { error: "Claude settings.json oauthAccount is missing emailAddress or accountUuid" };
      }

      return {
        value: {
          credential: {
            kind: "claude_session",
            accessToken,
            refreshToken,
            ...(typeof oauth.expiresAt === "number" ? { expiresAt: oauth.expiresAt } : {}),
            accountUuid: account.accountUuid,
            organizationUuid: account.organizationUuid,
            email: account.emailAddress,
            displayName: account.displayName,
          },
          account,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Claude .credentials.json is unreadable",
      };
    }
  }

  private readEnv(): {
    value: {
      apiKey: string;
      baseUrl: string;
      envKey: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN";
    };
  } | { error: string } {
    try {
      const env = this.settingsStore.readEnv();
      const apiKey = env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim() || "";
      const baseUrl = env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_BASE_URL;
      const envKey = env.ANTHROPIC_AUTH_TOKEN?.trim()
        ? "ANTHROPIC_AUTH_TOKEN"
        : "ANTHROPIC_API_KEY";

      if (!apiKey) {
        return { error: "Claude settings.json has no ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN" };
      }

      return { value: { apiKey, baseUrl, envKey } };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Claude settings.json is unreadable",
      };
    }
  }

  private resolveLiveState(
    env: { apiKey: string; baseUrl: string; envKey: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN" },
  ): ReadCurrentStateResult {
    const { apiKey, baseUrl, envKey } = env;
    const endpoint = this.buildEndpointInput(DEFAULT_PROVIDER_ID, baseUrl, envKey);

    const detectedEndpoint: ClaudeDetectedEndpoint = {
      endpointFamily: "anthropic",
      endpointIdHint: DEFAULT_PROVIDER_ID,
      labelHint: endpoint.label,
      baseUrl,
      envKey,
    };

    const detectedAccess: ClaudeDetectedAccess = {
      authMode: "api_key",
      labelHint: `${endpoint.label} API Key`,
    };

    const resolvedState: ResolvedLiveState = {
      endpoint,
      access: {
        label: detectedAccess.labelHint,
        authMode: "api_key",
      },
      detectedEndpoint,
      credential: { kind: "api_key", source: "direct", apiKey },
      detectedAccess,
    };

    return { kind: "resolved", value: resolvedState };
  }

  private resolveSessionState(
    credential: ClaudeSessionCredential,
    account: ClaudeOauthAccount,
  ): ReadCurrentStateResult {
    const endpoint = this.buildEndpointInput(DEFAULT_PROVIDER_ID, DEFAULT_BASE_URL, "ANTHROPIC_API_KEY");
    const detectedEndpoint: ClaudeDetectedEndpoint = {
      endpointFamily: "anthropic",
      endpointIdHint: DEFAULT_PROVIDER_ID,
      labelHint: endpoint.label,
      baseUrl: DEFAULT_BASE_URL,
    };

    const labelHint =
      account.emailAddress?.trim() ||
      account.displayName?.trim() ||
      "Claude Session";
    const identityKey =
      account.accountUuid?.trim()
        ? `account:${account.accountUuid.trim()}`
        : account.emailAddress?.trim()
          ? `email:${account.emailAddress.trim().toLowerCase()}:${account.organizationUuid?.trim() || "personal"}`
          : undefined;

    const detectedAccess: ClaudeDetectedAccess = {
      authMode: "claude_session",
      labelHint,
      ...(identityKey ? { identityKey } : {}),
    };

    const resolvedState: ResolvedLiveState = {
      endpoint,
      access: {
        label: detectedAccess.labelHint,
        authMode: "claude_session",
        ...(identityKey ? { identityKey } : {}),
      },
      detectedEndpoint,
      credential,
      detectedAccess,
    };

    return { kind: "resolved", value: resolvedState };
  }

  private readRequiredString(value: Record<string, unknown>, key: string): string | null {
    const field = value[key];
    return typeof field === "string" && field.trim() ? field : null;
  }

  private buildEndpointInput(
    id: string,
    baseUrl: string,
    envKey: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN",
  ): EndpointRegistryInput {
    const { rootUrl, path } = splitEndpointUrl(baseUrl);
    return {
      id,
      label: rootUrl === DEFAULT_BASE_URL ? "Claude" : this.suggestGatewayLabel(rootUrl),
      rootUrl,
      profile: rootUrl === DEFAULT_BASE_URL ? "anthropic-official" : "generic-gateway",
      protocols: {
        anthropic: {
          ...(path ? { basePath: path } : {}),
          authSchemes: [envKey === "ANTHROPIC_AUTH_TOKEN" ? "bearer" : "x_api_key"],
          envKeyOverride: envKey,
          versionHeader: "2023-06-01",
        },
      },
    };
  }

  private suggestGatewayLabel(rootUrl: string): string {
    const host = ConnectionNaming.prettifyHost(rootUrl);
    return host ? `Gateway (${host})` : "Gateway";
  }
}
