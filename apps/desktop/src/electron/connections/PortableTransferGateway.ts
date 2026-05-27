import { readFileSync, writeFileSync } from "node:fs";

import { NileSession } from "@nile/builtins/runtime";
import {
  PortableBundleCodec,
  PortableBundleExport,
  PortableBundleImport,
  type CredentialStorageBackend,
  type CredentialStore,
  type PortableBundlePlatform,
  type PortableImportConflictStrategy,
} from "@nile/core/services/credential";
import { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";
import { SavedConnections } from "@nile/core/models/connection";
import { AccessRegistry } from "@nile/core/models/access";
import { AgentSelection } from "@nile/core/models/selection/Selection";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";

import type {
  DesktopApplyCredentialImportInput,
  DesktopApplyCredentialImportResult,
  DesktopCredentialExportPreview,
  DesktopExportCredentialBundleInput,
  DesktopCredentialImportPreview,
  DesktopCredentialStorageModeState,
  DesktopPreviewCredentialExportInput,
  DesktopPreviewCredentialImportInput,
} from "./contracts";
import { DesktopConnectionStorageSupport } from "./StorageSupport";
import { DesktopCredentialStorageSession } from "./CredentialStorageSession";

type PortableTransferGatewayOptions = {
  appVersion: string;
  credentialStore: CredentialStore;
  credentialStorageSession?: DesktopCredentialStorageSession;
  databasePath: string;
  openSession(): NileSession;
  platform: NodeJS.Platform;
};

export class DesktopPortableTransferGateway {
  private readonly storage: DesktopConnectionStorageSupport;

  constructor(private readonly options: PortableTransferGatewayOptions) {
    this.storage = new DesktopConnectionStorageSupport(this.options.credentialStorageSession ?? null);
  }

  previewExport(input: DesktopPreviewCredentialExportInput = {}): DesktopCredentialExportPreview {
    const state = this.readStorageModeState();
    const connectionCount = this.readSelectedExportConnectionIds(input.selectedConnectionIds).length;
    return {
      ...state,
      canExport: !state.mixed && connectionCount > 0 && state.mode !== null,
      connectionCount,
    };
  }

  exportBundle(input: DesktopExportCredentialBundleInput): void {
    const state = this.readStorageModeState();
    const selectedConnectionIds = this.readSelectedExportConnectionIds(input.selectedConnectionIds);
    if (state.mixed) {
      throw new Error("Reset local state before exporting credentials from a mixed storage setup.");
    }
    if (!state.mode || selectedConnectionIds.length === 0) {
      throw new Error("No saved connections are available to export.");
    }

    const resources = this.openExportResources();
    try {
      const exporter = new PortableBundleExport(
        resources.savedConnections,
        resources.accessRegistry,
        resources.agentConnectionSettings,
      );
      const bundle = exporter.create({
        source: {
          appVersion: this.options.appVersion,
          platform: this.readPlatform(),
          storageMode: state.mode,
        },
        exportPassphrase: input.exportPassphrase,
        selectedConnectionIds,
      });
      writeFileSync(input.filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    } catch (error) {
      throw this.storage.mapError(error, state.mode);
    } finally {
      resources.close();
    }
  }

  previewImport(input: DesktopPreviewCredentialImportInput): DesktopCredentialImportPreview {
    const state = this.readStorageModeState();
    if (state.mixed) {
      throw new Error("Reset local state before importing credentials into a mixed storage setup.");
    }

    const bundle = this.readBundle(input.filePath);
    const resources = this.openImportResources();
    try {
      const importer = new PortableBundleImport(
        resources.savedConnections,
        resources.connectionRemover,
        resources.accessRegistry,
        resources.agentSelection,
        resources.agentConnectionSettings,
        resources.creator,
      );
      const preview = importer.preview(bundle, input.exportPassphrase);
      return {
        exportedAt: preview.payload.exportedAt,
        source: preview.payload.source,
        machine: state,
        connections: preview.connections,
      };
    } finally {
      resources.close();
    }
  }

  async applyImport(input: DesktopApplyCredentialImportInput): Promise<DesktopApplyCredentialImportResult> {
    const state = this.readStorageModeState();
    if (state.mixed) {
      throw new Error("Reset local state before importing credentials into a mixed storage setup.");
    }

    const targetStorageMode = this.resolveTargetStorageMode(state, input.targetStorageMode);
    this.storage.prepare(targetStorageMode, input.encryptedLocalPassphrase, {
      allowCreate: true,
    });
    const bundle = this.readBundle(input.filePath);
    const resources = this.openImportResources();
    try {
      const importer = new PortableBundleImport(
        resources.savedConnections,
        resources.connectionRemover,
        resources.accessRegistry,
        resources.agentSelection,
        resources.agentConnectionSettings,
        resources.creator,
      );
      const result = await importer.apply(bundle, {
        exportPassphrase: input.exportPassphrase,
        strategy: input.strategy,
        selectedStableKeys: input.selectedStableKeys,
        targetStorageMode,
      });
      return {
        ...result,
        targetStorageMode,
      };
    } catch (error) {
      throw this.storage.mapError(error, targetStorageMode);
    } finally {
      resources.close();
    }
  }

  readStorageModeState(): DesktopCredentialStorageModeState {
    const session = this.options.openSession();
    try {
      const modes = [...new Set(session
        .listSavedConnections()
        .map((connection) => connection.credentialStorageBackend)
        .filter((value): value is CredentialStorageBackend => value !== undefined))];
      return {
        mode: modes.length === 1 ? modes[0] : null,
        mixed: modes.length > 1,
        connectionCount: session.listSavedConnections().length,
      };
    } finally {
      session.close();
    }
  }

  private resolveTargetStorageMode(
    state: DesktopCredentialStorageModeState,
    requested: CredentialStorageBackend | undefined,
  ): CredentialStorageBackend {
    if (state.mode) {
      return state.mode;
    }
    if (!requested) {
      throw new Error("Choose a credential storage mode before importing the first connection.");
    }
    return requested;
  }

  private readBundle(filePath: string) {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as ReturnType<PortableBundleCodec["create"]>;
  }

  private readSelectedExportConnectionIds(selectedConnectionIds?: string[]): string[] {
    const session = this.options.openSession();
    try {
      const savedConnectionIds = session.listSavedConnections().map((connection) => connection.id);
      if (!selectedConnectionIds || selectedConnectionIds.length === 0) {
        return savedConnectionIds;
      }
      const selected = new Set(selectedConnectionIds);
      return savedConnectionIds.filter((connectionId) => selected.has(connectionId));
    } finally {
      session.close();
    }
  }

  private readPlatform(): PortableBundlePlatform {
    switch (this.options.platform) {
      case "darwin":
        return "macos";
      case "win32":
        return "windows";
      default:
        return "linux";
    }
  }

  private openExportResources() {
    const savedConnections = SavedConnections.open(this.options.databasePath, this.options.credentialStore);
    const database = SqliteDatabase.open(this.options.databasePath);
    const accessRegistry = AccessRegistry.fromDatabase(database, this.options.credentialStore);
    const agentConnectionSettings = AgentConnectionSettings.fromDatabase(database);
    return {
      savedConnections,
      accessRegistry,
      agentConnectionSettings,
      close() {
        savedConnections.close();
        agentConnectionSettings.close();
        database.close();
      },
    };
  }

  private openImportResources() {
    const savedConnections = SavedConnections.open(this.options.databasePath, this.options.credentialStore);
    const database = SqliteDatabase.open(this.options.databasePath);
    const accessRegistry = AccessRegistry.fromDatabase(database, this.options.credentialStore);
    const agentSelection = AgentSelection.fromDatabase(database);
    const agentConnectionSettings = AgentConnectionSettings.fromDatabase(database);
    return {
      savedConnections,
      accessRegistry,
      agentSelection,
      agentConnectionSettings,
      connectionRemover: {
        remove: (connectionId: string) => {
          const session = this.options.openSession();
          try {
            session.removeConnection(connectionId);
          } finally {
            session.close();
          }
        },
      },
      creator: {
        create: async (input: Parameters<NileSession["createConnection"]>[0]) => {
          const session = this.options.openSession();
          try {
            return await session.createConnection(input);
          } finally {
            session.close();
          }
        },
      },
      close() {
        savedConnections.close();
        agentSelection.close();
        agentConnectionSettings.close();
        database.close();
      },
    };
  }
}
