import type { DesktopAgentState } from "../../../state/Types";
import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "@nile/core/models/agent";
import type { CredentialStorageBackend } from "@nile/core/services/credential";
import { Cable } from "lucide-react";

import type { Translator } from "../../shared/I18n";
import type { SettingsState } from "../../shared/DesktopData";
import type { Definition } from "../../shared/DesktopData";
import type { LanguagePreference } from "../../settings/Preferences";
import { useEncryptedLocalAccessRecovery } from "../../shared/EncryptedLocalAccess";
import { ConnectionDetailPage } from "../detail/Page";
import { ConnectionEditPage } from "../edit/Page";
import { ConnectionTable } from "./Table";
import { ConnectionsToolbar } from "../ConnectionsToolbar";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../ui/empty";
import { Button } from "../../ui/button";
import { Alert, AlertDescription } from "../../ui/alert";

type ConnectionsPageProps = {
  credentialStorageMode: CredentialStorageBackend | null;
  credentialStorageState: Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;
  detailContextAgent: DesktopAgentState | null;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  isCredentialStorageModeMixed?: boolean;
  isCredentialPortabilityBusy: boolean;
  language: LanguagePreference;
  state: SettingsState;
  selectedConnectionId: string | null;
  t: Translator;
  onBackFromAgentDetail(): void;
  onOpenAddPage(): void;
  onExportConnections(selectedConnectionIds?: string[]): Promise<void>;
  onImportConnections(): Promise<void>;
  onSelectConnection(connectionId: string | null): void;
  onRefresh(): Promise<void>;
  onBindCursorUsage(connectionId: string): Promise<void>;
  onReauthenticateConnection(connectionId: string): Promise<void>;
  onCreateAlert(input:
    | {
      connectionId: string;
      metricKey: string;
      metricLabel: string;
      type: "low-percent";
      thresholdPercent: number;
      enabled: boolean;
    }
    | {
      connectionId: string;
      metricKey: string;
      metricLabel: string;
      type: "renewed";
      enabled: boolean;
    }
  ): Promise<void>;
  onDeleteAlert(connectionId: string, alertId: string): Promise<void>;
  onOpenNotificationHistory(connectionId: string): void;
  onRemove(connectionId: string): Promise<void>;
  onUpdateAlert(input:
    | {
      alertId: string;
      connectionId: string;
      metricKey: string;
      metricLabel: string;
      type: "low-percent";
      thresholdPercent: number;
      enabled: boolean;
    }
    | {
      alertId: string;
      connectionId: string;
      metricKey: string;
      metricLabel: string;
      type: "renewed";
      enabled: boolean;
    }
  ): Promise<void>;
  onUpdateConnection(input: {
    connectionId: string;
    label?: string;
    enabledAgents?: AgentId[];
    endpointUrl?: string;
    apiKeySource?: "direct" | "env_key";
    apiKey?: string;
    envKey?: string;
    sessionSource?: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor";
    sessionAuthJsonPath?: string;
    syncSelectedAgents?: boolean;
  }): Promise<void>;
};

