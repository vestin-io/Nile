import type {
  ConnectionAccessLabelReader,
  ConnectionFamilyBehaviorSet,
  ConnectionFamilyModule,
  ConnectionIdentityKeyReader,
} from "@nile/core/models/connection/family";
import type { StoredCredential } from "@nile/core/services/credential/Types";

import { CURSOR_SESSION_MANIFEST } from "./Manifest";

class CursorSessionIdentityKeyReader {
  resolve(credential: StoredCredential): string | null {
    if (credential.kind !== "cursor_session") {
      return null;
    }
    if (credential.authId?.trim()) {
      return `auth:${credential.authId.trim()}`;
    }
    if (credential.email?.trim()) {
      return `email:${credential.email.trim().toLowerCase()}`;
    }
    if (credential.displayName?.trim()) {
      return `display:${credential.displayName.trim()}`;
    }
    return null;
  }
}

class CursorSessionAccessLabelReader {
  read(credential: StoredCredential): string | null {
    if (credential.kind !== "cursor_session") {
      return null;
    }
    return credential.email?.trim()
      || credential.displayName?.trim()
      || credential.authId?.trim()
      || null;
  }
}

const CURSOR_SESSION_IDENTITY_KEY_READER: ConnectionIdentityKeyReader = new CursorSessionIdentityKeyReader();
const CURSOR_SESSION_ACCESS_LABEL_READER: ConnectionAccessLabelReader = new CursorSessionAccessLabelReader();

const CURSOR_SESSION_BEHAVIORS = {
  identityKeyReader: CURSOR_SESSION_IDENTITY_KEY_READER,
  accessLabelReader: CURSOR_SESSION_ACCESS_LABEL_READER,
} as const satisfies ConnectionFamilyBehaviorSet;

export const CURSOR_SESSION_MODULE: ConnectionFamilyModule = {
  manifest: CURSOR_SESSION_MANIFEST,
  behaviors: CURSOR_SESSION_BEHAVIORS,
};
