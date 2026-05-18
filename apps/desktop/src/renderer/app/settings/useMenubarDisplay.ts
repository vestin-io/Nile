import { useEffect, useState } from "react";

type MenubarDisplayMode = Awaited<ReturnType<typeof window.nileDesktop.state.getMenubarDisplay>>["mode"];

type MenubarDisplayState = {
  isLoaded: boolean;
  isSaving: boolean;
  mode: MenubarDisplayMode;
  setMode(mode: MenubarDisplayMode): Promise<void>;
};

export function useMenubarDisplay(): MenubarDisplayState {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setModeState] = useState<MenubarDisplayMode>("app_entry");

  useEffect(() => {
    void window.nileDesktop.state.getMenubarDisplay().then((state) => {
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
        const next = await window.nileDesktop.state.setMenubarDisplayMode(nextMode);
        setModeState(next.mode);
      } finally {
        setIsSaving(false);
      }
    },
  };
}
