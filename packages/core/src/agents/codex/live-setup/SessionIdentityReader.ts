import type { OpenAiSessionCredential } from "../../../services/credential/Types";

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
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    try {
      const encoded = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
      const payload = Buffer.from(encoded, "base64").toString("utf8");
      const parsed = JSON.parse(payload);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private readStringClaim(claims: Record<string, unknown>, key: string): string | null {
    const value = claims[key];
    return typeof value === "string" && value.trim() ? value : null;
  }
}
