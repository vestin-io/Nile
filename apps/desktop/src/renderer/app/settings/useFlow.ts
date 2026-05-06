import { useState, type Dispatch, type SetStateAction } from "react";

import type { DesktopPreferences } from "../../settings/Preferences";
import type { AddConnectionReturnTarget, PageId } from "./useNavigation";
import { readReturnPage } from "./useNavigation";

type UseSettingsFlowOptions = {
  addConnectionReturnTarget: AddConnectionReturnTarget;
  hasSavedConnections: boolean;
  refresh(): Promise<void>;
  setCurrentPage(page: PageId): void;
  setPreferences: Dispatch<SetStateAction<DesktopPreferences>>;
};

type SettingsFlow = {
  closeAddConnectionPage(): void;
  completeQuickSetup(): void;
  isResetting: boolean;
  openQuickSetup(): void;
  resetDesktopState(onComplete?: () => void): Promise<void>;
};

export function useSettingsFlow(options: UseSettingsFlowOptions): SettingsFlow {
  const [isResetting, setIsResetting] = useState(false);

  const resetDesktopState = async (onComplete?: () => void) => {
    setIsResetting(true);
    try {
      await window.nileDesktop.connections.resetState();
      options.setPreferences((current) => ({ ...current, quickSetupDismissed: false }));
      onComplete?.();
      await options.refresh();
    } finally {
      setIsResetting(false);
    }
  };

  const closeAddConnectionPage = () => {
    options.setCurrentPage(readReturnPage(options.addConnectionReturnTarget));
  };

  const completeQuickSetup = () => {
    options.setPreferences((current) => ({ ...current, quickSetupDismissed: true }));
    options.setCurrentPage(options.hasSavedConnections ? "agents" : "quick-setup");
  };

  const openQuickSetup = () => {
    options.setPreferences((current) => ({ ...current, quickSetupDismissed: false }));
    options.setCurrentPage("quick-setup");
  };

  return {
    closeAddConnectionPage,
    completeQuickSetup,
    isResetting,
    openQuickSetup,
    resetDesktopState,
  };
}
