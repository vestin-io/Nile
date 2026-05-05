import { useEffect, useState } from "react";

import type { DesktopReleaseInfo } from "../../../state/Types";

const FALLBACK_RELEASE_INFO: DesktopReleaseInfo = {
  version: "0.0.0",
  updateAvailability: "development",
  status: "idle",
  availableVersion: null,
};

export function useDesktopReleaseInfo() {
  const [releaseInfo, setReleaseInfo] = useState<DesktopReleaseInfo | null>(null);

  useEffect(() => {
    const readReleaseInfo = async () => {
      const nextReleaseInfo = await window.nileDesktop.updates.getReleaseInfo().catch(() => FALLBACK_RELEASE_INFO);
      setReleaseInfo(nextReleaseInfo);
    };

    void readReleaseInfo();
    return window.nileDesktopEvents.onStateChanged(() => {
      void readReleaseInfo();
    });
  }, []);

  return releaseInfo;
}
