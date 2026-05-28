import type { AgentId } from "@nile/core/models/agent";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import { SettingsConnectionInputBuilder } from "./ConnectionInput";
import { SettingsConnectionMutationCoordinator } from "./ConnectionMutation";
import type { SettingsState } from "../../shared/DesktopData";
import type {
  AddConnectionReturnTarget,
  PageId,
  ReusedConnectionDialogState,
} from "./useNavigation";
import type {
  AddConnectionPreparedSaveInput,
  AddConnectionSubmitInput,
  PreparedConnectionDraft,
} from "../../connections/add/Types";

type UseSettingsConnectionActionsOptions = {
  addConnectionReturnTarget: AddConnectionReturnTarget;
  refresh(): Promise<void>;
  requestEncryptedLocalUnlock(): Promise<void>;
  reusedConnectionDialog: ReusedConnectionDialogState;
  settingsState: SettingsState;
  setCurrentPage(page: PageId): void;
  setRepairUsageConnectionId(connectionId: string | null): void;
  setReusedConnectionDialog(dialog: ReusedConnectionDialogState): void;
  setSelectedAgentDetailId(agentId: AgentId | null): void;
  setSelectedConnectionContextAgentId(agentId: AgentId | null): void;
  setSelectedConnectionId(connectionId: string | null): void;
  onActionError(message: string | null): void;
};

export function useSettingsConnectionActions({
  addConnectionReturnTarget,
  refresh,
  requestEncryptedLocalUnlock,
  reusedConnectionDialog,
  settingsState,
  setCurrentPage,
  setRepairUsageConnectionId,
  setReusedConnectionDialog,
  setSelectedAgentDetailId,
  setSelectedConnectionContextAgentId,
  setSelectedConnectionId,
  onActionError,
}: UseSettingsConnectionActionsOptions) {
  const inputBuilder = new SettingsConnectionInputBuilder();
  const mutationCoordinator = new SettingsConnectionMutationCoordinator({
    addConnectionReturnTarget,
    setCurrentPage,
    setReusedConnectionDialog,
    setSelectedConnectionId,
  });

  const addConnection = async (input: AddConnectionSubmitInput) => {
    const created = await window.nileDesktop.connections.addConnection(inputBuilder.build(input));
    await completeConnectionMutation(created.id, created.reused === true);
  };

  const prepareConnectionDraft = async (input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft> => {
    return await window.nileDesktop.connections.prepareConnectionDraft(inputBuilder.build(input));
  };

  const savePreparedConnection = async (input: AddConnectionPreparedSaveInput) => {
    const created = await window.nileDesktop.connections.savePreparedConnection(input);
    await completeConnectionMutation(created.id, created.reused === true);
  };

  const importCurrentConnection = async (
    agentId: AgentId,
    input?: {
      credentialStorageBackend?: CredentialStorageBackend;
      encryptedLocalPassphrase?: string;
    },
  ) => {
    onActionError(null);
    try {
      await window.nileDesktop.connections.importCurrentConnection({
        agentId,
        credentialStorageBackend: input?.credentialStorageBackend,
        encryptedLocalPassphrase: input?.encryptedLocalPassphrase,
      });
      void refresh();
    } catch (error) {
      const message = describeActionError(error);
      onActionError(message);
      throw new Error(message);
    }
  };

  const openConnection = (connectionId: string, agentId: AgentId) => {
    setSelectedAgentDetailId(agentId);
    setSelectedConnectionContextAgentId(agentId);
    setSelectedConnectionId(connectionId);
    setCurrentPage("connections");
  };

  const bindCursorUsage = async (connectionId: string) => {
    setRepairUsageConnectionId(connectionId);
  };

  const removeConnection = async (connectionId: string) => {
    const connection = settingsState.connections.find((entry) => entry.id === connectionId);
    if (!connection || connection.selectedByAgents.length > 0) {
      return;
    }
    await window.nileDesktop.connections.removeConnection(connectionId);
  };

  const rollbackAgent = async (agentId: AgentId) => {
    await window.nileDesktop.connections.rollbackLatestMutation(agentId);
  };

  const updateConnection = async (input: {
    connectionId: string;
    label?: string;
    enabledAgents?: AgentId[];
    endpointUrl?: string;
    apiKeySource?: "direct" | "env_key";
    apiKey?: string;
    envKey?: string;
    sessionSource?: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor";
    sessionAuthJsonPath?: string;
    syncSelectedAgents?: boolean;
  }) => {
    await window.nileDesktop.connections.updateConnection(input);
    await refresh();
  };

  const useConnection = async (agentId: AgentId, connectionId: string) => {
    onActionError(null);
    try {
      await window.nileDesktop.connections.switchConnection(agentId, connectionId);
    } catch (error) {
      const message = describeActionError(error);
      if (isEncryptedLocalUnlockError(message)) {
        try {
          await requestEncryptedLocalUnlock();
          await window.nileDesktop.connections.switchConnection(agentId, connectionId);
          return;
        } catch (unlockError) {
          const unlockMessage = describeActionError(unlockError);
          onActionError(unlockMessage);
          throw new Error(unlockMessage);
        }
      }
      onActionError(message);
      throw new Error(message);
    }
  };

  const useExistingConnectionForAgent = async (agentId: AgentId, connectionId: string) => {
    const connection = settingsState.connections.find((entry) => entry.id === connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (!connection.enabledAgents.includes(agentId)) {
      await updateConnection({
        connectionId,
        enabledAgents: [...new Set([...connection.enabledAgents, agentId])],
      });
    }

    await useConnection(agentId, connectionId);
  };

  const continueReusedConnection = () => {
    mutationCoordinator.continue(reusedConnectionDialog);
  };

  const completeConnectionMutation = async (connectionId: string, reused: boolean) => {
    await refresh();
    mutationCoordinator.complete(connectionId, reused);
  };

  return {
    addConnection,
    bindCursorUsage,
    importCurrentConnection,
    openConnection,
    prepareConnectionDraft,
    removeConnection,
    rollbackAgent,
    savePreparedConnection,
    continueReusedConnection,
    updateConnection,
    useExistingConnectionForAgent,
    useConnection,
  };
}

function describeActionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/^Error invoking remote method '[^']+':\s*/, "");
  }
  return String(error);
}

function isEncryptedLocalUnlockError(message: string): boolean {
  return message.toLowerCase().includes("encrypted local storage is locked");
}
