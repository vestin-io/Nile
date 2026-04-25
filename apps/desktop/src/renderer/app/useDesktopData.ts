import { useCallback, useEffect, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import {
  canConfigureAgent as readAgentConfigurability,
  readDefinitionsForAgent as readDefinitionsByAgent,
  type Definition,
  type HistoryState,
  type SettingsState,
} from "../shared/Support";

export function useDesktopData() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);
  const [settingsState, setSettingsState] = useState<SettingsState | null>(null);

  const read = useCallback(async () => {
    const [nextSettingsState, nextHistoryState, nextDefinitions] = await Promise.all([
      window.nileDesktop.getSettingsState(),
      window.nileDesktop.getHistoryState(),
      window.nileDesktop.listConnectionDefinitions(),
    ]);
    setSettingsState(nextSettingsState);
    setHistoryState(nextHistoryState);
    setDefinitions(nextDefinitions);
  }, []);

  const refresh = useCallback(async () => {
    await window.nileDesktop.refreshSettings();
    await read();
  }, [read]);
  const canConfigureAgent = useCallback(
    (agentId: AgentId) => readAgentConfigurability(definitions, agentId),
    [definitions],
  );
  const readDefinitionsForAgent = useCallback(
    (agentId: AgentId | null) => readDefinitionsByAgent(definitions, agentId),
    [definitions],
  );

  useEffect(() => {
    void read();
    return window.nileDesktopEvents.onStateChanged(() => {
      void read();
    });
  }, [read]);

  return {
    canConfigureAgent,
    definitions,
    historyState,
    readDefinitionsForAgent,
    refresh,
    settingsState,
  };
}
