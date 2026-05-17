import { JWT_PAYLOAD_DECODER } from "@nile/core/services/JwtPayloadDecoder";
import type { GeminiLocalSessionCredential } from "./types";

export class GeminiSessionIdentityReader {
  readEmail(credential: GeminiLocalSessionCredential): string | null {
    const claims = this.decode(credential.idToken);
    if (!claims) {
      return null;
    }
    return this.readStringClaim(claims, "email");
  }

  readSubject(credential: GeminiLocalSessionCredential): string | null {
    const claims = this.decode(credential.idToken);
    if (!claims) {
      return null;
    }
    return this.readStringClaim(claims, "sub");
  }

  readDisplayName(credential: GeminiLocalSessionCredential): string | null {
    const claims = this.decode(credential.idToken);
    if (!claims) {
      return null;
    }

    return this.readStringClaim(claims, "email")
      ?? this.readStringClaim(claims, "name")
      ?? this.readStringClaim(claims, "preferred_username");
  }

  readIdentityKey(credential: GeminiLocalSessionCredential): string | null {
    const subject = this.readSubject(credential);
    if (subject) {
      return `google-sub:${subject}`;
    }

    const email = this.readEmail(credential);
    return email ? `identity:${email}` : null;
  }

  private decode(token: string): Record<string, unknown> | null {
    return JWT_PAYLOAD_DECODER.decode(token);
  }

  private readStringClaim(claims: Record<string, unknown>, key: string): string | null {
    const value = claims[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
