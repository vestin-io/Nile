import type {
  ConnectionAccessMatcher,
  ConnectionAccessLabelReader,
  ConnectionFamilyBehaviorSet,
  ConnectionFamilyModule,
  ConnectionIdentityKeyReader,
  OpenAiSessionModelCatalogReader,
} from "@nile/core/models/connection/family";
import type { AccessRecord } from "@nile/core/models/access";
import type { EndpointRecord } from "@nile/core/models/endpoint";
import type { StoredCredential } from "@nile/core/services/credential/Types";

import { OPENCLAW_OPENAI_SESSION_MANIFEST } from "./Manifest";

class OpenClawOpenAiSessionIdentityKeyReader {
  resolve(credential: StoredCredential): string | null {
    if (credential.kind !== "openclaw_openai_session") {
      return null;
    }
    if (credential.accountId?.trim()) {
      return `account:${credential.accountId.trim()}`;
    }
    if (credential.email?.trim()) {
      return `identity:${credential.email.trim().toLowerCase()}`;
    }
    return null;
  }
}

class OpenClawOpenAiSessionModelCatalogReader {
  readAuthorization(credential: StoredCredential): { token: string; accountId?: string } | null {
    if (credential.kind !== "openclaw_openai_session") {
      return null;
    }
    const accessToken = credential.accessToken.trim();
    if (!accessToken) {
      return null;
    }
    return {
      token: accessToken,
      ...(credential.accountId?.trim() ? { accountId: credential.accountId.trim() } : {}),
    };
  }

  shouldUseCodexModelCatalog(endpoint: EndpointRecord, _credential: StoredCredential): boolean {
    return endpoint.profile === "openai-official";
  }
}

class OpenClawOpenAiSessionAccessMatcher {
  matches(
    access: AccessRecord,
    stored: StoredCredential,
    incoming: StoredCredential,
    identityKey: string | null,
  ): boolean {
    if (incoming.kind !== "openclaw_openai_session" || stored.kind !== "openclaw_openai_session") {
      return false;
    }
    if (identityKey && access.identityKey === identityKey) {
      return true;
    }
    if (incoming.accountId?.trim() && stored.accountId?.trim()) {
      return incoming.accountId.trim() === stored.accountId.trim();
    }
    if (incoming.refreshToken && stored.refreshToken) {
      return incoming.refreshToken === stored.refreshToken;
    }
    return Boolean(
      incoming.email?.trim()
        && stored.email?.trim()
        && incoming.email.trim().toLowerCase() === stored.email.trim().toLowerCase(),
    );
  }
}

class OpenClawOpenAiSessionAccessLabelReader {
  read(credential: StoredCredential): string | null {
    if (credential.kind !== "openclaw_openai_session") {
      return null;
    }
    return credential.email?.trim()
      || credential.accountId?.trim()
      || null;
  }
}

const OPENCLAW_OPENAI_SESSION_IDENTITY_KEY_READER: ConnectionIdentityKeyReader =
  new OpenClawOpenAiSessionIdentityKeyReader();
const OPENCLAW_OPENAI_SESSION_ACCESS_LABEL_READER: ConnectionAccessLabelReader =
  new OpenClawOpenAiSessionAccessLabelReader();
const OPENCLAW_OPENAI_SESSION_MODEL_CATALOG_READER: OpenAiSessionModelCatalogReader =
  new OpenClawOpenAiSessionModelCatalogReader();
const OPENCLAW_OPENAI_SESSION_ACCESS_MATCHER: ConnectionAccessMatcher =
  new OpenClawOpenAiSessionAccessMatcher();

const OPENCLAW_OPENAI_SESSION_BEHAVIORS = {
  identityKeyReader: OPENCLAW_OPENAI_SESSION_IDENTITY_KEY_READER,
  accessLabelReader: OPENCLAW_OPENAI_SESSION_ACCESS_LABEL_READER,
  sessionFallbackLabel: "OpenAI Session",
  openAiSessionModelCatalogReader: OPENCLAW_OPENAI_SESSION_MODEL_CATALOG_READER,
  accessMatcher: OPENCLAW_OPENAI_SESSION_ACCESS_MATCHER,
} as const satisfies ConnectionFamilyBehaviorSet;

export const OPENCLAW_OPENAI_SESSION_MODULE: ConnectionFamilyModule = {
  manifest: OPENCLAW_OPENAI_SESSION_MANIFEST,
  behaviors: OPENCLAW_OPENAI_SESSION_BEHAVIORS,
};
