import { useCallback, useEffect, useState } from "react";

export type WorkspaceProfile = Awaited<ReturnType<typeof window.nileDesktop.profiles.listProfiles>>[number];
export type WorkspaceProfileAssignment = WorkspaceProfile["assignments"][number];

export function useWorkspaceProfiles() {
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshProfiles = useCallback(async () => {
    try {
      setProfiles(await window.nileDesktop.profiles.listProfiles());
      setError(null);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : String(profileError));
    }
  }, []);

  useEffect(() => {
    void refreshProfiles();
    return window.nileDesktopEvents.onStateChanged(() => {
      void refreshProfiles();
    });
  }, [refreshProfiles]);

  return {
    profiles,
    profileError: error,
    refreshProfiles,
  };
}
