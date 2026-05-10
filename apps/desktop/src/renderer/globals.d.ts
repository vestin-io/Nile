import type { DesktopBridge } from "../electron/Bridge";
import type { DesktopNotificationTarget } from "../electron/notifications/contracts";

declare global {
  interface Window {
    nileDesktop: DesktopBridge;
    nileDesktopEvents: {
      onNotificationHistoryChanged(callback: () => void): () => void;
      onStateChanged(callback: () => void): () => void;
      onNotificationTarget(callback: (target: DesktopNotificationTarget) => void): () => void;
    };
  }
}

export {};
