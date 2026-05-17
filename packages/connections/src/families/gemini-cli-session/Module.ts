import type {
  ConnectionAccessMatcher,
  ConnectionAccessLabelReader,
  ConnectionFamilyBehaviorSet,
  ConnectionFamilyModule,
  ConnectionIdentityKeyReader,
} from "@nile/core/models/connection/family";
import { JWT_PAYLOAD_DECODER } from "@nile/core/services/JwtPayloadDecoder";
import type { StoredCredential } from "@nile/core/services/credential/Types";
import type { AccessRecord } from "@nile/core/models/access";

import { GEMINI_CLI_SESSION_MANIFEST } from "./Manifest";

class GeminiCliSessionIdentityKeyReader {
  resolve(credential: StoredCredential): string | null {
    if (credential.kind !== "gemini_cli_session") {
      return null;
    }
    const subject = this.readStringClaim(credential.idToken, "sub");
    if (subject) {
      return `google-sub:${subject}`;
    }
    const email = this.readStringClaim(credential.idToken, "email");
    return email ? `identity:${email.toLowerCase()}` : null;
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

class GeminiCliSessionAccessMatcher {
  matches(
    access: AccessRecord,
    stored: StoredCredential,
    incoming: StoredCredential,
    identityKey: string | null,
  ): boolean {
    if (incoming.kind !== "gemini_cli_session" || stored.kind !== "gemini_cli_session") {
      return false;
    }
    if (identityKey && access.identityKey === identityKey) {
      return true;
    }
    if (incoming.refreshToken && stored.refreshToken) {
      return incoming.refreshToken === stored.refreshToken;
    }
    return incoming.idToken === stored.idToken;
  }
}

class GeminiCliSessionAccessLabelReader {
  read(credential: StoredCredential): string | null {
    if (credential.kind !== "gemini_cli_session") {
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

const GEMINI_CLI_SESSION_IDENTITY_KEY_READER: ConnectionIdentityKeyReader =
  new GeminiCliSessionIdentityKeyReader();
const GEMINI_CLI_SESSION_ACCESS_LABEL_READER: ConnectionAccessLabelReader =
  new GeminiCliSessionAccessLabelReader();
const GEMINI_CLI_SESSION_ACCESS_MATCHER: ConnectionAccessMatcher =
  new GeminiCliSessionAccessMatcher();

const GEMINI_CLI_SESSION_BEHAVIORS = {
  identityKeyReader: GEMINI_CLI_SESSION_IDENTITY_KEY_READER,
  accessLabelReader: GEMINI_CLI_SESSION_ACCESS_LABEL_READER,
  sessionFallbackLabel: "Gemini Session",
  accessMatcher: GEMINI_CLI_SESSION_ACCESS_MATCHER,
} as const satisfies ConnectionFamilyBehaviorSet;

export const GEMINI_CLI_SESSION_MODULE: ConnectionFamilyModule = {
  manifest: GEMINI_CLI_SESSION_MANIFEST,
  behaviors: GEMINI_CLI_SESSION_BEHAVIORS,
};
