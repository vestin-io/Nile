import type { OpenAiSessionCredential } from "../../../services/credential/Types";
import { JWT_PAYLOAD_DECODER } from "../../../services/JwtPayloadDecoder";

export class SessionIdentityReader {
  readIdentityKey(credential: OpenAiSessionCredential): string | null {
    if (credential.accountId?.trim()) {
      return `account:${credential.accountId.trim()}`;
    }

    const displayName = this.readDisplayName(credential);
    return displayName ? `identity:${displayName}` : null;
  }

  readDisplayName(credential: OpenAiSessionCredential): string | null {
    const claims = this.decodeJwtPayload(credential.idToken);
    if (!claims) {
      return null;
    }

    const value =
      this.readStringClaim(claims, "email") ??
      this.readStringClaim(claims, "name") ??
      this.readStringClaim(claims, "preferred_username");

    return value?.trim() || null;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    return JWT_PAYLOAD_DECODER.decode(token);
  }

  private readStringClaim(claims: Record<string, unknown>, key: string): string | null {
    const value = claims[key];
    return typeof value === "string" && value.trim() ? value : null;
  }
}
