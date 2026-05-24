import { useCallback, useEffect, useMemo, useState } from "react";
import { useEncryptedLocalAccessRecovery } from "./EncryptedLocalAccess";

export type ConnectionModelCatalog = Awaited<ReturnType<typeof window.nileDesktop.connections.getConnectionModelCatalog>>;
export type ConnectionModelFieldMode = "hidden" | "select" | "manual";

type UseConnectionModelCatalogOptions = {
  connectionId: string | null;
  forceRefreshOnLoad?: boolean;
  enabled?: boolean;
};

export type UseConnectionModelSelectionStateOptions = UseConnectionModelCatalogOptions & {
  savedModelId: string | null | undefined;
  currentModelId: string;
  previewCount: number;
  showField?: boolean;
};

export function useConnectionModelCatalog({
  connectionId,
  forceRefreshOnLoad = false,
  enabled = true,
}: UseConnectionModelCatalogOptions) {
  const [catalog, setCatalog] = useState<ConnectionModelCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { recover } = useEncryptedLocalAccessRecovery();

  const loadCatalog = useCallback(async (forceRefresh: boolean = false) => {
    if (!connectionId || !enabled) {
      return null;
    }

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const nextCatalog = await recover(async () => await window.nileDesktop.connections.getConnectionModelCatalog({
        connectionId,
        forceRefresh,
      }));
      setCatalog(nextCatalog);
      return nextCatalog;
    } catch (error) {
      const failedCatalog = buildFailedCatalog(connectionId, error);
      setCatalog(failedCatalog);
      return failedCatalog;
    } finally {
      if (forceRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [connectionId, enabled, recover]);

  useEffect(() => {
    if (!connectionId || !enabled) {
      setCatalog(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    let cancelled = false;
    setCatalog(null);
    setIsLoading(true);
    void recover(async () => await window.nileDesktop.connections.getConnectionModelCatalog({
      connectionId,
      forceRefresh: forceRefreshOnLoad,
    }))
      .then((nextCatalog) => {
        if (!cancelled) {
          setCatalog(nextCatalog);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCatalog(buildFailedCatalog(connectionId, error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId, enabled, forceRefreshOnLoad, recover]);

  return {
    catalog,
    isLoading,
    isRefreshing,
    loadCatalog,
  };
}

export function useConnectionModelSelectionState({
  connectionId,
  forceRefreshOnLoad = false,
  enabled = true,
  savedModelId,
  currentModelId,
  previewCount,
  showField = true,
}: UseConnectionModelSelectionStateOptions) {
  const catalogState = useConnectionModelCatalog({
    connectionId,
    forceRefreshOnLoad,
    enabled,
  });
  const selection = useMemo(
    () => readConnectionModelSelectionState(
      catalogState.catalog,
      savedModelId,
      currentModelId,
      previewCount,
      showField,
    ),
    [catalogState.catalog, currentModelId, previewCount, savedModelId, showField],
  );

  return {
    ...catalogState,
    selection,
  };
}

function buildFailedCatalog(connectionId: string, error: unknown): ConnectionModelCatalog {
  return {
    connectionId,
    status: "error",
    models: [],
    message: error instanceof Error ? error.message : String(error),
  };
}

export function readCatalogModels(catalog: ConnectionModelCatalog | null): string[] {
  return catalog?.status === "available" ? catalog.models : [];
}

export function readModelOptions(
  catalog: ConnectionModelCatalog | null,
  savedModelId: string | null | undefined,
): string[] {
  const catalogModels = readCatalogModels(catalog);
  if (catalogModels.length > 0) {
    return catalogModels;
  }
  const normalizedSavedModelId = savedModelId?.trim();
  return normalizedSavedModelId ? [normalizedSavedModelId] : [];
}

export type ConnectionModelSelectionState = {
  mode: ConnectionModelFieldMode;
  /** Connection-level detected choices or a saved agent-level fallback when detection is unavailable. */
  modelOptions: string[];
  /** Ordered detected models for previews, datalists, and expanded lists. */
  orderedModels: string[];
  /** The next agent-level selected model id to seed into the editor. */
  nextSelectedModelId: string;
  previewText: string;
  hasOverflowModels: boolean;
  message: string | null;
};

export function readConnectionModelSelectionState(
  catalog: ConnectionModelCatalog | null,
  savedModelId: string | null | undefined,
  currentModelId: string,
  previewCount: number,
  showField: boolean = true,
): ConnectionModelSelectionState {
  if (!showField) {
    return {
      mode: "hidden",
      modelOptions: [],
      orderedModels: [],
      nextSelectedModelId: "",
      previewText: "",
      hasOverflowModels: false,
      message: null,
    };
  }

  const modelOptions = readModelOptions(catalog, savedModelId);
  const orderedModels = prioritizeDetectedModels(readCatalogModels(catalog), currentModelId);
  const previewModels = orderedModels.slice(0, previewCount);
  const mode: ConnectionModelFieldMode = modelOptions.length > 0 ? "select" : "manual";

  return {
    mode,
    modelOptions,
    orderedModels,
    nextSelectedModelId: readNextSelectedModelId(currentModelId, savedModelId, modelOptions),
    previewText: previewModels.join(", "),
    hasOverflowModels: orderedModels.length > previewModels.length,
    message: catalog?.message?.trim() || null,
  };
}

export function readNextSelectedModelId(
  currentModelId: string,
  savedModelId: string | null | undefined,
  modelOptions: string[],
): string {
  const normalizedCurrentModelId = currentModelId.trim();
  if (normalizedCurrentModelId && modelOptions.includes(normalizedCurrentModelId)) {
    return normalizedCurrentModelId;
  }

  const normalizedSavedModelId = savedModelId?.trim() ?? "";
  if (normalizedSavedModelId && modelOptions.includes(normalizedSavedModelId)) {
    return normalizedSavedModelId;
  }

  return modelOptions[0] ?? normalizedSavedModelId;
}

export function prioritizeDetectedModels(models: string[], selectedModelId: string): string[] {
  const normalizedSelectedModelId = selectedModelId.trim().toLowerCase();
  if (!normalizedSelectedModelId) {
    return sortModelsByFamily(models);
  }

  return [...sortModelsByFamily(models)].sort((left, right) => {
    const leftRank = scoreModel(left, normalizedSelectedModelId);
    const rightRank = scoreModel(right, normalizedSelectedModelId);
    if (leftRank !== rightRank) {
      return rightRank - leftRank;
    }
    return left.localeCompare(right);
  });
}

function sortModelsByFamily(models: string[]): string[] {
  return [...models].sort((left, right) => {
    const leftPriority = modelFamilyPriority(left);
    const rightPriority = modelFamilyPriority(right);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
    return left.localeCompare(right);
  });
}

function scoreModel(modelId: string, normalizedSelectedModelId: string): number {
  const normalizedModelId = modelId.trim().toLowerCase();
  if (normalizedModelId === normalizedSelectedModelId) {
    return 100;
  }

  const selectedSegments = normalizedSelectedModelId.split(/[-_.:/]+/).filter(Boolean);
  const modelSegments = normalizedModelId.split(/[-_.:/]+/).filter(Boolean);
  const sharedSegmentCount = selectedSegments.filter((segment) => modelSegments.includes(segment)).length;

  if (sharedSegmentCount > 0) {
    return 10 + sharedSegmentCount;
  }

  const selectedPrefix = selectedSegments[0];
  if (selectedPrefix && normalizedModelId.startsWith(`${selectedPrefix}-`)) {
    return 5;
  }

  return 0;
}

function modelFamilyPriority(modelId: string): number {
  const normalizedModelId = modelId.trim().toLowerCase();
  if (
    normalizedModelId.startsWith("gpt-")
    || normalizedModelId.startsWith("codex-")
    || normalizedModelId.startsWith("o1")
    || normalizedModelId.startsWith("o3")
    || normalizedModelId.startsWith("o4")
  ) {
    return 2;
  }

  if (normalizedModelId.startsWith("claude-")) {
    return 1;
  }

  return 0;
}
