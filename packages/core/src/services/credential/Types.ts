export type DirectApiKeyCredential = {
  kind: "api_key";
  source?: "direct";
  apiKey: string;
  envKey?: string;
};

export type EnvKeyApiKeyCredential = {
  kind: "api_key";
  source: "env_key";
  envKey: string;
};

export type ApiKeyCredential =
  | DirectApiKeyCredential
  | EnvKeyApiKeyCredential;

export type OpenAiSessionCredential = {
  kind: "openai_session";
  idToken: string;
  accessToken: string;
  refreshToken: string;
  accountId?: string;
  lastRefresh?: string;
};

export type OpenClawOpenAiSessionCredential = {
  kind: "openclaw_openai_session";
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  accountId?: string;
  email?: string;
};

export type ClaudeSessionCredential = {
  kind: "claude_session";
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  accountUuid?: string;
  organizationUuid?: string;
  email?: string;
  displayName?: string;
};

export type CursorSessionCredential = {
  kind: "cursor_session";
  accessToken: string;
  refreshToken: string;
  authId?: string;
  authCacheKey?: string;
  email?: string;
  displayName?: string;
  userId?: number;
};

export type CursorWebSessionCredential = {
  kind: "cursor_web_session";
  sessionToken: string;
};

export type StoredCredential =
  | ApiKeyCredential
  | ClaudeSessionCredential
  | OpenAiSessionCredential
  | OpenClawOpenAiSessionCredential
  | CursorSessionCredential
  | CursorWebSessionCredential;

export function isDirectApiKeyCredential(
  credential: StoredCredential,
): credential is DirectApiKeyCredential {
  return credential.kind === "api_key" && credential.source !== "env_key";
}

export function isEnvKeyApiKeyCredential(
  credential: StoredCredential,
): credential is EnvKeyApiKeyCredential {
  return credential.kind === "api_key" && credential.source === "env_key";
}

export function sameApiKeyCredential(
  left: ApiKeyCredential,
  right: ApiKeyCredential,
): boolean {
  if (isEnvKeyApiKeyCredential(left) || isEnvKeyApiKeyCredential(right)) {
    return isEnvKeyApiKeyCredential(left)
      && isEnvKeyApiKeyCredential(right)
      && left.envKey === right.envKey;
  }

  const leftSource = left.source ?? "direct";
  const rightSource = right.source ?? "direct";
  if (leftSource !== rightSource) {
    return false;
  }
  return left.apiKey === right.apiKey;
}
