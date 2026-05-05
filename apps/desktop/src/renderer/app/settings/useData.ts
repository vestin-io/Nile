import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import {
  canConfigureAgent as readAgentConfigurability,
  readDefinitionsForAgent as readDefinitionsByAgent,
} from "../../shared/DesktopData";
import type { Definition, HistoryState, SettingsState } from "../../shared/DesktopData";

export function useDesktopData() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settingsState, setSettingsState] = useState<SettingsState | null>(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const read = useCallback(async (options?: { markLoading?: boolean }): Promise<boolean> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (options?.markLoading) {
      setIsLoading(true);
    }

    try {
      const [nextSettingsState, nextHistoryState, nextDefinitions] = await Promise.all([
        window.nileDesktop.state.getSettingsState(),
        window.nileDesktop.state.getHistoryState(),
        window.nileDesktop.connections.listConnectionDefinitions(),
      ]);
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return false;
      }
      setSettingsState(nextSettingsState);
      setHistoryState(nextHistoryState);
      setDefinitions(nextDefinitions);
      setError(null);
      return true;
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return false;
      }
      setError(describeDesktopDataError(error));
      return false;
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      await window.nileDesktop.state.refreshSettings();
    } catch (error) {
      if (isMountedRef.current) {
        setError(describeDesktopDataError(error));
        setIsLoading(false);
      }
      return;
    }
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
    isMountedRef.current = true;
    void read({ markLoading: true });
    return window.nileDesktopEvents.onStateChanged(() => {
      void read();
    });
  }, [read]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  return {
    canConfigureAgent,
    definitions,
    error,
    historyState,
    isLoading,
    readDefinitionsForAgent,
    refresh,
    settingsState,
  };
}

function describeDesktopDataError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Failed to load desktop state.";
}
