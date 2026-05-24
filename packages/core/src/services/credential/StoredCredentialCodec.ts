import { type StoredCredential } from "./Types";
import { CredentialStoreValidationError } from "./Store";

export type CredentialValidator = (credential: unknown) => void;

export class StoredCredentialCodec {
  constructor(
    private readonly wrap: (value: string) => string = identity,
    private readonly unwrap: (value: string) => string = identity,
    private readonly validators: Record<string, CredentialValidator> = DEFAULT_CREDENTIAL_VALIDATORS,
  ) {}

  serialize(credential: StoredCredential): string {
    this.validateCredential(credential);
    return this.wrap(JSON.stringify(credential));
  }

  deserialize(raw: string): StoredCredential {
    let parsed: unknown;

    try {
      parsed = JSON.parse(this.unwrap(raw));
    } catch {
      throw new CredentialStoreValidationError("Stored credential payload is not valid JSON");
    }

    this.validateCredential(parsed);
    return parsed;
  }

  private validateCredential(credential: unknown): asserts credential is StoredCredential {
    if (typeof credential !== "object" || credential === null || Array.isArray(credential)) {
      throw new CredentialStoreValidationError("Credential payload must be an object");
    }

    const kind = requireStringField(credential, "kind");
    const validator = this.validators[kind];
    if (!validator) {
      throw new CredentialStoreValidationError(`Unsupported credential kind: ${kind}`);
    }
    validator(credential);
  }
}

export const DEFAULT_CREDENTIAL_VALIDATORS: Record<string, CredentialValidator> = {
  api_key: (credential) => {
    const source = requireOptionalStringField(credential, "source");
    if (!source || source === "direct") {
      requireStringField(credential, "apiKey");
      requireOptionalStringField(credential, "envKey");
      return;
    }
    if (source === "env_key") {
      requireStringField(credential, "envKey");
      return;
    }
    throw new CredentialStoreValidationError(`Unsupported api_key credential source: ${source}`);
  },
  claude_session: (credential) => {
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireOptionalNumberField(credential, "expiresAt");
    requireOptionalStringField(credential, "accountUuid");
    requireOptionalStringField(credential, "organizationUuid");
    requireOptionalStringField(credential, "email");
    requireOptionalStringField(credential, "displayName");
  },
  openai_session: (credential) => {
    requireStringField(credential, "idToken");
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireOptionalStringField(credential, "accountId");
    requireOptionalStringField(credential, "lastRefresh");
  },
  openclaw_openai_session: (credential) => {
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireOptionalNumberField(credential, "expiresAt");
    requireOptionalStringField(credential, "accountId");
    requireOptionalStringField(credential, "email");
  },
  cursor_session: (credential) => {
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireOptionalStringField(credential, "authId");
    requireOptionalStringField(credential, "authCacheKey");
    requireOptionalStringField(credential, "email");
    requireOptionalStringField(credential, "displayName");
    requireOptionalNumberField(credential, "userId");
  },
  gemini_cli_session: (credential) => {
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireStringField(credential, "idToken");
    requireOptionalNumberField(credential, "expiryDate");
    requireOptionalStringField(credential, "tokenType");
    requireOptionalStringField(credential, "scope");
  },
  cursor_web_session: (credential) => {
    requireStringField(credential, "sessionToken");
  },
};

function identity(value: string): string {
  return value;
}

function requireStringField(value: unknown, field: string): string {
  const record = value as Record<string, unknown>;
  if (typeof record[field] !== "string" || !record[field]) {
    throw new CredentialStoreValidationError(`Credential field ${field} is required`);
  }
  return record[field] as string;
}

function requireOptionalStringField(value: unknown, field: string): string | undefined {
  const record = value as Record<string, unknown>;
  if (record[field] === undefined) {
    return undefined;
  }
  if (typeof record[field] !== "string" || !record[field]) {
    throw new CredentialStoreValidationError(`Credential field ${field} must be a non-empty string`);
  }
  return record[field] as string;
}

function requireOptionalNumberField(value: unknown, field: string): number | undefined {
  const record = value as Record<string, unknown>;
  if (record[field] === undefined) {
    return undefined;
  }
  if (typeof record[field] !== "number" || Number.isNaN(record[field])) {
    throw new CredentialStoreValidationError(`Credential field ${field} must be a valid number`);
  }
  return record[field] as number;
}
