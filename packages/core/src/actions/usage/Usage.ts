import {
  AccessNotFoundError,
  type AccessRecord,
  type AccessRegistry,
  type AuthMode,
} from "../../models/access";
import type {
  EndpointFamily,
  EndpointProfile,
  EndpointProtocols,
  EndpointRecord,
  EndpointRegistry,
} from "../../models/endpoint";
import { EndpointShape } from "../../models/endpoint";
import type { ConnectionUsageResult } from "./Result";
import { ClaudeSessionUsageReader } from "./ClaudeSessionUsageReader";
import { GeminiSessionUsageReader } from "./GeminiSessionUsageReader";
import { OpenAiSessionUsageReader } from "./OpenAiSessionUsageReader";
import type { LocalConnectionUsageReader } from "../../runtime-local/LocalConnectionSupport";
import {
  CONNECTION_USAGE_READER_REGISTRY,
  type ConnectionUsageReader,
} from "./Registry";

export class Usage {
  private readonly readers: UsageReaderRegistry;

  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    extraReaders: readonly LocalConnectionUsageReader[],
  ) {
    this.readers = CONNECTION_USAGE_READER_REGISTRY.create(extraReaders);
  }

  async get(connectionId: string): Promise<ConnectionUsageResult> {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new AccessNotFoundError(connectionId);
    }

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      return {
        connectionId: access.id,
        connectionLabel: access.label,
        endpointFamily: "gateway",
        endpointLabel: access.endpointId,
        status: "error",
        source: "remote_api",
        message: "Connection metadata is incomplete",
        windows: [],
      };
    }

    const supported = await this.readers.read(access.authMode).read(
      access,
      endpoint,
      this.accessRegistry,
    );
    if (supported) {
      return supported;
    }

    return {
      connectionId: access.id,
      connectionLabel: access.label,
      endpointFamily: this.resolveEndpointFamily(endpoint),
      endpointLabel: endpoint.label,
      status: "unsupported",
      source: "remote_api",
      message: `Quota is unavailable for ${this.resolveEndpointFamily(endpoint)}/${access.authMode} connections. This connection can still be selected for supported agents.`,
      windows: [],
    };
  }

  private resolveEndpointFamily(endpoint: {
    profile?: EndpointProfile;
    protocols: EndpointProtocols;
  }): EndpointFamily {
    return EndpointShape.readFamily(endpoint);
  }
}

type UsageReaderRegistry = ReturnType<typeof CONNECTION_USAGE_READER_REGISTRY.create>;

export class OpenAiSessionConnectionUsageReader implements ConnectionUsageReader {
  private readonly reader = new OpenAiSessionUsageReader();

  constructor(readonly authMode: AuthMode) {}

  async read(
    access: AccessRecord,
    endpoint: EndpointRecord,
    accessRegistry: AccessRegistry,
  ): Promise<ConnectionUsageResult | null> {
    if (!endpoint.protocols.openai) {
      return null;
    }

    const credential = accessRegistry.readCredential(access.id);
    if (credential.kind !== "openai_session" && credential.kind !== "openclaw_openai_session") {
      return this.buildCredentialError(access, endpoint, "Expected OpenAI session credential");
    }

    return await this.reader.read({
      connectionId: access.id,
      connectionLabel: access.label,
      endpointLabel: endpoint.label,
      credential,
    });
  }

  private buildCredentialError(
    access: AccessRecord,
    endpoint: EndpointRecord,
    prefix: string,
  ): ConnectionUsageResult {
    return {
      connectionId: access.id,
      connectionLabel: access.label,
      endpointFamily: EndpointShape.readFamily(endpoint),
      endpointLabel: endpoint.label,
      status: "error",
      source: "remote_api",
      message: `${prefix} for ${access.id}`,
      windows: [],
    };
  }
}

export class ClaudeSessionConnectionUsageReader implements ConnectionUsageReader {
  readonly authMode = "claude_session" satisfies AuthMode;
  private readonly reader = new ClaudeSessionUsageReader();

  async read(
    access: AccessRecord,
    endpoint: EndpointRecord,
    accessRegistry: AccessRegistry,
  ): Promise<ConnectionUsageResult | null> {
    if (!endpoint.protocols.anthropic) {
      return null;
    }

    const credential = accessRegistry.readCredential(access.id);
    if (credential.kind !== "claude_session") {
      return this.buildCredentialError(access, endpoint, "Expected claude_session credential");
    }

    return await this.reader.read({
      connectionId: access.id,
      connectionLabel: access.label,
      endpointLabel: endpoint.label,
      credential,
    });
  }

  private buildCredentialError(
    access: AccessRecord,
    endpoint: EndpointRecord,
    prefix: string,
  ): ConnectionUsageResult {
    return {
      connectionId: access.id,
      connectionLabel: access.label,
      endpointFamily: EndpointShape.readFamily(endpoint),
      endpointLabel: endpoint.label,
      status: "error",
      source: "remote_api",
      message: `${prefix} for ${access.id}`,
      windows: [],
    };
  }
}

export class GeminiSessionConnectionUsageReader implements ConnectionUsageReader {
  readonly authMode = "gemini_cli_session" satisfies AuthMode;
  private readonly reader = new GeminiSessionUsageReader();

  async read(
    access: AccessRecord,
    endpoint: EndpointRecord,
    accessRegistry: AccessRegistry,
  ): Promise<ConnectionUsageResult | null> {
    if (!endpoint.protocols.gemini) {
      return null;
    }

    const credential = accessRegistry.readCredential(access.id);
    if (credential.kind !== "gemini_cli_session") {
      return this.buildCredentialError(access, endpoint, "Expected gemini_cli_session credential");
    }

    return await this.reader.read({
      connectionId: access.id,
      connectionLabel: access.label,
      endpointLabel: endpoint.label,
      credential,
    });
  }

  private buildCredentialError(
    access: AccessRecord,
    endpoint: EndpointRecord,
    prefix: string,
  ): ConnectionUsageResult {
    return {
      connectionId: access.id,
      connectionLabel: access.label,
      endpointFamily: EndpointShape.readFamily(endpoint),
      endpointLabel: endpoint.label,
      status: "error",
      source: "remote_api",
      message: `${prefix} for ${access.id}`,
      windows: [],
    };
  }
}
