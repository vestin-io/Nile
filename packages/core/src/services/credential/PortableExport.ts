import type { AgentConnectionSettings } from "../../models/agent-settings";
import type { AccessRegistry } from "../../models/access";
import { SavedConnections, type SavedConnectionSummary } from "../../models/connection";

import type {
  PortableBundleConnection,
  PortableBundleEnvelope,
  PortableBundlePayload,
  PortableBundleSource,
} from "./PortableBundleTypes";
import { PortableBundleCodec } from "./PortableBundleCodec";
import { PORTABLE_CONNECTION_IDENTITY } from "./PortableIdentity";

export type ExportPortableBundleInput = {
  source: PortableBundleSource;
  exportPassphrase: string;
  selectedConnectionIds?: string[];
};

export class PortableBundleExport {
  private readonly codec = new PortableBundleCodec();

  constructor(
    private readonly savedConnections: SavedConnections,
    private readonly accessRegistry: Pick<AccessRegistry, "list" | "readCredential">,
    private readonly agentConnectionSettings?: Pick<AgentConnectionSettings, "list">,
  ) {}

  create(input: ExportPortableBundleInput): PortableBundleEnvelope {
    const payload = this.buildPayload(input.source, input.selectedConnectionIds);
    return this.codec.create({
      source: payload.source,
      connections: payload.connections,
      exportedAt: payload.exportedAt,
    }, input.exportPassphrase);
  }

  buildPayload(
    source: PortableBundleSource,
    selectedConnectionIds?: string[],
  ): PortableBundlePayload {
    const accessById = new Map(this.accessRegistry.list().map((record) => [record.id, record]));
    const modelSelectionsByConnection = this.readModelSelectionsByConnection();
    const selectedIds = new Set(selectedConnectionIds ?? []);
    const hasSelectedConnectionIds = selectedIds.size > 0;
    const connections = this.savedConnections.list().filter((connection) => (
      !hasSelectedConnectionIds || selectedIds.has(connection.id)
    )).map((connection) => {
      const access = accessById.get(connection.id);
      if (!access) {
        throw new Error(`Saved connection is missing its access record: ${connection.id}`);
      }

      const endpointId = this.readPortableEndpointId(connection);
      const identityKey = access.identityKey?.trim() || null;
      return {
        stableKey: PORTABLE_CONNECTION_IDENTITY.createStableKey({
          endpointFamily: connection.endpointFamily ?? "unknown",
          endpointId,
          endpointUrl: connection.endpointUrl,
          authMode: connection.authMode,
          identityKey,
        }),
        label: connection.label,
        endpointId,
        endpointFamily: connection.endpointFamily ?? "unknown",
        endpointUrl: PORTABLE_CONNECTION_IDENTITY.normalizeEndpointUrl(connection.endpointUrl),
        authMode: connection.authMode,
        ...(identityKey ? { identityKey } : {}),
        enabledAgents: [...connection.enabledAgents],
        configurableAgents: [...connection.configurableAgents],
        selectedByAgents: [...connection.selectedByAgents],
        ...(modelSelectionsByConnection.get(connection.id)
          ? { modelSelections: modelSelectionsByConnection.get(connection.id)! }
          : {}),
        credential: this.accessRegistry.readCredential(connection.id),
      } satisfies PortableBundleConnection;
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: {
        appVersion: source.appVersion,
        platform: source.platform,
        storageMode: source.storageMode,
      },
      connections,
    };
  }

  private readPortableEndpointId(connection: SavedConnectionSummary): string {
    return connection.endpointFamily ?? connection.endpointId;
  }

  private readModelSelectionsByConnection(): Map<string, Record<string, string | null>> {
    const rows = this.agentConnectionSettings?.list() ?? [];
    const result = new Map<string, Record<string, string | null>>();
    for (const row of rows) {
      const current = result.get(row.connectionId) ?? {};
      current[row.agentId] = row.modelId;
      result.set(row.connectionId, current);
    }
    return result;
  }
}
