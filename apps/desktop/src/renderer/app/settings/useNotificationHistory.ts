import { useCallback, useEffect, useRef, useState } from "react";

import type { NotificationHistoryState } from "../../shared/DesktopData";
import type { DesktopNotificationHistoryFilterInput } from "../../../electron/notifications/contracts";
import type { DesktopNotificationHistoryConnection } from "../../../state/Types";

export function useNotificationHistory(enabled: boolean, filter?: DesktopNotificationHistoryFilterInput) {
  const [entries, setEntries] = useState<NotificationHistoryState>([]);
  const [connectionTargets, setConnectionTargets] = useState<DesktopNotificationHistoryConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const read = useCallback(async (markLoading = false) => {
    if (!enabled) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (markLoading) {
      setIsLoading(true);
    }

    try {
      const [nextEntries, nextConnectionTargets] = await Promise.all([
        window.nileDesktop.state.getNotificationHistory(filter),
        window.nileDesktop.state.getNotificationHistoryConnections({
          kind: filter?.kind,
        }),
      ]);
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setEntries(nextEntries);
      setConnectionTargets(nextConnectionTargets);
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, filter]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled) {
      return;
    }
    void read(true);
    return window.nileDesktopEvents.onNotificationHistoryChanged(() => {
      void read();
    });
  }, [enabled, read]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  return {
    connectionTargets,
    entries,
    isLoading,
    isMarkingRead,
    markRead: async (entryIds: string[]) => {
      if (entryIds.length === 0) {
        return;
      }
      setIsMarkingRead(true);
      try {
        await window.nileDesktop.state.markNotificationHistoryRead(entryIds);
      } finally {
        setIsMarkingRead(false);
      }
    },
    markReadByFilter: async (nextFilter?: DesktopNotificationHistoryFilterInput) => {
      setIsMarkingRead(true);
      try {
        await window.nileDesktop.state.markNotificationHistoryReadByFilter(nextFilter);
      } finally {
        setIsMarkingRead(false);
      }
    },
    reload: async () => {
      await read(true);
    },
  };
}
