import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/definitions";

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

  const read = useCallback(async (options?: {
    markLoading?: boolean;
    usage?: "refresh" | "snapshot";
  }): Promise<boolean> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (options?.markLoading) {
      setIsLoading(true);
    }

    try {
      const settingsStatePromise = options?.usage === "snapshot"
        ? window.nileDesktop.settingsData.getSettingsStateSnapshot()
        : window.nileDesktop.settingsData.getSettingsState();
      if (options?.usage === "snapshot") {
        const nextSettingsState = await settingsStatePromise;
        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return false;
        }
        setSettingsState(nextSettingsState);
        setError(null);
        setIsLoading(false);
        const [nextHistoryState, nextDefinitions] = await Promise.all([
          window.nileDesktop.settingsData.getHistoryState(),
          window.nileDesktop.connections.listConnectionDefinitions(),
        ]);
        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return false;
        }
        setHistoryState(nextHistoryState);
        setDefinitions(nextDefinitions);
        return true;
      }

      const [nextSettingsState, nextHistoryState, nextDefinitions] = await Promise.all([
        settingsStatePromise,
        window.nileDesktop.settingsData.getHistoryState(),
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
      await window.nileDesktop.settingsData.refreshSettings();
    } catch (error) {
      if (isMountedRef.current) {
        setError(describeDesktopDataError(error));
        setIsLoading(false);
      }
      return;
    }
    await read();
  }, [read]);
  const reload = useCallback(async () => {
    await read({ usage: "snapshot" });
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
    let followupRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    void read({ markLoading: true, usage: "snapshot" }).then((loaded) => {
      if (!loaded || !isMountedRef.current) {
        return;
      }
      followupRefreshTimer = setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        void read();
      }, 0);
    });
    const unsubscribe = window.nileDesktopEvents.onStateChanged(() => {
      void read();
    });
    return () => {
      if (followupRefreshTimer !== null) {
        clearTimeout(followupRefreshTimer);
      }
      unsubscribe();
    };
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
    reload,
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
