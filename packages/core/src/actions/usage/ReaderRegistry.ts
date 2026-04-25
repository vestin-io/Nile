import type { AccessRecord, AccessRegistry } from "../../models/access";
import { EndpointShape, type EndpointRecord } from "../../models/endpoint";
import type { ConnectionUsageResult } from "./Result";
import { ClaudeSessionUsageReader } from "./ClaudeSessionUsageReader";
import { OpenAiSessionUsageReader } from "./OpenAiSessionUsageReader";
import { CursorUsageBindingRegistry, CursorUsageReader, CursorUsageSnapshotStore } from "./cursor";

export class ConnectionUsageReaderRegistry {
  private readonly openAiReader = new OpenAiSessionUsageReader();
  private readonly claudeReader = new ClaudeSessionUsageReader();
  private readonly cursorReader: CursorUsageReader;

  constructor(
    private readonly accessRegistry: AccessRegistry,
    cursorUsageBindingRegistry: CursorUsageBindingRegistry,
    cursorUsageSnapshotStore: CursorUsageSnapshotStore,
  ) {
    this.cursorReader = new CursorUsageReader(cursorUsageBindingRegistry, cursorUsageSnapshotStore);
  }

  async read(
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
