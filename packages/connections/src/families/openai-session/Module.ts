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
import { JWT_PAYLOAD_DECODER } from "@nile/core/services/JwtPayloadDecoder";
import type { StoredCredential } from "@nile/core/services/credential/Types";

import { OPENAI_SESSION_MANIFEST } from "./Manifest";

class OpenAiSessionIdentityKeyReader {
  resolve(credential: StoredCredential): string | null {
    if (credential.kind !== "openai_session") {
      return null;
    }
    if (credential.accountId?.trim()) {
      return `account:${credential.accountId.trim()}`;
    }
    const subject = this.readStringClaim(credential.idToken, "sub");
    if (subject) {
      return `subject:${subject}`;
    }
    const identity = this.readEmailClaim(credential.idToken)
      ?? this.readStringClaim(credential.idToken, "name")
      ?? this.readStringClaim(credential.idToken, "preferred_username");
    return identity ? `identity:${identity}` : null;
  }

  private readStringClaim(token: string, key: string): string | null {
    const claims = JWT_PAYLOAD_DECODER.decode(token);
    if (!claims) {
      return null;
    }
    const value = claims[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private readEmailClaim(token: string): string | null {
    const email = this.readStringClaim(token, "email");
    return email ? email.toLowerCase() : null;
  }
}

class OpenAiSessionModelCatalogSupport {
  readAuthorization(credential: StoredCredential): { token: string; accountId?: string } | null {
    if (credential.kind !== "openai_session") {
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

class OpenAiSessionAccessLabelReader {
  read(credential: StoredCredential): string | null {
    if (credential.kind !== "openai_session") {
      return null;
    }
    return this.readStringClaim(credential.idToken, "email")
      ?? this.readStringClaim(credential.idToken, "name")
      ?? this.readStringClaim(credential.idToken, "preferred_username");
  }

  private readStringClaim(token: string, key: string): string | null {
    const claims = JWT_PAYLOAD_DECODER.decode(token);
    if (!claims) {
      return null;
    }
    const value = claims[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}

class OpenAiSessionAccessMatcher {
  matches(
    access: AccessRecord,
    stored: StoredCredential,
    incoming: StoredCredential,
    identityKey: string | null,
  ): boolean {
    if (incoming.kind !== "openai_session" || stored.kind !== "openai_session") {
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
    return incoming.idToken === stored.idToken;
  }
}

const OPENAI_SESSION_IDENTITY_KEY_READER: ConnectionIdentityKeyReader = new OpenAiSessionIdentityKeyReader();
const OPENAI_SESSION_ACCESS_LABEL_READER: ConnectionAccessLabelReader = new OpenAiSessionAccessLabelReader();
const OPENAI_SESSION_MODEL_CATALOG_READER: OpenAiSessionModelCatalogReader =
  new OpenAiSessionModelCatalogSupport();
const OPENAI_SESSION_ACCESS_MATCHER: ConnectionAccessMatcher = new OpenAiSessionAccessMatcher();

const OPENAI_SESSION_BEHAVIORS = {
  identityKeyReader: OPENAI_SESSION_IDENTITY_KEY_READER,
  accessLabelReader: OPENAI_SESSION_ACCESS_LABEL_READER,
  sessionFallbackLabel: "OpenAI Session",
  openAiSessionModelCatalogReader: OPENAI_SESSION_MODEL_CATALOG_READER,
  accessMatcher: OPENAI_SESSION_ACCESS_MATCHER,
} as const satisfies ConnectionFamilyBehaviorSet;

export const OPENAI_SESSION_MODULE: ConnectionFamilyModule = {
  manifest: OPENAI_SESSION_MANIFEST,
  behaviors: OPENAI_SESSION_BEHAVIORS,
};
