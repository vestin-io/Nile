import {
  isEnvKeyApiKeyCredential,
  sameApiKeyCredential,
  type StoredCredential,
} from "../../services/credential/Types";
import type { AccessRecord, AccessRegistry, AuthMode } from "../access";
import type { EndpointRegistry } from "../endpoint";
import { CONNECTION_FAMILY_REGISTRY } from "./family/Registry";
import { OpenAiSessionCompatibility } from "./OpenAiSessionCompatibility";

export class ConnectionAccessMatchSupport {
  constructor(
    private readonly accessRegistry: AccessRegistry,
    private readonly endpointRegistry: EndpointRegistry,
  ) {}

  matches(
    access: AccessRecord,
    authMode: AuthMode,
    credential: StoredCredential,
    identityKey: string | null,
    apiKeyEnvKeyFallback?: string,
  ): boolean {
    if (credential.kind === "api_key") {
      return this.matchesApiKeyAccess(access, credential, apiKeyEnvKeyFallback);
    }

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      return false;
    }
    const stored = this.readStoredCredential(access.id);
    if (!stored) {
      return false;
    }
    if (this.matchesCompatibleOpenAiSessions(access, authMode, stored, credential, identityKey)) {
      return true;
    }

    const familyIds = CONNECTION_FAMILY_REGISTRY.readSavedFamilyIds({
      authMode,
      protocols: endpoint.protocols,
    });
    for (const familyId of familyIds) {
      const matcher = CONNECTION_FAMILY_REGISTRY.readModule(familyId).behaviors.accessMatcher;
      if (matcher?.matches(access, stored, credential, identityKey)) {
        return true;
      }
    }

    return Boolean(identityKey?.trim() && access.identityKey === identityKey.trim());
  }

  private matchesCompatibleOpenAiSessions(
    access: AccessRecord,
    authMode: AuthMode,
    stored: StoredCredential,
    incoming: StoredCredential,
    identityKey: string | null,
  ): boolean {
    if (
      !OpenAiSessionCompatibility.includes(access.authMode)
      || !OpenAiSessionCompatibility.includes(authMode)
      || access.authMode === authMode
    ) {
      return false;
    }

    const normalizedIdentityKey = identityKey?.trim();
    if (normalizedIdentityKey && access.identityKey === normalizedIdentityKey) {
      return true;
    }

    const storedAccountId = this.readOpenAiSessionAccountId(stored);
    const incomingAccountId = this.readOpenAiSessionAccountId(incoming);
    if (storedAccountId && incomingAccountId && storedAccountId === incomingAccountId) {
      return true;
    }

    const storedRefreshToken = this.readOpenAiSessionRefreshToken(stored);
    const incomingRefreshToken = this.readOpenAiSessionRefreshToken(incoming);
    return Boolean(storedRefreshToken && incomingRefreshToken && storedRefreshToken === incomingRefreshToken);
  }

  private matchesApiKeyAccess(
    access: AccessRecord,
    credential: Extract<StoredCredential, { kind: "api_key" }>,
    apiKeyEnvKeyFallback?: string,
  ): boolean {
    const stored = this.readStoredCredential(access.id);
    if (!stored || stored.kind !== "api_key") {
      return false;
    }
    if (sameApiKeyCredential(stored, credential)) {
      return true;
    }
    return Boolean(
      apiKeyEnvKeyFallback
        && isEnvKeyApiKeyCredential(stored)
        && stored.envKey === apiKeyEnvKeyFallback,
    );
  }

  private readStoredCredential(accessId: string): StoredCredential | null {
    try {
      return this.accessRegistry.readCredential(accessId);
    } catch {
      return null;
    }
  }

  private readOpenAiSessionAccountId(credential: StoredCredential): string | null {
    if (
      credential.kind !== "openai_session"
      && credential.kind !== "openclaw_openai_session"
    ) {
      return null;
    }
    const accountId = credential.accountId?.trim();
    return accountId || null;
  }

  private readOpenAiSessionRefreshToken(credential: StoredCredential): string | null {
    if (
      credential.kind !== "openai_session"
      && credential.kind !== "openclaw_openai_session"
    ) {
      return null;
    }
    const refreshToken = credential.refreshToken.trim();
    return refreshToken || null;
  }
}
