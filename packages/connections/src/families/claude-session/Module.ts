import type {
  ConnectionAccessMatcher,
  ConnectionAccessLabelReader,
  ConnectionFamilyBehaviorSet,
  ConnectionFamilyModule,
  ConnectionIdentityKeyReader,
} from "@nile/core/models/connection/family";
import type { AccessRecord } from "@nile/core/models/access";
import type { StoredCredential } from "@nile/core/services/credential/Types";

import { CLAUDE_SESSION_MANIFEST } from "./Manifest";

class ClaudeSessionIdentityKeyReader {
  resolve(credential: StoredCredential): string | null {
    if (credential.kind !== "claude_session") {
      return null;
    }
    if (credential.accountUuid?.trim()) {
      return `account:${credential.accountUuid.trim()}`;
    }
    if (credential.email?.trim()) {
      return `email:${credential.email.trim().toLowerCase()}:${credential.organizationUuid?.trim() || "personal"}`;
    }
    return null;
  }
}

class ClaudeSessionAccessMatcher {
  matches(
    access: AccessRecord,
    stored: StoredCredential,
    incoming: StoredCredential,
    identityKey: string | null,
  ): boolean {
    if (incoming.kind !== "claude_session" || stored.kind !== "claude_session") {
      return false;
    }
    if (identityKey && access.identityKey === identityKey) {
      return true;
    }
    if (incoming.accountUuid?.trim() && stored.accountUuid?.trim()) {
      return incoming.accountUuid.trim() === stored.accountUuid.trim();
    }
    if (incoming.refreshToken && stored.refreshToken) {
      return incoming.refreshToken === stored.refreshToken;
    }
    return Boolean(
      incoming.email?.trim()
        && stored.email?.trim()
        && incoming.email.trim().toLowerCase() === stored.email.trim().toLowerCase()
        && (incoming.organizationUuid?.trim() || "") === (stored.organizationUuid?.trim() || ""),
    );
  }
}

class ClaudeSessionAccessLabelReader {
  read(credential: StoredCredential): string | null {
    if (credential.kind !== "claude_session") {
      return null;
    }
    return credential.email?.trim()
      || credential.displayName?.trim()
      || credential.accountUuid?.trim()
      || null;
  }
}

const CLAUDE_SESSION_IDENTITY_KEY_READER: ConnectionIdentityKeyReader = new ClaudeSessionIdentityKeyReader();
const CLAUDE_SESSION_ACCESS_LABEL_READER: ConnectionAccessLabelReader = new ClaudeSessionAccessLabelReader();
const CLAUDE_SESSION_ACCESS_MATCHER: ConnectionAccessMatcher = new ClaudeSessionAccessMatcher();

const CLAUDE_SESSION_BEHAVIORS = {
  identityKeyReader: CLAUDE_SESSION_IDENTITY_KEY_READER,
  accessLabelReader: CLAUDE_SESSION_ACCESS_LABEL_READER,
  sessionFallbackLabel: "Claude Session",
  accessMatcher: CLAUDE_SESSION_ACCESS_MATCHER,
} as const satisfies ConnectionFamilyBehaviorSet;

export const CLAUDE_SESSION_MODULE: ConnectionFamilyModule = {
  manifest: CLAUDE_SESSION_MANIFEST,
  behaviors: CLAUDE_SESSION_BEHAVIORS,
};
