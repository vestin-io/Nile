import { ipcMain } from "electron";

import { SHARED_CONNECTION_CATALOG } from "@nile/builtins/connections";
import { NileLogger } from "@nile/core/services/NileLogger";
import {
  EncryptedLocalCredentialStoreCorruptedError,
  EncryptedLocalCredentialStoreLockedError,
  EncryptedLocalCredentialStorePassphraseError,
} from "@nile/core/services/credential";

import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import type {
  DesktopApplyCredentialImportResult,
  DesktopCredentialExportPreview,
  DesktopCredentialImportPreview,
  DesktopCredentialStorageModeState,
  DesktopPreviewCredentialExportInput,
  DesktopUnlockEncryptedLocalStorageFailure,
  DesktopUnlockEncryptedLocalStorageResult,
} from "../connections/contracts";
import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";
import { DesktopStateStore } from "../state/DesktopStateStore";

type DesktopIpcConnectionRoutesOptions = {
  chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null>;
  chooseCredentialExportPath(defaultFileName?: string): Promise<string | null>;
  chooseCredentialImportPath(defaultPath?: string): Promise<string | null>;
  connectionManager: DesktopConnectionManager;
  getCredentialStorageModeState(): DesktopCredentialStorageModeState;
  inputs: DesktopIpcInputValidator;
  previewCredentialExport(input: DesktopPreviewCredentialExportInput): DesktopCredentialExportPreview;
  exportCredentialBundle(input: { filePath: string; exportPassphrase: string; selectedConnectionIds?: string[] }): void;
  previewCredentialImport(input: { filePath: string; exportPassphrase: string }): DesktopCredentialImportPreview;
  applyCredentialImport(input: {
    filePath: string;
    exportPassphrase: string;
    strategy: "skip_existing" | "replace_existing";
    selectedStableKeys?: string[];
    targetStorageMode?: "system_secure_storage" | "encrypted_local_storage";
  }): Promise<DesktopApplyCredentialImportResult>;
  refreshAll(): void;
  stateStore: DesktopStateStore;
  logger?: NileLogger;
};

export class DesktopIpcConnectionRoutes {
  private readonly logger: NileLogger;

  constructor(private readonly options: DesktopIpcConnectionRoutesOptions) {
    this.logger = options.logger ?? NileLogger.silent().child({ scope: "ipc-connection-routes" });
  }

