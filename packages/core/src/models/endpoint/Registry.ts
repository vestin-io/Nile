import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import {
  SUPPORTED_ENDPOINT_AUTH_SCHEMES,
  SUPPORTED_ENDPOINT_PROFILES,
  SUPPORTED_OPENAI_WIRE_APIS,
  type EndpointAnthropicProtocol,
  type EndpointGeminiProtocol,
  type EndpointCursorProtocol,
  type EndpointOpenAiProtocol,
  type EndpointProfile,
  type EndpointProtocols,
  type EndpointRecord,
  type EndpointRegistryInput,
  type EndpointRegistryUpdate,
} from "./Types";
import { SqliteEndpointStore } from "./SqliteEndpointStore";

export class EndpointRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndpointRegistryValidationError";
  }
}

export class DuplicateEndpointIdError extends Error {
  constructor(endpointId: string) {
    super(`Endpoint already exists: ${endpointId}`);
    this.name = "DuplicateEndpointIdError";
  }
}

export class EndpointNotFoundError extends Error {
  constructor(endpointId: string) {
    super(`Endpoint not found: ${endpointId}`);
    this.name = "EndpointNotFoundError";
  }
}

export class EndpointRegistry {
  static open(databasePath: string): EndpointRegistry {
    const database = SqliteDatabase.open(databasePath);
    return new EndpointRegistry(
      new SqliteEndpointStore(database),
      database,
    );
  }

  static fromDatabase(database: SqliteDatabase): EndpointRegistry {
    return new EndpointRegistry(
      new SqliteEndpointStore(database),
      null,
    );
  }

  constructor(
    private readonly endpointStore: SqliteEndpointStore,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {}

  add(input: EndpointRegistryInput): EndpointRecord {
    const normalized = this.normalizeInput(input, new Date().toISOString());

    try {
      this.endpointStore.insert(normalized);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new DuplicateEndpointIdError(normalized.id);
      }
      throw error;
    }

    return this.getOrThrow(normalized.id);
  }

  update(endpointId: string, input: EndpointRegistryUpdate): EndpointRecord {
    const current = this.endpointStore.get(endpointId);
    if (!current) {
      throw new EndpointNotFoundError(endpointId);
    }

    const normalized = this.normalizeInput(
      {
        id: current.id,
        label: input.label ?? current.label,
        rootUrl: input.rootUrl ?? current.rootUrl,
        profile: input.profile === null ? undefined : input.profile ?? current.profile,
        protocols: input.protocols ?? current.protocols,
      },
      current.createdAt,
    );

    this.endpointStore.update({
      ...normalized,
      updatedAt: new Date().toISOString(),
    });

    return this.getOrThrow(endpointId);
  }

  get(endpointId: string): EndpointRecord | null {
    return this.endpointStore.get(endpointId);
  }

  list(): EndpointRecord[] {
    return this.endpointStore.list();
  }

