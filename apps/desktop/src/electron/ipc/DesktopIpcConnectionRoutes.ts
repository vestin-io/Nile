import { ipcMain } from "electron";

import { SHARED_CONNECTION_CATALOG } from "@nile/builtins/connections";
import { NileLogger } from "@nile/core/services/NileLogger";

import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";
import { DesktopStateStore } from "../state/DesktopStateStore";

type DesktopIpcConnectionRoutesOptions = {
  chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null>;
  connectionManager: DesktopConnectionManager;
  inputs: DesktopIpcInputValidator;
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
    ipcMain.handle("desktop:unlock-encrypted-local-storage", (_event, passphrase: unknown) =>
      connectionManager.unlockEncryptedLocalStorage(inputs.readRequiredString(passphrase, "passphrase")),
    );
    ipcMain.handle("desktop:choose-openai-auth-json-path", async (_event, defaultPath?: unknown) => {
      return await this.options.chooseOpenAiAuthJsonPath(inputs.readOptionalString(defaultPath, "defaultPath"));
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
        credentialStorageBackend: normalizedInput.credentialStorageBackend ?? "default",
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
}
