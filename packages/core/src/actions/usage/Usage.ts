import type { AccessRecord, AccessRegistry } from "../../models/access";
import type {
  EndpointFamily,
  EndpointProfile,
  EndpointProtocols,
  EndpointRecord,
  EndpointRegistry,
} from "../../models/endpoint";
import { EndpointShape } from "../../models/endpoint";
import { AccessNotFoundError } from "../../models/access";
import type { ConnectionUsageResult } from "./Result";
import { ClaudeSessionUsageReader } from "./ClaudeSessionUsageReader";
import { OpenAiSessionUsageReader } from "./OpenAiSessionUsageReader";
import {
  CursorUsageBindingRegistry,
  CursorUsageReader,
  CursorUsageSnapshotStore,
} from "./cursor";

export class Usage {
  private readonly openAiReader = new OpenAiSessionUsageReader();
  private readonly claudeReader = new ClaudeSessionUsageReader();
  private readonly cursorReader: CursorUsageReader;

  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    cursorUsageBindingRegistry: CursorUsageBindingRegistry,
    cursorUsageSnapshotStore: CursorUsageSnapshotStore,
  ) {
    this.cursorReader = new CursorUsageReader(
      cursorUsageBindingRegistry,
      cursorUsageSnapshotStore,
    );
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

    const supported = await this.readSupportedUsage(access, endpoint);
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
      message: `Usage is unavailable for ${this.resolveEndpointFamily(endpoint)}/${access.authMode} connections. This connection can still be selected for supported agents.`,
      windows: [],
    };
  }

  private resolveEndpointFamily(endpoint: {
    profile?: EndpointProfile;
    protocols: EndpointProtocols;
  }): EndpointFamily {
    return EndpointShape.readFamily(endpoint);
  }

  private async readSupportedUsage(
    access: AccessRecord,
    endpoint: EndpointRecord,
  ): Promise<ConnectionUsageResult | null> {
    if (endpoint.protocols.openai && access.authMode === "openai_session") {
      const credential = this.accessRegistry.readCredential(access.id);
      if (credential.kind !== "openai_session") {
        return this.buildCredentialError(access, endpoint, "Expected openai_session credential");
      }

      return await this.openAiReader.read({
        connectionId: access.id,
        connectionLabel: access.label,
        endpointLabel: endpoint.label,
        credential,
      });
    }

    if (endpoint.protocols.anthropic && access.authMode === "claude_session") {
      const credential = this.accessRegistry.readCredential(access.id);
      if (credential.kind !== "claude_session") {
        return this.buildCredentialError(access, endpoint, "Expected claude_session credential");
      }

      return await this.claudeReader.read({
        connectionId: access.id,
        connectionLabel: access.label,
        endpointLabel: endpoint.label,
        credential,
      });
    }

    if (endpoint.protocols.cursor && access.authMode === "cursor_session") {
      return await this.cursorReader.read({
        connectionId: access.id,
        connectionLabel: access.label,
        endpointLabel: endpoint.label,
        access,
      });
    }

    return null;
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