  remove(endpointId: string): void {
    if (!this.endpointStore.get(endpointId)) {
      throw new EndpointNotFoundError(endpointId);
    }
    this.endpointStore.remove(endpointId);
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private getOrThrow(endpointId: string): EndpointRecord {
    const record = this.get(endpointId);
    if (!record) {
      throw new EndpointNotFoundError(endpointId);
    }
    return record;
  }

  private normalizeInput(input: EndpointRegistryInput, createdAt: string): EndpointRecord {
    const id = input.id.trim();
    const label = input.label.trim();
    const rootUrl = this.normalizeRootUrl(input.rootUrl);
    const profile = this.normalizeProfile(input.profile);
    const protocols = this.normalizeProtocols(input.protocols);

    if (!id) {
      throw new EndpointRegistryValidationError("Endpoint id is required");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new EndpointRegistryValidationError(
        "Endpoint id may only contain letters, numbers, underscores, and hyphens",
      );
    }
    if (!label) {
      throw new EndpointRegistryValidationError("Endpoint label is required");
    }

    return {
      id,
      label,
      rootUrl,
      ...(profile ? { profile } : {}),
      protocols,
      createdAt,
      updatedAt: createdAt,
    };
  }

  private normalizeProfile(profile: EndpointProfile | undefined): EndpointProfile | undefined {
    if (!profile) {
      return undefined;
    }
    if (!SUPPORTED_ENDPOINT_PROFILES.includes(profile)) {
      throw new EndpointRegistryValidationError(`Unsupported endpoint profile: ${profile}`);
    }
    return profile;
  }

  private normalizeRootUrl(rootUrl: string): string {
    const trimmed = rootUrl.trim();
    if (!trimmed) {
      throw new EndpointRegistryValidationError("Endpoint root URL is required");
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new EndpointRegistryValidationError("Endpoint root URL must be a valid absolute URL");
    }

    if (!parsed.protocol || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      throw new EndpointRegistryValidationError("Endpoint root URL must use http or https");
    }

    const normalizedPath = parsed.pathname === "/"
      ? ""
      : parsed.pathname.replace(/\/+$/, "");

    return `${parsed.origin}${normalizedPath}`;
  }

  private normalizeProtocols(protocols: EndpointProtocols): EndpointProtocols {
    const normalized: EndpointProtocols = {};

    if (protocols.openai) {
      normalized.openai = this.normalizeOpenAiProtocol(protocols.openai);
    }
    if (protocols.anthropic) {
      normalized.anthropic = this.normalizeAnthropicProtocol(protocols.anthropic);
    }
    if (protocols.cursor) {
      normalized.cursor = this.normalizeCursorProtocol(protocols.cursor);
    }
    if (protocols.gemini) {
      normalized.gemini = this.normalizeGeminiProtocol(protocols.gemini);
    }

    if (!normalized.openai && !normalized.anthropic && !normalized.cursor && !normalized.gemini) {
      throw new EndpointRegistryValidationError("Endpoint must define at least one protocol");
    }

    return normalized;
  }

  private normalizeOpenAiProtocol(protocol: EndpointOpenAiProtocol): EndpointOpenAiProtocol {
    const authSchemes = this.uniqueNonEmptyStrings(protocol.authSchemes, "OpenAI auth schemes");
    if (!authSchemes.every((scheme) => scheme === "bearer")) {
      throw new EndpointRegistryValidationError("OpenAI protocol only supports bearer auth");
    }

    const wireApis = this.uniqueNonEmptyStrings(protocol.wireApis, "OpenAI wire APIs");
    for (const wireApi of wireApis) {
      if (!SUPPORTED_OPENAI_WIRE_APIS.includes(wireApi as (typeof SUPPORTED_OPENAI_WIRE_APIS)[number])) {
        throw new EndpointRegistryValidationError(`Unsupported OpenAI wire API: ${wireApi}`);
      }
    }

    const normalized: EndpointOpenAiProtocol = {
      authSchemes: authSchemes as Array<"bearer">,
      wireApis: wireApis as EndpointOpenAiProtocol["wireApis"],
    };

    const basePath = this.normalizePath(protocol.basePath, "OpenAI base path");
    if (basePath) {
      normalized.basePath = basePath;
    }
    const envKeyOverride = protocol.envKeyOverride?.trim();
    if (envKeyOverride) {
      normalized.envKeyOverride = envKeyOverride;
    }

    return normalized;
  }

  private normalizeAnthropicProtocol(protocol: EndpointAnthropicProtocol): EndpointAnthropicProtocol {
    const authSchemes = this.uniqueNonEmptyStrings(protocol.authSchemes, "Anthropic auth schemes");
    for (const authScheme of authSchemes) {
      if (!SUPPORTED_ENDPOINT_AUTH_SCHEMES.includes(authScheme as (typeof SUPPORTED_ENDPOINT_AUTH_SCHEMES)[number])) {
        throw new EndpointRegistryValidationError(`Unsupported Anthropic auth scheme: ${authScheme}`);
      }
    }

    const normalized: EndpointAnthropicProtocol = {
      authSchemes: authSchemes as EndpointAnthropicProtocol["authSchemes"],
    };

    const basePath = this.normalizePath(protocol.basePath, "Anthropic base path");
    if (basePath) {
      normalized.basePath = basePath;
    }
    if (protocol.envKeyOverride) {
      normalized.envKeyOverride = protocol.envKeyOverride;
    }
    const versionHeader = protocol.versionHeader?.trim();
    if (versionHeader) {
      normalized.versionHeader = versionHeader;
    }

    return normalized;
  }

  private normalizeCursorProtocol(protocol: EndpointCursorProtocol): EndpointCursorProtocol {
    const backendPath = this.normalizePath(protocol.backendPath, "Cursor backend path");
    return backendPath ? { backendPath } : {};
  }

  private normalizeGeminiProtocol(protocol: EndpointGeminiProtocol): EndpointGeminiProtocol {
    const authTypes = this.uniqueNonEmptyStrings(protocol.authTypes, "Gemini auth types");
    if (!authTypes.every((authType) => authType === "oauth-personal")) {
      throw new EndpointRegistryValidationError("Gemini protocol only supports oauth-personal auth");
    }
    return {
      authTypes: authTypes as Array<"oauth-personal">,
    };
  }

  private normalizePath(path: string | undefined, fieldName: string): string | undefined {
    const trimmed = path?.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!trimmed.startsWith("/")) {
      throw new EndpointRegistryValidationError(`${fieldName} must start with /`);
    }
    if (trimmed === "/") {
      return "/";
    }
    return trimmed.replace(/\/+$/, "");
  }

  private uniqueNonEmptyStrings(values: string[], fieldName: string): string[] {
    const normalized = values.map((value) => value.trim()).filter(Boolean);
    if (normalized.length === 0) {
      throw new EndpointRegistryValidationError(`${fieldName} must contain at least one value`);
    }
    return [...new Set(normalized)];
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Error && /unique|constraint/i.test(error.message);
  }
}
