import { useCallback, useEffect, useMemo, useState } from "react";

import {
  readConnectionQuotaMetricPreference,
  writeConnectionQuotaMetricPreference,
  type ConnectionQuotaMetricPreferences,
} from "../../state/ConnectionQuotaMetricPreferences";
import { DesktopPreferencesClient } from "../settings/PreferencesClient";

type ConnectionQuotaMetricPreferencesState = {
  preferences: ConnectionQuotaMetricPreferences;
  readPreference(connectionId: string): string | null;
  setPreference(connectionId: string, metricKey: string | null): void;
};

export function useConnectionQuotaMetricPreferences(): ConnectionQuotaMetricPreferencesState {
  const preferencesClient = useMemo(
    () => new DesktopPreferencesClient(),
    [],
  );
  const [preferences, setPreferences] = useState<ConnectionQuotaMetricPreferences>({});

  useEffect(() => {
    void preferencesClient.load().then((next) => {
      setPreferences(next.connectionQuotaMetricPreferences);
    });
    return preferencesClient.subscribe(() => {
      void preferencesClient.load().then((next) => {
        setPreferences(next.connectionQuotaMetricPreferences);
      });
    });
  }, [preferencesClient]);

  const setPreference = useCallback((connectionId: string, metricKey: string | null) => {
    void preferencesClient.load().then((current) => {
      const next = {
        ...current,
        connectionQuotaMetricPreferences: writeConnectionQuotaMetricPreference(
          current.connectionQuotaMetricPreferences,
          connectionId,
          metricKey,
        ),
      };
      setPreferences(next.connectionQuotaMetricPreferences);
      return preferencesClient.save(next);
    }).then(() => {
      return window.nileDesktop.statusEntry.refreshStatusEntry();
    }).catch(() => undefined);
  }, [preferencesClient]);

  const readPreference = useCallback((connectionId: string) => (
    readConnectionQuotaMetricPreference(preferences, connectionId)
  ), [preferences]);

  return {
    preferences,
    readPreference,
    setPreference,
  };
}
