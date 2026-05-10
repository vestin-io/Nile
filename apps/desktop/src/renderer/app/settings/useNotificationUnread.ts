import { useCallback, useEffect, useRef, useState } from "react";

export function useNotificationUnread(enabled: boolean) {
  const [hasUnread, setHasUnread] = useState(false);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const read = useCallback(async () => {
    if (!enabled) {
      setHasUnread(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const nextHasUnread = await window.nileDesktop.state.hasUnreadNotifications();
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setHasUnread(nextHasUnread);
    } catch {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setHasUnread(false);
    }
  }, [enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    void read();
    return window.nileDesktopEvents.onNotificationHistoryChanged(() => {
      void read();
    });
  }, [read]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  return hasUnread;
}