export function ConnectionsPage({
  credentialStorageMode,
  credentialStorageState,
  detailContextAgent,
  defaultOpenAiAuthJsonPath,
  definitions,
  isCredentialStorageModeMixed = false,
  isCredentialPortabilityBusy,
  language,
  state,
  selectedConnectionId,
  t,
  onBackFromAgentDetail,
  onOpenAddPage,
  onExportConnections,
  onImportConnections,
  onSelectConnection,
  onRefresh,
  onBindCursorUsage,
  onReauthenticateConnection,
  onCreateAlert,
  onDeleteAlert,
  onOpenNotificationHistory,
  onRemove,
  onUpdateAlert,
  onUpdateConnection,
}: ConnectionsPageProps) {
  const { requestUnlock } = useEncryptedLocalAccessRecovery();
  const [mode, setMode] = useState<"detail" | "edit">("detail");
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<(typeof state.connections)[number]["endpointFamily"] | "all">("all");
  const selectedConnection = state.connections.find((connection) => connection.id === selectedConnectionId) ?? null;
  const providers = useMemo(
    () => [...new Set(state.connections.map((connection) => connection.endpointFamily))].sort(),
    [state.connections],
  );
  const filteredConnections = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return state.connections.filter((connection) => {
      if (providerFilter !== "all" && connection.endpointFamily !== providerFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const searchableText = [
        connection.id,
        connection.label,
        connection.endpointLabel,
        connection.endpointUrl ?? "",
        connection.endpointFamily,
        ...connection.enabledAgents,
        ...connection.selectedByAgents,
      ].join(" ").toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [providerFilter, searchQuery, state.connections]);
  const hasActiveFilters = searchQuery.trim().length > 0 || providerFilter !== "all";
  const filteredConnectionIds = useMemo(
    () => filteredConnections.map((connection) => connection.id),
    [filteredConnections],
  );
  const filteredSelectedConnectionIds = useMemo(
    () => selectedConnectionIds.filter((connectionId) => filteredConnectionIds.includes(connectionId)),
    [filteredConnectionIds, selectedConnectionIds],
  );
  const hasSelectedConnections = filteredSelectedConnectionIds.length > 0;

  useEffect(() => {
    setMode("detail");
  }, [selectedConnectionId]);

  useEffect(() => {
    const allowedIds = new Set(state.connections.map((connection) => connection.id));
    setSelectedConnectionIds((current) => current.filter((connectionId) => allowedIds.has(connectionId)));
  }, [state.connections]);

  if (selectedConnection) {
      if (mode === "edit") {
        return (
          <ConnectionEditPage
            connection={selectedConnection}
            credentialStorageMode={credentialStorageMode}
            credentialStorageState={credentialStorageState}
            defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
            definitions={definitions}
            isCredentialStorageModeMixed={isCredentialStorageModeMixed}
            language={language}
            t={t}
            onBack={() => setMode("detail")}
          onSubmit={async (input) => {
            await onUpdateConnection({
              connectionId: selectedConnection.id,
              ...input,
            });
            setMode("detail");
          }}
        />
      );
    }

      return (
        <ConnectionDetailPage
          connection={selectedConnection}
          contextAgentLabel={detailContextAgent?.agentLabel ?? null}
          isCredentialStorageModeMixed={isCredentialStorageModeMixed}
          t={t}
          onBack={() => onSelectConnection(null)}
        onBackToAgentDetail={detailContextAgent ? () => {
          onSelectConnection(null);
          onBackFromAgentDetail();
        } : undefined}
        onBackToAgentList={detailContextAgent ? () => {
          onSelectConnection(null);
          onBackFromAgentDetail();
        } : undefined}
        onBindCursorUsage={onBindCursorUsage}
        onReauthenticateConnection={onReauthenticateConnection}
        onCreateAlert={onCreateAlert}
          onDeleteAlert={onDeleteAlert}
          onEdit={() => {
            if (isCredentialStorageModeMixed) {
              return;
            }
            setMode("edit");
          }}
          onOpenNotificationHistory={onOpenNotificationHistory}
          onRefresh={async () => {
            if (isCredentialStorageModeMixed) {
              return;
            }
            if (
              credentialStorageMode === "encrypted_local_storage"
              && credentialStorageState.encryptedLocalVaultExists
            && !credentialStorageState.encryptedLocalUnlocked
          ) {
            await requestUnlock(t("dialog.encryptedLocalUnlock.reasonRefreshConnection"));
          }
          await onRefresh();
        }}
        onRemove={async (connectionId) => {
          await onRemove(connectionId);
          onSelectConnection(null);
        }}
        onUpdateAlert={onUpdateAlert}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ConnectionsToolbar
        isPortabilityBusy={isCredentialPortabilityBusy}
        selectedConnectionCount={filteredSelectedConnectionIds.length}
        showPortabilityActions
        t={t}
        providerFilter={providerFilter}
        providers={providers}
        searchQuery={searchQuery}
        onProviderFilterChange={setProviderFilter}
        onOpenAddPage={onOpenAddPage}
        onExportSelected={hasSelectedConnections
          ? async () => {
            await onExportConnections(filteredSelectedConnectionIds);
          }
          : undefined}
        onImport={onImportConnections}
        onRefresh={async () => {
          if (isCredentialStorageModeMixed) {
            return;
          }
          if (
            credentialStorageMode === "encrypted_local_storage"
            && credentialStorageState.encryptedLocalVaultExists
            && !credentialStorageState.encryptedLocalUnlocked
          ) {
            await requestUnlock(t("dialog.encryptedLocalUnlock.reasonRefreshConnections"));
          }
          await onRefresh();
        }}
        onSearchQueryChange={setSearchQuery}
      />
      {isCredentialStorageModeMixed ? (
        <Alert variant="destructive">
          <AlertDescription>{t("settings.credentialStorage.mixedDescription")}</AlertDescription>
        </Alert>
      ) : null}
      {state.connections.length === 0 ? (
        <div className="rounded-2xl border bg-background px-6 py-10">
          <Empty className="items-center">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Cable className="h-6 w-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>{t("page.connections")}</EmptyTitle>
              <EmptyDescription>{t("connections.noSavedConnections")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="items-center">
              <Button onClick={onOpenAddPage}>
                {t("common.addConnection")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : filteredConnections.length === 0 ? (
        <div className="rounded-2xl border bg-background px-6 py-10">
          <Empty className="items-center">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Cable className="h-6 w-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>{t("connections.noMatchingConnectionsTitle")}</EmptyTitle>
              <EmptyDescription>{t("connections.noMatchingConnectionsDescription")}</EmptyDescription>
            </EmptyHeader>
            {hasActiveFilters ? (
              <EmptyContent className="items-center">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setProviderFilter("all");
                  }}
                >
                  {t("connections.clearFilters")}
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        </div>
      ) : (
        <ConnectionTable
          connections={filteredConnections}
          selectedConnectionIds={selectedConnectionIds}
          t={t}
          onOpenDetails={onSelectConnection}
          onSelectedConnectionIdsChange={setSelectedConnectionIds}
        />
      )}
    </div>
  );
}
