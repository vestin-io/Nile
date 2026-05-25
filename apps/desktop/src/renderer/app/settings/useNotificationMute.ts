import { useEffect, useState } from "react";

type NotificationMuteState = {
  isLoaded: boolean;
  isSaving: boolean;
  notificationsMuted: boolean;
  setNotificationsMuted(muted: boolean): Promise<void>;
};

export function useNotificationMute(): NotificationMuteState {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notificationsMuted, setNotificationsMutedState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.nileDesktop.notifications.getNotificationsMuted().then((muted) => {
      if (cancelled) {
        return;
      }
      setNotificationsMutedState(muted);
      setIsLoaded(true);
    }).catch(() => {
      if (cancelled) {
        return;
      }
      setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isLoaded,
    isSaving,
    notificationsMuted,
    async setNotificationsMuted(muted: boolean) {
      setIsSaving(true);
      try {
        const next = await window.nileDesktop.notifications.setNotificationsMuted(muted);
        setNotificationsMutedState(next);
      } finally {
        setIsSaving(false);
      }
    },
  };
}
