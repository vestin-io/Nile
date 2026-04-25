import { useEffect, useState } from "react";

const SIDEBAR_AUTO_COLLAPSE_WIDTH = 960;

export function useSidebarState() {
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => window.innerWidth < SIDEBAR_AUTO_COLLAPSE_WIDTH);
  const [sidebarOpen, setSidebarOpen] = useState(!isNarrowViewport);

  useEffect(() => {
    const syncViewportMode = () => {
      const nextIsNarrow = window.innerWidth < SIDEBAR_AUTO_COLLAPSE_WIDTH;
      setIsNarrowViewport((currentIsNarrow) => {
        if (currentIsNarrow !== nextIsNarrow) {
          setSidebarOpen(!nextIsNarrow);
        }
        return nextIsNarrow;
      });
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    if (isNarrowViewport) {
      setSidebarOpen(false);
    }
  }, [isNarrowViewport]);

  return {
    sidebarOpen,
    setSidebarOpen,
  };
}
