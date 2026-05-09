import type { AgentId } from "@nile/core/models/agent/types";

import type { SettingsState } from "../../shared/DesktopData";
import type { Definition } from "../../shared/Definitions";
import type {
  AddConnectionReturnTarget,
  PageId,
  ReusedConnectionDialogState,
} from "./useNavigation";
import { applyAddConnectionCompletionTarget } from "./useNavigation";
import type {
  AddConnectionPreparedSaveInput,
  AddConnectionSubmitInput,
  PreparedConnectionDraft,
} from "../../connections/add/Types";

type UseSettingsConnectionActionsOptions = {
  addConnectionReturnTarget: AddConnectionReturnTarget;
  reload(): Promise<void>;
  refresh(): Promise<void>;
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
  reload,
  refresh,
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
  const addConnection = async (input: AddConnectionSubmitInput) => {
    const created = await window.nileDesktop.connections.addConnection({
      preset: input.preset,
      authMode: input.authMode as Definition["supportedAuthModes"][number],
      label: input.label,
      endpointUrl: input.endpointUrl,
      enabledAgents: input.enabledAgents,
      allowUndetectedGateway: input.allowUndetectedGateway,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      openAiSessionSource: input.openAiSessionSource,
      openAiAuthJsonPath: input.openAiAuthJsonPath,
      claudeSessionSource: input.claudeSessionSource,
    });
    await completeConnectionMutation(created.id, created.reused === true);
  };

  const prepareConnectionDraft = async (input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft> => {
    return await window.nileDesktop.connections.prepareConnectionDraft({
      preset: input.preset,
      authMode: input.authMode as Definition["supportedAuthModes"][number],
      label: input.label,
      endpointUrl: input.endpointUrl,
      enabledAgents: input.enabledAgents,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      openAiSessionSource: input.openAiSessionSource,
      openAiAuthJsonPath: input.openAiAuthJsonPath,
      claudeSessionSource: input.claudeSessionSource,
    });
  };

  const savePreparedConnection = async (input: AddConnectionPreparedSaveInput) => {
    const created = await window.nileDesktop.connections.savePreparedConnection(input);
    await completeConnectionMutation(created.id, created.reused === true);
  };

  const importCurrentConnection = async (agentId: AgentId) => {
    await window.nileDesktop.connections.importCurrentConnection(agentId);
    await refresh();
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
    openAiSessionSource?: "login" | "current_codex";
    openAiAuthJsonPath?: string;
    claudeSessionSource?: "login" | "current_claude";
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
      onActionError(message);
      throw new Error(message);
    }
  };

  const continueReusedConnection = () => {
    if (!reusedConnectionDialog) {
      return;
    }
    const { connectionId, target } = reusedConnectionDialog;
    setReusedConnectionDialog(null);
    applyAddConnectionCompletionTarget(target, connectionId, setCurrentPage, setSelectedConnectionId);
  };

  const completeConnectionMutation = async (connectionId: string, reused: boolean) => {
    await reload();
    if (reused) {
      setReusedConnectionDialog({
        connectionId,
        target: addConnectionReturnTarget,
      });
      return;
    }
    applyAddConnectionCompletionTarget(addConnectionReturnTarget, connectionId, setCurrentPage, setSelectedConnectionId);
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
    useConnection,
  };
}

function describeActionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/^Error invoking remote method '[^']+':\s*/, "");
  }
  return String(error);
}
