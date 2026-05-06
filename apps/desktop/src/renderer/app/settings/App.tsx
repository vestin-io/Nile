import { useMemo, useState } from "react";

import { readCodexAuthJsonPath } from "../../connections/AuthJsonPath";
import type { AgentDetailTab } from "../../agents/detail/Page";
import { useDesktopPreferences } from "./usePreferences";
import { useSettingsNavigation } from "./useNavigation";
import { useDesktopData } from "./useData";
import { useSidebarState } from "./useSidebarState";
import { SettingsChrome } from "./Chrome";
import { SettingsDialogs } from "./Dialogs";
import { SettingsPageContent } from "./PageContent";
import { useDesktopReleaseInfo } from "./useReleaseInfo";
import { useSettingsConnectionActions } from "./useConnectionActions";
import { useSettingsFlow } from "./useFlow";
import { Button } from "../../ui/button";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";

export function SettingsApp() {
  const {
    canConfigureAgent,
    definitions,
    error,
    historyState,
    isLoading,
    readDefinitionsForAgent,
    refresh,
    settingsState,
  } = useDesktopData();
  const { preferences, setPreferences, t } = useDesktopPreferences();
  const { sidebarOpen, setSidebarOpen } = useSidebarState();
  const {
    addConnectionReturnTarget,
    addConnectionTargetAgentId,
    currentPage,
    hasSavedConnections,
    openAddConnectionPage,
    repairUsageConnectionId,
    reusedConnectionDialog,
    selectedAgentDetailId,
    selectedConnectionContextAgentId,
    selectedConnectionId,
    setCurrentPage,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    showAgents,
    showConnections,
    showQuickSetupNav,
    visiblePage,
  } = useSettingsNavigation({
    quickSetupDismissed: preferences.quickSetupDismissed,
    settingsState,
  });
  const [nileDialogOpen, setNileDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedAgentDetailTab, setSelectedAgentDetailTab] = useState<AgentDetailTab>("connections");
  const releaseInfo = useDesktopReleaseInfo();
  const {
    closeAddConnectionPage,
    completeQuickSetup,
    isResetting,
    openQuickSetup,
    resetDesktopState,
  } = useSettingsFlow({
    addConnectionReturnTarget,
    hasSavedConnections,
    refresh,
    setCurrentPage,
    setPreferences,
  });

  const addConnectionDefinitions = useMemo(
    () => readDefinitionsForAgent(addConnectionTargetAgentId),
    [addConnectionTargetAgentId, readDefinitionsForAgent],
  );
  const defaultOpenAiAuthJsonPath = useMemo(
    () => readCodexAuthJsonPath(settingsState?.advanced.agentHomes),
    [settingsState?.advanced.agentHomes],
  );
  const repairUsageConnection =
    settingsState?.connections.find((connection) => connection.id === repairUsageConnectionId) ?? null;
  const selectedConnectionContextAgent =
    settingsState?.agents.find((agent) => agent.agentId === selectedConnectionContextAgentId) ?? null;

  if (isLoading && (!settingsState || !historyState)) {
    return <LoadingShell label={t("loading.desktop")} />;
  }

  if ((!settingsState || !historyState) && error) {
    return (
      <ErrorShell
        description={error}
        isResetting={isResetting}
        resetLabel={t("settings.reset.action")}
        retryLabel={t("common.refresh")}
        title={t("common.configurationError")}
        onReset={() => {
          void resetDesktopState();
        }}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  if (!settingsState || !historyState) {
    return <LoadingShell label={t("loading.desktop")} />;
  }

  const {
    addConnection,
    bindCursorUsage,
    continueReusedConnection,
    importCurrentConnection,
    openConnection,
    prepareConnectionDraft,
    removeConnection,
    rollbackAgent,
    savePreparedConnection,
    updateConnection,
    useConnection,
  } = useSettingsConnectionActions({
    addConnectionReturnTarget,
    addConnectionTargetAgentId,
    refresh,
    reusedConnectionDialog,
    settingsState,
    setCurrentPage,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
  });

  return (
    <SettingsChrome
      currentPage={currentPage}
      error={error}
      isSidebarOpen={sidebarOpen}
      showAgents={showAgents}
      showConnections={showConnections}
      showQuickSetup={showQuickSetupNav}
      t={t}
      onOpenAbout={() => setNileDialogOpen(true)}
      onPageChange={setCurrentPage}
      onRefresh={refresh}
      onSidebarOpenChange={setSidebarOpen}
    >
      <SettingsPageContent
        addConnectionDefinitions={addConnectionDefinitions}
        addConnectionTargetAgentId={addConnectionTargetAgentId}
        canConfigureAgent={canConfigureAgent}
        defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
        definitions={definitions}
        historyState={historyState}
        isResetting={isResetting}
        language={preferences.language}
        preferences={preferences}
        releaseInfo={releaseInfo}
        selectedAgentDetailId={selectedAgentDetailId}
        selectedAgentDetailTab={selectedAgentDetailTab}
        selectedConnectionContextAgent={selectedConnectionContextAgent}
        selectedConnectionId={selectedConnectionId}
        settingsState={settingsState}
        showQuickSetupNav={showQuickSetupNav}
        t={t}
        visiblePage={visiblePage}
        onAddConnection={addConnection}
        onAgentOrderChange={(agentOrder) => setPreferences((current) => ({ ...current, agentOrder }))}
        onBackFromAgentDetail={() => setCurrentPage("agents")}
        onBindCursorUsage={bindCursorUsage}
        onCheckForUpdates={async () => {
          await window.nileDesktop.updates.checkForUpdates().catch(() => ({ status: "unavailable" as const }));
        }}
        onCloseAddConnectionPage={closeAddConnectionPage}
        onCompleteQuickSetup={completeQuickSetup}
        onConfigureAgent={(agentId) => openAddConnectionPage(agentId)}
        onConfirmImportAgent={importCurrentConnection}
        onInstallUpdate={async () => {
          await window.nileDesktop.updates.installUpdate().catch(() => ({ status: "unavailable" as const }));
        }}
        onLanguageChange={(language) => setPreferences((current) => ({ ...current, language }))}
        onOpenAddConnection={() => openAddConnectionPage()}
        onOpenConnection={openConnection}
        onOpenProvidersLink={async (url) => {
          await window.nileDesktop.app.openExternalUrl(url);
        }}
        onOpenQuickSetup={openQuickSetup}
        onPrepareConnectionDraft={prepareConnectionDraft}
        onRefresh={refresh}
        onRemoveConnection={removeConnection}
        onReset={() => setResetDialogOpen(true)}
        onRollbackAgent={rollbackAgent}
        onSavePreparedConnection={savePreparedConnection}
        onSelectAgentDetail={(agentId) => {
          setSelectedAgentDetailId(agentId);
          if (!agentId) {
            setSelectedAgentDetailTab("connections");
          }
        }}
        onSelectAgentDetailTab={setSelectedAgentDetailTab}
        onSelectConnection={setSelectedConnectionId}
        onSelectConnectionContextAgent={setSelectedConnectionContextAgentId}
        onThemeChange={(theme) => setPreferences((current) => ({ ...current, theme }))}
        onUpdateAgentHome={async (agentId, path) => {
          await window.nileDesktop.app.updateAgentHome(agentId, path);
        }}
        onUpdateConnection={updateConnection}
        onUseConnection={useConnection}
      />

      <SettingsDialogs
        isResetDialogOpen={resetDialogOpen}
        isResetting={isResetting}
        isSupportOpen={nileDialogOpen}
        repairUsageConnection={repairUsageConnection}
        reusedConnectionDialog={reusedConnectionDialog}
        t={t}
        onBindCursorUsage={async (connectionId, sessionToken) => {
          await window.nileDesktop.connections.bindCursorUsage(connectionId, sessionToken);
        }}
        onCloseRepairUsage={() => setRepairUsageConnectionId(null)}
        onOpenGitHubIssues={async () => {
          await window.nileDesktop.app.openGitHubIssues();
        }}
        onOpenSupport={async () => {
          await window.nileDesktop.app.openSupportEmail();
        }}
        onRefresh={refresh}
        onContinueReusedConnection={continueReusedConnection}
        onResetConfirm={async () => {
          await resetDesktopState(() => setResetDialogOpen(false));
        }}
        onSetNileDialogOpen={setNileDialogOpen}
        onSetResetDialogOpen={setResetDialogOpen}
      />
    </SettingsChrome>
  );
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="rounded-lg border bg-card px-6 py-5 text-sm text-muted-foreground shadow-sm">
        {label}
      </div>
    </div>
  );
}

function ErrorShell({
  description,
  isResetting,
  resetLabel,
  retryLabel,
  title,
  onReset,
  onRetry,
}: {
  description: string;
  isResetting: boolean;
  resetLabel: string;
  retryLabel: string;
  title: string;
  onReset(): void;
  onRetry(): void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-sm">
        <Alert variant="destructive">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" disabled={isResetting} onClick={onReset}>
            {isResetting ? `${resetLabel}...` : resetLabel}
          </Button>
          <Button onClick={onRetry}>{retryLabel}</Button>
        </div>
      </div>
    </div>
  );
}
