import { useEffect, useState } from "react";

import type { DesktopAgentState, DesktopConnection } from "../../state/Types";
import {
  hasConnectionApplyRequirement,
  readConnectionApplyRequirements,
} from "../shared/ApplyRequirements";
import { formatEnvBackedApiKeyRequirement } from "../shared/AgentText";
import type { Translator } from "../shared/I18n";

type UseAgentConnectionSwitchFlowOptions = {
  agent: DesktopAgentState;
  t: Translator;
  highlightRecentSwitch?: boolean;
  onSwitch(agentId: DesktopAgentState["agentId"], connectionId: string): Promise<void>;
  onUpdateAgentConnectionModel(
    agentId: DesktopAgentState["agentId"],
    connectionId: string,
    modelId: string | null,
  ): Promise<void>;
};

export function useAgentConnectionSwitchFlow({
  agent,
  t,
  highlightRecentSwitch = false,
  onSwitch,
  onUpdateAgentConnectionModel,
}: UseAgentConnectionSwitchFlowOptions) {
  const [editingConnection, setEditingConnection] = useState<DesktopConnection | null>(null);
  const [draftModelId, setDraftModelId] = useState("");
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [pendingSwitchAfterSaveConnectionId, setPendingSwitchAfterSaveConnectionId] = useState<string | null>(null);
  const [switchingConnectionId, setSwitchingConnectionId] = useState<string | null>(null);
  const [recentlyActivatedConnectionId, setRecentlyActivatedConnectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightRecentSwitch || !recentlyActivatedConnectionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyActivatedConnectionId(null);
    }, 1600);
    return () => window.clearTimeout(timeoutId);
  }, [highlightRecentSwitch, recentlyActivatedConnectionId]);

  const openModelEditor = (connection: DesktopConnection) => {
    setPendingSwitchAfterSaveConnectionId(null);
    setEditingConnection(connection);
    setDraftModelId(connection.agentModelId ?? "");
    setModelError(null);
  };

  const closeModelEditor = () => {
    if (isSavingModel) {
      return;
    }
    setPendingSwitchAfterSaveConnectionId(null);
    setEditingConnection(null);
    setDraftModelId("");
    setModelError(null);
  };

  const clearModel = async () => {
    if (!editingConnection || isSavingModel) {
      return;
    }

    setIsSavingModel(true);
    setModelError(null);
    try {
      await onUpdateAgentConnectionModel(agent.agentId, editingConnection.id, null);
      setPendingSwitchAfterSaveConnectionId(null);
      setEditingConnection(null);
      setDraftModelId("");
    } catch (error) {
      setModelError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingModel(false);
    }
  };

  const saveModel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingConnection || isSavingModel) {
      return;
    }

    setIsSavingModel(true);
    setModelError(null);
    try {
      const shouldSwitchAfterSave = pendingSwitchAfterSaveConnectionId === editingConnection.id;
      const nextRequirements = readConnectionApplyRequirements(
        agent.agentId,
        editingConnection,
        draftModelId.trim() || null,
      );
      await onUpdateAgentConnectionModel(
        agent.agentId,
        editingConnection.id,
        draftModelId.trim() ? draftModelId : null,
      );
      if (shouldSwitchAfterSave && hasConnectionApplyRequirement(nextRequirements, "env-backed-api-key")) {
        setModelError(formatEnvBackedApiKeyRequirement(agent.agentLabel, t));
        return;
      }
      if (shouldSwitchAfterSave) {
        setSwitchingConnectionId(editingConnection.id);
        await onSwitch(agent.agentId, editingConnection.id);
        if (highlightRecentSwitch) {
          setRecentlyActivatedConnectionId(editingConnection.id);
        }
      }
      setPendingSwitchAfterSaveConnectionId(null);
      setEditingConnection(null);
      setDraftModelId("");
    } catch (error) {
      setModelError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingModel(false);
      setSwitchingConnectionId(null);
    }
  };

  const switchConnection = async (connectionId: string) => {
    if (switchingConnectionId) {
      return;
    }

    const connection = agent.connections.find((item) => item.id === connectionId) ?? null;
    if (hasConnectionApplyRequirement(connection?.applyRequirements, "selected-model")) {
      setPendingSwitchAfterSaveConnectionId(connectionId);
      setEditingConnection(connection);
      setDraftModelId(connection?.agentModelId ?? "");
      setModelError(null);
      return;
    }
    if (hasConnectionApplyRequirement(connection?.applyRequirements, "env-backed-api-key")) {
      if (!connection) {
        return;
      }
      setPendingSwitchAfterSaveConnectionId(null);
      setEditingConnection(connection);
      setDraftModelId(connection.agentModelId ?? "");
      setModelError(formatEnvBackedApiKeyRequirement(agent.agentLabel, t));
      return;
    }

    setSwitchingConnectionId(connectionId);
    try {
      await onSwitch(agent.agentId, connectionId);
      if (highlightRecentSwitch) {
        setRecentlyActivatedConnectionId(connectionId);
      }
    } finally {
      setSwitchingConnectionId(null);
    }
  };

  return {
    draftModelId,
    editingConnection,
    isSavingModel,
    modelError,
    pendingSwitchAfterSaveConnectionId,
    recentlyActivatedConnectionId,
    switchingConnectionId,
    openModelEditor,
    closeModelEditor,
    clearModel,
    saveModel,
    setDraftModelId,
    switchConnection,
  };
}
