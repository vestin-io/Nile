import type { AgentConnectionSettings } from "../../models/agent-settings";
import type { AccessRegistry } from "../../models/access";
import type { AgentSelection } from "../../models/selection/Selection";
import {
  type ConnectionCreatorContract,
  type SavedConnectionSummary,
} from "../../models/connection";
import type { AgentId } from "../../models/agent/Definitions";
import type { CredentialStorageBackend } from "./Store";
import type {
  PortableBundleConnection,
  PortableBundleEnvelope,
  PortableBundlePayload,
} from "./PortableBundleTypes";
import { PortableBundleCodec } from "./PortableBundleCodec";
import { PORTABLE_CONNECTION_IDENTITY } from "./PortableIdentity";
import { PortableBundleValidationError } from "./PortableBundleErrors";

export type PortableImportConflictStrategy = "skip_existing" | "replace_existing";

export type PortableImportPreviewConnection = {
  stableKey: string;
  label: string;
  duplicateConnectionId: string | null;
};

export type PortableImportPreview = {
  payload: PortableBundlePayload;
  connections: PortableImportPreviewConnection[];
};

export type ApplyPortableBundleInput = {
  exportPassphrase: string;
  targetStorageMode: CredentialStorageBackend;
  strategy: PortableImportConflictStrategy;
  selectedStableKeys?: string[];
};

export type ApplyPortableBundleResult = {
  importedConnectionIds: string[];
  replacedConnectionIds: string[];
  skippedStableKeys: string[];
};

export class PortableBundleImport {
  private readonly codec = new PortableBundleCodec();

  constructor(
    private readonly savedConnections: Pick<{ list(): SavedConnectionSummary[] }, "list">,
    private readonly connectionRemover: { remove(connectionId: string): void },
    private readonly accessRegistry: Pick<AccessRegistry, "list">,
    private readonly agentSelection: Pick<AgentSelection, "setApplied">,
    private readonly agentConnectionSettings: Pick<AgentConnectionSettings, "setModelId" | "clear">,
    private readonly creator: Pick<ConnectionCreatorContract, "create">,
  ) {}

  preview(bundle: PortableBundleEnvelope, exportPassphrase: string): PortableImportPreview {
    const payload = this.codec.open(JSON.stringify(bundle), exportPassphrase);
    const duplicates = this.readDuplicatesByStableKey();
    return {
      payload,
      connections: payload.connections.map((connection) => ({
        stableKey: connection.stableKey,
        label: connection.label,
        duplicateConnectionId: duplicates.get(connection.stableKey)?.id ?? null,
      })),
    };
  }

  async apply(bundle: PortableBundleEnvelope, input: ApplyPortableBundleInput): Promise<ApplyPortableBundleResult> {
    const payload = this.codec.open(JSON.stringify(bundle), input.exportPassphrase);
    const selectedStableKeys = input.selectedStableKeys ? new Set(input.selectedStableKeys) : null;
    const duplicates = this.readDuplicatesByStableKey();
    const importedConnectionIds: string[] = [];
    const replacedConnectionIds: string[] = [];
    const skippedStableKeys: string[] = [];

    for (const connection of payload.connections) {
      if (selectedStableKeys && !selectedStableKeys.has(connection.stableKey)) {
        continue;
      }

      const duplicate = duplicates.get(connection.stableKey) ?? null;
      if (duplicate && input.strategy === "skip_existing") {
        skippedStableKeys.push(connection.stableKey);
        continue;
      }

      const connectionId = duplicate?.id ?? undefined;
      if (duplicate) {
        this.connectionRemover.remove(duplicate.id);
      }

      const created = await this.creator.create({
        preset: this.requirePreset(connection),
        authMode: connection.authMode,
        credential: connection.credential,
        endpointUrl: connection.endpointUrl ?? undefined,
        id: connectionId,
        label: connection.label,
        enabledAgents: [...connection.enabledAgents],
        credentialStorageBackend: input.targetStorageMode,
      });

      this.restoreSelections(created.id, connection);
      this.restoreModelSelections(created.id, connection);
      importedConnectionIds.push(created.id);
      if (duplicate) {
        replacedConnectionIds.push(created.id);
      }
    }

    return {
      importedConnectionIds,
      replacedConnectionIds,
      skippedStableKeys,
    };
  }

  private readDuplicatesByStableKey(): Map<string, { id: string }> {
    const result = new Map<string, { id: string }>();
    const accessById = new Map(this.accessRegistry.list().map((record) => [record.id, record]));
    for (const connection of this.savedConnections.list()) {
      const access = accessById.get(connection.id);
      if (!access) {
        continue;
      }
      const endpointId = connection.endpointFamily ?? connection.endpointId;
      const stableKey = PORTABLE_CONNECTION_IDENTITY.createStableKey({
        endpointFamily: connection.endpointFamily ?? "unknown",
        endpointId,
        endpointUrl: connection.endpointUrl,
        authMode: connection.authMode,
        identityKey: access.identityKey ?? null,
      });
      result.set(stableKey, { id: connection.id });
    }
    return result;
  }

  private requirePreset(connection: PortableBundleConnection) {
    const preset = PORTABLE_CONNECTION_IDENTITY.readPreset({
      endpointFamily: connection.endpointFamily,
      endpointId: connection.endpointId,
    });
    if (!preset) {
      throw new PortableBundleValidationError(
        `Portable connection ${connection.label} does not declare a supported preset.`,
      );
    }
    return preset;
  }

  private restoreSelections(connectionId: string, connection: PortableBundleConnection): void {
    for (const agentId of connection.selectedByAgents) {
      this.agentSelection.setApplied(agentId as AgentId, connectionId);
    }
  }

  private restoreModelSelections(connectionId: string, connection: PortableBundleConnection): void {
    const selections = connection.modelSelections ?? {};
    for (const [agentId, modelId] of Object.entries(selections)) {
      const normalizedAgentId = agentId as AgentId;
      if (modelId) {
        this.agentConnectionSettings.setModelId(normalizedAgentId, connectionId, modelId);
        continue;
      }
      this.agentConnectionSettings.clear(normalizedAgentId, connectionId);
    }
  }
}
