import { useMemo, useState } from "react";

import { readCodexAuthJsonPath } from "../../connections/AuthJsonPath";
import type { AgentDetailTab } from "../../agents/detail/Page";
import { useDesktopPreferences } from "./usePreferences";
import { useProfileFeature } from "./useProfileFeature";
import { useSettingsNavigation } from "./useNavigation";
import { useDesktopData } from "./useData";
import { useSidebarState } from "./useSidebarState";
import { SettingsChrome } from "./Chrome";
import { SettingsDialogs } from "./Dialogs";
import { SettingsPageContent } from "./PageContent";
import { useDesktopReleaseInfo } from "./useReleaseInfo";
import { useSettingsConnectionActions } from "./useConnectionActions";
import { useSettingsFlow } from "./useFlow";
import { readCurrentProfile } from "../../../profiles/CurrentProfile";
import { useWorkspaceProfiles, type WorkspaceProfileAssignment } from "../../profiles/useProfiles";
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
    reload,
    refresh,
    settingsState,
  } = useDesktopData();
  const { preferences, setPreferences, t } = useDesktopPreferences();
  const {
    isLoaded: isProfileFeatureLoaded,
    isSaving: isSavingProfileFeature,
    profileFeatureEnabled,
    setProfileFeatureEnabled,
  } = useProfileFeature();
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
    selectedProfileId,
    setCurrentPage,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    setSelectedProfileId,
    showAgents,
    showConnections,
    showProfiles,
    showQuickSetupNav,
    visiblePage,
  } = useSettingsNavigation({
    profileFeatureEnabled: isProfileFeatureLoaded ? profileFeatureEnabled : false,
    quickSetupDismissed: preferences.quickSetupDismissed,
    settingsState,
  });
  const [nileDialogOpen, setNileDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedAgentDetailTab, setSelectedAgentDetailTab] = useState<AgentDetailTab>("connections");
  const releaseInfo = useDesktopReleaseInfo();
  const { profiles, profileError, refreshProfiles } = useWorkspaceProfiles();
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
    refreshProfiles,
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
  const currentProfile = useMemo(
    () => profileFeatureEnabled
      ? readCurrentProfile(profiles, settingsState?.agents ?? [], settingsState?.advanced.agentHomes ?? [])
      : null,
    [profileFeatureEnabled, profiles, settingsState?.advanced.agentHomes, settingsState?.agents],
  );

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
    reload,
    refresh,
    reusedConnectionDialog,
    settingsState,
    setCurrentPage,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    onActionError: setActionError,
  });

  return (
    <SettingsChrome
      currentPage={currentPage}
      error={actionError ?? error}
      isSidebarOpen={sidebarOpen}
      currentProfileEmoji={currentProfile?.emoji ?? ""}
      currentProfileName={currentProfile?.name ?? null}
      showAgents={showAgents}
      showConnections={showConnections}
      showProfiles={showProfiles}
      showQuickSetup={showQuickSetupNav}
      t={t}
      onOpenAbout={() => setNileDialogOpen(true)}
      onPageChange={setCurrentPage}
      onRefresh={async () => {
        setActionError(null);
        await refresh();
      }}
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
        profileFeatureEnabled={profileFeatureEnabled}
        isSavingProfileFeature={isSavingProfileFeature}
        releaseInfo={releaseInfo}
        profileError={profileError}
        profiles={profiles}
        selectedAgentDetailId={selectedAgentDetailId}
        selectedAgentDetailTab={selectedAgentDetailTab}
        selectedConnectionContextAgent={selectedConnectionContextAgent}
        selectedConnectionId={selectedConnectionId}
        selectedProfileId={selectedProfileId}
        settingsState={settingsState}
        showQuickSetupNav={showQuickSetupNav}
        showProfiles={showProfiles}
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
        onApplyProfile={async (profileId) => {
          await window.nileDesktop.profiles.applyProfile(profileId);
          await refresh();
        }}
        onCreateProfile={async (name, emoji, assignments: WorkspaceProfileAssignment[]) => {
          const profile = await window.nileDesktop.profiles.createProfile(name, emoji, assignments);
          await refreshProfiles();
          return profile.id;
        }}
        onDeleteProfile={async (profileId) => {
          await window.nileDesktop.profiles.deleteProfile(profileId);
          await refreshProfiles();
        }}
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
        onProfileFeatureEnabledChange={setProfileFeatureEnabled}
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
        onSelectProfile={setSelectedProfileId}
        onThemeChange={(theme) => setPreferences((current) => ({ ...current, theme }))}
        onUpdateAgentHome={async (agentId, path) => {
          await window.nileDesktop.app.updateAgentHome(agentId, path);
        }}
        onSaveProfile={async (profileId, name, emoji, assignments) => {
          await window.nileDesktop.profiles.updateProfile(profileId, name, emoji, assignments);
          await refreshProfiles();
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
