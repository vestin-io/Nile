import { useEffect, useState } from "react";

type StatusEntryDisplayMode = Awaited<ReturnType<typeof window.nileDesktop.statusEntry.getStatusEntryDisplay>>["mode"];

type StatusEntryDisplayState = {
  isLoaded: boolean;
  isSaving: boolean;
  mode: StatusEntryDisplayMode;
  setMode(mode: StatusEntryDisplayMode): Promise<void>;
};

export function useStatusEntryDisplay(): StatusEntryDisplayState {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setModeState] = useState<StatusEntryDisplayMode>("app_entry");

  useEffect(() => {
    void window.nileDesktop.statusEntry.getStatusEntryDisplay().then((state) => {
      setModeState(state.mode);
      setIsLoaded(true);
    });
  }, []);

  return {
    isLoaded,
    isSaving,
    mode,
    async setMode(nextMode) {
      setIsSaving(true);
      try {
        const next = await window.nileDesktop.statusEntry.setStatusEntryDisplayMode(nextMode);
        setModeState(next.mode);
      } finally {
        setIsSaving(false);
      }
    },
  };
}
