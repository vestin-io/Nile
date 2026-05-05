import { ipcMain } from "electron";

import { SHARED_CONNECTION_CATALOG } from "@nile/core/models/connection";

import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";
import { DesktopStateStore } from "../state/DesktopStateStore";

type DesktopIpcConnectionRoutesOptions = {
  chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null>;
  connectionManager: DesktopConnectionManager;
  inputs: DesktopIpcInputValidator;
  refreshAll(): void;
  stateStore: DesktopStateStore;
};

export class DesktopIpcConnectionRoutes {
  constructor(private readonly options: DesktopIpcConnectionRoutesOptions) {}

  register(): void {
    const { connectionManager, inputs, stateStore } = this.options;

    ipcMain.handle("desktop:list-connection-definitions", () => SHARED_CONNECTION_CATALOG.listDefinitions());
    ipcMain.handle("desktop:choose-openai-auth-json-path", async (_event, defaultPath?: unknown) => {
      return await this.options.chooseOpenAiAuthJsonPath(inputs.readOptionalString(defaultPath, "defaultPath"));
    });
    ipcMain.handle("desktop:describe-connection-onboarding", (_event, input: unknown) =>
      connectionManager.describeConnectionOnboarding(inputs.readAddConnectionInput(input)),
    );
    ipcMain.handle("desktop:describe-saved-connection-onboarding", (_event, input: unknown) =>
      connectionManager.describeSavedConnectionOnboarding(inputs.readDescribeSavedConnectionOnboardingInput(input)),
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
    ipcMain.handle("desktop:import-current-connection", (_event, agentId: unknown) => {
      const result = stateStore.importCurrentConnection(inputs.readAgentId(agentId));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:remove-connection", (_event, connectionId: unknown) => {
      const result = stateStore.removeConnection(inputs.readRequiredString(connectionId, "connectionId"));
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
  }
}
