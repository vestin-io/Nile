import type { DesktopBridge } from "../electron/types";

declare global {
  interface Window {
    nileDesktop: DesktopBridge;
    nileDesktopEvents: {
      onStateChanged(callback: () => void): () => void;
    };
  }
}

export {};