  register(): void {
    const { connectionManager, inputs, stateStore } = this.options;

    ipcMain.handle("desktop:list-connection-definitions", () => SHARED_CONNECTION_CATALOG.listDefinitions());
    ipcMain.handle("desktop:get-credential-storage-state", () => connectionManager.getCredentialStorageState());
    ipcMain.handle("desktop:get-credential-storage-mode-state", () => this.options.getCredentialStorageModeState());
    ipcMain.handle("desktop:unlock-encrypted-local-storage", (_event, passphrase: unknown) => {
      try {
        connectionManager.unlockEncryptedLocalStorage(inputs.readRequiredString(passphrase, "passphrase"));
        return { ok: true } satisfies DesktopUnlockEncryptedLocalStorageResult;
      } catch (error) {
        const result = this.mapEncryptedLocalUnlockError(error);
        if (result.code === "unknown") {
          this.logger.error("desktop.unlock_encrypted_local_storage.failed", {
            errorName: error instanceof Error ? error.name : typeof error,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        return result;
      }
    });
    ipcMain.handle("desktop:choose-openai-auth-json-path", async (_event, defaultPath?: unknown) => {
      return await this.options.chooseOpenAiAuthJsonPath(inputs.readOptionalString(defaultPath, "defaultPath"));
    });
    ipcMain.handle("desktop:choose-credential-export-path", async (_event, defaultFileName?: unknown) => {
      return await this.options.chooseCredentialExportPath(inputs.readOptionalString(defaultFileName, "defaultFileName"));
    });
    ipcMain.handle("desktop:choose-credential-import-path", async (_event, defaultPath?: unknown) => {
      return await this.options.chooseCredentialImportPath(inputs.readOptionalString(defaultPath, "defaultPath"));
    });
    ipcMain.handle("desktop:preview-credential-export", (_event, input: unknown) =>
      this.options.previewCredentialExport(inputs.readPreviewCredentialExportInput(input)),
    );
    ipcMain.handle("desktop:export-credential-bundle", (_event, input: unknown) =>
      this.options.exportCredentialBundle(inputs.readExportCredentialBundleInput(input)),
    );
    ipcMain.handle("desktop:preview-credential-import", (_event, input: unknown) =>
      this.options.previewCredentialImport(inputs.readPreviewCredentialImportInput(input)),
    );
    ipcMain.handle("desktop:apply-credential-import", async (_event, input: unknown) => {
      const result = await this.options.applyCredentialImport(inputs.readApplyCredentialImportInput(input));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:describe-connection-onboarding", (_event, input: unknown) =>
      connectionManager.describeConnectionOnboarding(inputs.readAddConnectionInput(input)),
    );
    ipcMain.handle("desktop:describe-saved-connection-onboarding", (_event, input: unknown) =>
      connectionManager.describeSavedConnectionOnboarding(inputs.readDescribeSavedConnectionOnboardingInput(input)),
    );
    ipcMain.handle("desktop:get-connection-model-catalog", (_event, input: unknown) =>
      connectionManager.getConnectionModelCatalog(inputs.readGetConnectionModelCatalogInput(input)),
    );
    ipcMain.handle("desktop:prepare-connection-draft", (_event, input: unknown) =>
      connectionManager.prepareConnectionDraft(inputs.readAddConnectionInput(input)),
    );
    ipcMain.handle("desktop:discard-prepared-connection-draft", (_event, input: unknown) => {
      connectionManager.discardPreparedConnectionDraft(inputs.readDiscardPreparedConnectionDraftInput(input));
    });
    ipcMain.handle("desktop:save-prepared-connection", async (_event, input: unknown) => {
      const result = await stateStore.savePreparedConnection(inputs.readSavePreparedConnectionInput(input));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:add-connection", async (_event, input: unknown) => {
      const result = await stateStore.addConnection(inputs.readAddConnectionInput(input));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:update-connection", async (_event, input: unknown) => {
      const result = await stateStore.updateConnection(inputs.readUpdateConnectionInput(input));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:import-current-connection", async (_event, input: unknown) => {
      const normalizedInput = inputs.readImportCurrentConnectionInput(input);
      const startedAt = Date.now();
      this.logger.info("desktop.import_current_connection.ipc.start", {
        agentId: normalizedInput.agentId,
        credentialStorageBackend: normalizedInput.credentialStorageBackend ?? "unset",
      });
      try {
        const result = await stateStore.importCurrentConnection(normalizedInput);
        this.logger.info("desktop.import_current_connection.ipc.succeeded", {
          agentId: normalizedInput.agentId,
          connectionId: result.id,
          reused: result.reused ?? false,
          durationMs: Date.now() - startedAt,
        });
        this.options.refreshAll();
        return result;
      } catch (error) {
        this.logger.error("desktop.import_current_connection.ipc.failed", error, {
          agentId: normalizedInput.agentId,
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }
    });
    ipcMain.handle("desktop:remove-connection", (_event, connectionId: unknown) => {
      const result = stateStore.removeConnection(inputs.readRequiredString(connectionId, "connectionId"));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:update-agent-connection-model", (_event, input: unknown) => {
      const record = inputs.readUpdateAgentConnectionModelInput(input);
      const result = stateStore.updateAgentConnectionModel(
        record.agentId,
        record.connectionId,
        record.modelId,
      );
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:bind-cursor-usage", (_event, connectionId: unknown, sessionToken: unknown) => {
      const result = stateStore.bindCursorUsage(
        inputs.readRequiredString(connectionId, "connectionId"),
        inputs.readRequiredString(sessionToken, "sessionToken"),
      );
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:create-connection-usage-alert", async (_event, input: unknown) => {
      return stateStore.createConnectionAlert(inputs.readCreateConnectionAlertInput(input));
    });
    ipcMain.handle("desktop:update-connection-usage-alert", async (_event, input: unknown) => {
      return stateStore.updateConnectionAlert(inputs.readUpdateConnectionAlertInput(input));
    });
    ipcMain.handle("desktop:delete-connection-usage-alert", async (_event, connectionId: unknown, alertId: unknown) => {
      stateStore.deleteConnectionAlert(
        inputs.readRequiredString(connectionId, "connectionId"),
        inputs.readRequiredString(alertId, "alertId"),
      );
    });
  }

  private mapEncryptedLocalUnlockError(error: unknown): DesktopUnlockEncryptedLocalStorageFailure {
    if (error instanceof EncryptedLocalCredentialStoreCorruptedError) {
      return { ok: false, code: "corrupted" };
    }
    if (error instanceof EncryptedLocalCredentialStorePassphraseError) {
      return { ok: false, code: "passphrase_or_corrupted" };
    }
    if (error instanceof EncryptedLocalCredentialStoreLockedError) {
      return { ok: false, code: "locked" };
    }
    if (error instanceof Error && error.message.includes("not available in this desktop session")) {
      return { ok: false, code: "unavailable" };
    }
    return { ok: false, code: "unknown" };
  }
}
