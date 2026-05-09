import { useEffect, useState } from "react";

type ProfileFeatureState = {
  isLoaded: boolean;
  isSaving: boolean;
  profileFeatureEnabled: boolean;
  setProfileFeatureEnabled(enabled: boolean): Promise<void>;
};

export function useProfileFeature(): ProfileFeatureState {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileFeatureEnabled, setProfileFeatureEnabledState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void window.nileDesktop.state.getProfileFeatureEnabled().then((enabled) => {
      if (cancelled) {
        return;
      }
      setProfileFeatureEnabledState(enabled);
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
    profileFeatureEnabled,
    async setProfileFeatureEnabled(enabled: boolean) {
      setIsSaving(true);
      try {
        const next = await window.nileDesktop.state.setProfileFeatureEnabled(enabled);
        setProfileFeatureEnabledState(next);
      } finally {
        setIsSaving(false);
      }
    },
  };
}
