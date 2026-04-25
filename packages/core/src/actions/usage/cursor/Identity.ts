import type { AccessRecord } from "../../../models/access";
import type { CursorSessionCredential } from "../../../services/credential/Types";
import type { CursorAccountFingerprint } from "./Types";

export class CursorUsageIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorUsageIdentityError";
  }
}

type CursorWebPayload = {
  sub?: unknown;
  type?: unknown;
};

export class CursorUsageIdentity {
  static fromSavedConnection(
    access: Pick<AccessRecord, "id" | "identityKey">,
    credential: Pick<CursorSessionCredential, "authId" | "authCacheKey">,
  ): CursorAccountFingerprint {
    const authId = this.parseSavedConnectionAuthId(access, credential);
    if (!authId) {
      throw new CursorUsageIdentityError(`Cursor connection ${access.id} is missing auth identity metadata`);
    }

    const workosUserId = this.parseWorkosUserId(authId);
    if (!workosUserId) {
      throw new CursorUsageIdentityError(`Cursor connection ${access.id} authId does not include a workos user id`);
    }

    return {
      authId,
      workosUserId,
    };
  }

  static fromSavedAccess(
    access: Pick<AccessRecord, "id" | "identityKey">,
  ): CursorAccountFingerprint {
    const authId = this.parseAuthId(access.identityKey);
    if (!authId) {
      throw new CursorUsageIdentityError(`Cursor connection ${access.id} is missing auth identity metadata`);
    }

    const workosUserId = this.parseWorkosUserId(authId);
    if (!workosUserId) {
      throw new CursorUsageIdentityError(`Cursor connection ${access.id} authId does not include a workos user id`);
    }

    return {
      authId,
      workosUserId,
    };
  }

  static fromUsageSessionToken(token: string): CursorAccountFingerprint {
    const parsed = this.parseUsageSessionToken(token);
    const payload = this.parseJwtPayload(parsed.jwt);
    const authId = this.requireString(payload, "sub", "Cursor usage session token is missing sub");
    const tokenType = this.readString(payload.type);
    if (tokenType && tokenType !== "web" && tokenType !== "access" && tokenType !== "session") {
      throw new CursorUsageIdentityError(`Cursor usage session token has unsupported type: ${tokenType}`);
    }

    const workosUserId = this.parseWorkosUserId(authId);
    if (!workosUserId) {
      throw new CursorUsageIdentityError("Cursor usage session token sub does not contain a workos user id");
    }
    if (parsed.workosUserId !== workosUserId) {
      throw new CursorUsageIdentityError("Cursor usage session token prefix does not match token subject identity");
    }

    return {
      authId,
      workosUserId,
    };
  }

  private static parseUsageSessionToken(token: string): { workosUserId: string; jwt: string } {
    const normalized = this.normalizeToken(token);
    const separator = normalized.indexOf("::");
    if (separator <= 0 || separator === normalized.length - 2) {
      throw new CursorUsageIdentityError("Cursor usage session token must use user::<jwt> format");
    }

    return {
      workosUserId: normalized.slice(0, separator).trim(),
      jwt: normalized.slice(separator + 2).trim(),
    };
  }

  static normalizeToken(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new CursorUsageIdentityError("Cursor web session token is required");
    }

    const unprefixed = trimmed.startsWith("WorkosCursorSessionToken=")
      ? trimmed.slice("WorkosCursorSessionToken=".length)
      : trimmed;
    const firstCookie = unprefixed.split(";")[0]?.trim() ?? "";
    if (!firstCookie) {
      throw new CursorUsageIdentityError("Cursor usage session token is empty");
    }

    try {
      return decodeURIComponent(firstCookie);
    } catch {
      return firstCookie;
    }
  }

  static matches(left: CursorAccountFingerprint, right: CursorAccountFingerprint): boolean {
    return left.authId === right.authId && left.workosUserId === right.workosUserId;
  }

  static parseAuthId(identityKey: string | undefined): string | null {
    if (!identityKey) {
      return null;
    }
    const trimmed = identityKey.trim();
    if (trimmed.startsWith("auth:")) {
      return trimmed.slice(5).trim() || null;
    }
    return trimmed || null;
  }

  static parseWorkosUserId(authId: string): string | null {
    const trimmed = authId.trim();
    const match = trimmed.match(/user_[A-Za-z0-9]+$/);
    return match ? match[0] : null;
  }

  private static parseSavedConnectionAuthId(
    access: Pick<AccessRecord, "identityKey">,
    credential: Pick<CursorSessionCredential, "authId" | "authCacheKey">,
  ): string | null {
    return this.parseAuthId(access.identityKey)
      ?? this.readString(credential.authId)
      ?? this.parseAuthId(credential.authCacheKey);
  }

  private static parseJwtPayload(jwt: string): CursorWebPayload {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new CursorUsageIdentityError("Cursor usage session token JWT is malformed");
    }
    const payload = parts[1];
    if (!payload) {
      throw new CursorUsageIdentityError("Cursor usage session token JWT payload is missing");
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const raw = Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new CursorUsageIdentityError("Cursor usage session token payload is invalid");
      }
      return parsed as CursorWebPayload;
    } catch {
      throw new CursorUsageIdentityError("Cursor usage session token payload is not valid JSON");
    }
  }

  private static requireString(value: CursorWebPayload, field: keyof CursorWebPayload, message: string): string {
    const parsed = this.readString(value[field]);
    if (!parsed) {
      throw new CursorUsageIdentityError(message);
    }
    return parsed;
  }

  private static readString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
