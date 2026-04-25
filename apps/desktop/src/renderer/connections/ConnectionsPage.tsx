import type { DesktopAgentState } from "../../DesktopTypes";
import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";
import { Cable } from "lucide-react";

import type { Translator } from "../shared/I18n";
import type { Definition, SettingsState } from "../shared/Support";
import type { LanguagePreference } from "../settings/Preferences";
import { ConnectionDetailPage } from "./ConnectionDetailPage";
import { ConnectionEditPage } from "./ConnectionEditPage";
import { ConnectionTable } from "./ConnectionTable";
import { ConnectionsToolbar } from "./ConnectionsToolbar";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";
import { Button } from "../ui/button";

type ConnectionsPageProps = {
  detailContextAgent: DesktopAgentState | null;
  definitions: Definition[];
  language: LanguagePreference;
  state: SettingsState;
  selectedConnectionId: string | null;
  t: Translator;
  onBackFromAgentDetail(): void;
  onOpenAddPage(): void;
  onSelectConnection(connectionId: string | null): void;
  onRefresh(): Promise<void>;
  onBindCursorUsage(connectionId: string): Promise<void>;
  onRemove(connectionId: string): Promise<void>;
  onUpdateConnection(input: {
    connectionId: string;
    label?: string;
    enabledAgents?: AgentId[];
    endpointUrl?: string;
    apiKeySource?: "direct" | "env_key";
    apiKey?: string;
    envKey?: string;
    openAiSessionSource?: "login" | "current_codex";
    openAiAuthJsonPath?: string;
    claudeSessionSource?: "login" | "current_claude";
    syncSelectedAgents?: boolean;
  }): Promise<void>;
};

export function ConnectionsPage({
  detailContextAgent,
  definitions,
  language,
  state,
  selectedConnectionId,
  t,
  onBackFromAgentDetail,
  onOpenAddPage,
  onSelectConnection,
  onRefresh,
  onBindCursorUsage,
  onRemove,
  onUpdateConnection,
}: ConnectionsPageProps) {
  const [mode, setMode] = useState<"detail" | "edit">("detail");
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

  useEffect(() => {
    setMode("detail");
  }, [selectedConnectionId]);

  if (selectedConnection) {
    if (mode === "edit") {
      return (
        <ConnectionEditPage
          connection={selectedConnection}
          definitions={definitions}
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
        onEdit={() => setMode("edit")}
        onRefresh={onRefresh}
        onRemove={async (connectionId) => {
          await onRemove(connectionId);
          onSelectConnection(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ConnectionsToolbar
        t={t}
        providerFilter={providerFilter}
        providers={providers}
        searchQuery={searchQuery}
        onProviderFilterChange={setProviderFilter}
        onOpenAddPage={onOpenAddPage}
        onRefresh={onRefresh}
        onSearchQueryChange={setSearchQuery}
      />
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
          t={t}
          onOpenDetails={onSelectConnection}
        />
      )}
    </div>
  );
}
