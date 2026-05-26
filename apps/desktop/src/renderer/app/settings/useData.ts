import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/definitions";

import { SettingsDataLoader } from "./DataLoader";
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
  const loaderRef = useRef<SettingsDataLoader | null>(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  if (!loaderRef.current) {
    loaderRef.current = new SettingsDataLoader({
      getHistoryState: async () => await window.nileDesktop.settingsData.getHistoryState(),
      getSettingsState: async () => await window.nileDesktop.settingsData.getSettingsState(),
      getSettingsStateSnapshot: async () => await window.nileDesktop.settingsData.getSettingsStateSnapshot(),
      listConnectionDefinitions: async () => await window.nileDesktop.connections.listConnectionDefinitions(),
      refreshSettings: async () => await window.nileDesktop.settingsData.refreshSettings(),
    });
  }

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
      const loader = loaderRef.current;
      if (!loader) {
        throw new Error("Desktop data loader is not ready.");
      }

      if (options?.usage === "snapshot") {
        const snapshot = await loader.readSnapshot();
        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return false;
        }
        setSettingsState(snapshot.settingsState);
        setError(null);
        setIsLoading(false);
        const { historyState: nextHistoryState, definitions: nextDefinitions } = await snapshot.followup;
        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return false;
        }
        setHistoryState(nextHistoryState);
        setDefinitions(nextDefinitions);
        return true;
      }

      const result = await loader.readRefresh();
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return false;
      }
      setSettingsState(result.settingsState);
      setHistoryState(result.historyState);
      setDefinitions(result.definitions);
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
      const loader = loaderRef.current;
      if (!loader) {
        throw new Error("Desktop data loader is not ready.");
      }
      await loader.refreshSettings();
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
