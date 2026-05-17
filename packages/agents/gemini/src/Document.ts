import type { GeminiLocalSessionCredential } from "./types";

type CredentialDocument = {
  access_token?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
  expiry_date?: unknown;
  token_type?: unknown;
  scope?: unknown;
};

export class GeminiCredentialDocumentCodec {
  readCredential(raw: string): GeminiLocalSessionCredential | null {
    const parsed = this.parse(raw);
    if (
      typeof parsed.access_token !== "string" ||
      !parsed.access_token.trim() ||
      typeof parsed.refresh_token !== "string" ||
      !parsed.refresh_token.trim() ||
      typeof parsed.id_token !== "string" ||
      !parsed.id_token.trim()
    ) {
      return null;
    }

    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      idToken: parsed.id_token,
      expiryDate: typeof parsed.expiry_date === "number" ? parsed.expiry_date : undefined,
      tokenType: typeof parsed.token_type === "string" ? parsed.token_type : undefined,
      scope: typeof parsed.scope === "string" ? parsed.scope : undefined,
    };
  }

  serialize(credential: GeminiLocalSessionCredential): string {
    const payload: Record<string, unknown> = {
      access_token: credential.accessToken,
      refresh_token: credential.refreshToken,
      id_token: credential.idToken,
    };

    if (typeof credential.expiryDate === "number") {
      payload.expiry_date = credential.expiryDate;
    }
    if (credential.tokenType) {
      payload.token_type = credential.tokenType;
    }
    if (credential.scope) {
      payload.scope = credential.scope;
    }

    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  parse(raw: string): CredentialDocument {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Gemini oauth credentials must contain a JSON object");
    }
    return parsed as CredentialDocument;
  }
}
