import type { StoredCredential } from "../../../services/credential/Types";
import { JWT_PAYLOAD_DECODER } from "../../../services/JwtPayloadDecoder";
import type { AuthMode } from "../../access";

export class ConnectionIdentityKeyResolver {
  resolve(authMode: AuthMode, credential: StoredCredential): string | null {
    if (authMode === "openai_session" && credential.kind === "openai_session") {
      if (credential.accountId?.trim()) {
        return `account:${credential.accountId.trim()}`;
      }
      const subject = this.readOpenAiSessionSubject(credential);
      if (subject) {
        return `subject:${subject}`;
      }
      const label = this.readOpenAiSessionLabel(credential);
      return label ? `identity:${label}` : null;
    }

    if (authMode === "claude_session" && credential.kind === "claude_session") {
      if (credential.accountUuid?.trim()) {
        return `account:${credential.accountUuid.trim()}`;
      }
      if (credential.email?.trim()) {
        return `email:${credential.email.trim().toLowerCase()}:${credential.organizationUuid?.trim() || "personal"}`;
      }
      return null;
    }

    if (authMode === "cursor_session" && credential.kind === "cursor_session") {
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

    return null;
  }

  private readOpenAiSessionLabel(credential: StoredCredential & { kind: "openai_session" }): string | null {
    const claims = this.decodeJwtPayload(credential.idToken);
    if (!claims) {
      return null;
    }

    const value = this.readStringClaim(claims, "email")
      ?? this.readStringClaim(claims, "name")
      ?? this.readStringClaim(claims, "preferred_username");
    return value?.trim() || null;
  }

  private readOpenAiSessionSubject(credential: StoredCredential & { kind: "openai_session" }): string | null {
    const claims = this.decodeJwtPayload(credential.idToken);
    if (!claims) {
      return null;
    }

    return this.readStringClaim(claims, "sub")?.trim() || null;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    return JWT_PAYLOAD_DECODER.decode(token);
  }

  private readStringClaim(claims: Record<string, unknown>, key: string): string | null {
    const value = claims[key];
    return typeof value === "string" && value.trim() ? value : null;
  }
}
