import type { EndpointRegistryInput } from "../../../models/endpoint";
import type { CursorSessionCredential, StoredCredential } from "../../../services/credential/Types";
import { type EnvironmentSource } from "../../../services/EnvironmentSource";
import { splitEndpointUrl } from "../../../projection/Url";
import { type CursorConfigState, type CursorDetectedAccess, type CursorDetectedEndpoint } from "../types";
import { type ReadCurrentStateResult, type ResolvedLiveState } from "./Internal";
import { CursorConfigStore } from "../stores/CursorConfigStore";
import { CursorCredentialStore } from "../stores/CursorCredentialStore";

const CURSOR_PROVIDER_ID = "cursor";
const CURSOR_ENV_KEY = "CURSOR_API_KEY";
const DEFAULT_BACKEND_URL = "https://api2.cursor.sh";

export class CurrentStateReader {
  constructor(
    private readonly configStore: CursorConfigStore,
    private readonly credentialStore: CursorCredentialStore,
    private readonly environment: EnvironmentSource,
  ) {}

  read(): ReadCurrentStateResult {
    const configState = this.readConfigState();
    if ("error" in configState) {
      return { kind: "invalid_structure", issues: [configState.error] };
    }

    const resolved = this.resolveLiveState(configState.value);
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

  private readConfigState(): { value: CursorConfigState | null } | { error: string } {
    try {
      return { value: this.configStore.readState() };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Cursor cli-config.json is unreadable",
      };
    }
  }

  private resolveLiveState(
    configState: CursorConfigState | null,
  ):
    | { value: ResolvedLiveState }
      | {
          error: true;
          issues: string[];
          endpoint?: CursorDetectedEndpoint;
          access?: CursorDetectedAccess;
        } {
    const backendUrl = configState?.backendUrl ?? DEFAULT_BACKEND_URL;
    const endpoint = this.buildEndpointInput(backendUrl);
    const detectedEndpoint: CursorDetectedEndpoint = {
      endpointFamily: "cursor",
      endpointIdHint: CURSOR_PROVIDER_ID,
      labelHint: endpoint.label,
      baseUrl: backendUrl,
      envKey: CURSOR_ENV_KEY,
    };

    let snapshot: ReturnType<CursorCredentialStore["snapshot"]>;
    try {
      snapshot = this.credentialStore.snapshot();
    } catch (error) {
      return {
        error: true,
        issues: [error instanceof Error ? error.message : "Cursor keychain credentials are unreadable"],
        endpoint: detectedEndpoint,
      };
    }
    const resolvedCredential = this.resolveCredential(snapshot);
    if ("error" in resolvedCredential) {
      return {
        error: true,
        issues: [resolvedCredential.error],
        endpoint: detectedEndpoint,
      };
    }

    const detectedAccess = this.buildDetectedAccess(resolvedCredential.value, configState);
    if ("error" in detectedAccess) {
      return {
        error: true,
        issues: [detectedAccess.error],
        endpoint: detectedEndpoint,
        access: detectedAccess.access ?? undefined,
      };
    }

    return {
      value: {
        endpoint,
        access: {
          label: detectedAccess.value.labelHint,
          authMode: detectedAccess.value.authMode,
          ...(detectedAccess.value.identityKey ? { identityKey: detectedAccess.value.identityKey } : {}),
        },
        detectedEndpoint,
        credential: resolvedCredential.value,
        detectedAccess: detectedAccess.value,
      },
    };
  }

  private resolveCredential(
    snapshot: ReturnType<CursorCredentialStore["snapshot"]>,
  ): { value: StoredCredential } | { error: string } {
    const envApiKey = this.environment.read(CURSOR_ENV_KEY)?.trim();
    if (envApiKey) {
      return {
        value: {
          kind: "api_key",
          source: "direct",
          apiKey: envApiKey,
        },
      };
    }

    const hasApiKey = Boolean(snapshot.apiKey);
    const hasAccessToken = Boolean(snapshot.accessToken);
    const hasRefreshToken = Boolean(snapshot.refreshToken);

    if (hasApiKey && (hasAccessToken || hasRefreshToken)) {
      return {
        error: "Cursor live state contains both API key and session credentials",
      };
    }

    if (hasApiKey) {
      return {
        value: {
          kind: "api_key",
          source: "direct",
          apiKey: snapshot.apiKey ?? "",
        },
      };
    }

    if (hasAccessToken !== hasRefreshToken) {
      return {
        error: "Cursor live state contains a partial session credential bundle",
      };
    }

    if (!snapshot.accessToken || !snapshot.refreshToken) {
      return {
        error: "Cursor live state does not contain any readable auth credential",
      };
    }

    return {
      value: {
        kind: "cursor_session",
        accessToken: snapshot.accessToken,
        refreshToken: snapshot.refreshToken,
      },
    };
  }

  private buildDetectedAccess(
    credential: StoredCredential,
    configState: CursorConfigState | null,
  ):
    | { value: CursorDetectedAccess }
    | { error: string; access: CursorDetectedAccess | null } {
    if (credential.kind === "api_key") {
      return {
        value: {
          authMode: "api_key",
          labelHint: "Cursor API Key",
        },
      };
    }

    if (!configState?.authInfo && !configState?.authCacheKey) {
      return {
        error: "Cursor session state is missing auth identity metadata",
        access: {
          authMode: "cursor_session",
          labelHint: "Cursor Session",
        },
      };
    }

    const sessionCredential = credential as CursorSessionCredential;
    const authId = configState?.authInfo?.authId?.trim() || this.parseAuthId(configState?.authCacheKey);
    if (!authId) {
      return {
        error: "Cursor session state is missing authId/authCacheKey identity metadata",
        access: {
          authMode: "cursor_session",
          labelHint: "Cursor Session",
        },
      };
    }

    const labelHint =
      configState?.authInfo?.email?.trim() ||
      configState?.authInfo?.displayName?.trim() ||
      "Cursor Session";

    sessionCredential.authId = authId;
    sessionCredential.authCacheKey = configState?.authCacheKey ?? `auth:${authId}`;
    if (configState?.authInfo?.email?.trim()) {
      sessionCredential.email = configState.authInfo.email.trim();
    }
    if (configState?.authInfo?.displayName?.trim()) {
      sessionCredential.displayName = configState.authInfo.displayName.trim();
    }
    if (typeof configState?.authInfo?.userId === "number") {
      sessionCredential.userId = configState.authInfo.userId;
    }

    return {
      value: {
        authMode: "cursor_session",
        labelHint,
        identityKey: `auth:${authId}`,
      },
    };
  }

  private parseAuthId(authCacheKey: string | undefined): string | null {
    if (!authCacheKey) {
      return null;
    }
    if (authCacheKey.startsWith("auth:")) {
      return authCacheKey.slice(5).trim() || null;
    }
    return authCacheKey.trim() || null;
  }

  private buildEndpointInput(backendUrl: string): EndpointRegistryInput {
    const { rootUrl, path } = splitEndpointUrl(backendUrl);
    return {
      id: CURSOR_PROVIDER_ID,
      label: "Cursor",
      rootUrl,
      profile: "cursor-backend",
      protocols: {
        cursor: {
          ...(path ? { backendPath: path } : {}),
        },
      },
    };
  }
}
