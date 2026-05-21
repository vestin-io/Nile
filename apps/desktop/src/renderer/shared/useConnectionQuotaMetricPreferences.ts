import { useCallback, useEffect, useMemo, useState } from "react";

import {
  readConnectionQuotaMetricPreference,
  writeConnectionQuotaMetricPreference,
  type ConnectionQuotaMetricPreferences,
} from "../../state/ConnectionQuotaMetricPreferences";
import { DesktopPreferencesStore } from "../settings/Preferences";

type ConnectionQuotaMetricPreferencesState = {
  preferences: ConnectionQuotaMetricPreferences;
  readPreference(connectionId: string): string | null;
  setPreference(connectionId: string, metricKey: string | null): void;
};

export function useConnectionQuotaMetricPreferences(): ConnectionQuotaMetricPreferencesState {
  const preferencesStore = useMemo(
    () => new DesktopPreferencesStore(window.localStorage, document.documentElement),
    [],
  );
  const [preferences, setPreferences] = useState<ConnectionQuotaMetricPreferences>(
    () => preferencesStore.load().connectionQuotaMetricPreferences,
  );

  useEffect(() => {
    return preferencesStore.subscribe(() => {
      setPreferences(preferencesStore.load().connectionQuotaMetricPreferences);
    });
  }, [preferencesStore]);

  const setPreference = useCallback((connectionId: string, metricKey: string | null) => {
    const current = preferencesStore.load();
    const next = {
      ...current,
      connectionQuotaMetricPreferences: writeConnectionQuotaMetricPreference(
        current.connectionQuotaMetricPreferences,
        connectionId,
        metricKey,
      ),
    };
    preferencesStore.save(next);
    setPreferences(next.connectionQuotaMetricPreferences);
    void window.nileDesktop.state.refreshMenubar().catch(() => undefined);
  }, [preferencesStore]);

  const readPreference = useCallback((connectionId: string) => (
    readConnectionQuotaMetricPreference(preferences, connectionId)
  ), [preferences]);

  return {
    preferences,
    readPreference,
    setPreference,
  };
}
