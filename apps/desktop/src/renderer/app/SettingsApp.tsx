import { useMemo, useState } from "react";
import nileMarkSvg from "../../../../../assets/icons/nile-mark.svg";

import { AgentPage } from "../agents/AgentPage";
import type { AgentDetailTab } from "../agents/AgentDetailPage";
import { AddConnectionPage } from "../connections/AddConnectionPage";
import { readCodexAuthJsonPath } from "../connections/AuthJsonPath";
import { ConnectionsPage } from "../connections/ConnectionsPage";
import { CursorUsageRepairDialog } from "../connections/CursorUsageRepairDialog";
import { NileDialog } from "../settings/NileDialog";
import { ProvidersPage } from "../providers/ProvidersPage";
import { QuickSetupPage } from "../quick-setup/QuickSetupPage";
import { ResetStateDialog } from "../settings/ResetStateDialog";
import { ReusedConnectionDialog } from "../connections/ReusedConnectionDialog";
import { SettingsPage } from "../settings/SettingsPage";
import type { Definition } from "../shared/Support";
import { useDesktopPreferences } from "./useDesktopPreferences";
import {
  applyAddConnectionCompletionTarget,
  readReturnPage,
  useSettingsNavigation,
  type PageId,
} from "./useSettingsNavigation";
import { SettingsSidebarNav } from "./SettingsSidebarNav";
import { useDesktopData } from "./useDesktopData";
import { useSidebarState } from "./useSidebarState";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "../ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { type AgentId } from "@nile/core/models/agent/types";

const PAGE_TITLE_KEYS: Record<PageId, string> = {
  "quick-setup": "page.quickSetup",
  agents: "page.agents",
  connections: "page.connections",
  providers: "page.providers",
  settings: "page.settings",
  "add-connection": "page.addConnection",
};

export function SettingsApp() {
  const {
    canConfigureAgent,
    definitions,
    historyState,
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
  const [isResetting, setIsResetting] = useState(false);
  const [selectedAgentDetailTab, setSelectedAgentDetailTab] = useState<AgentDetailTab>("connections");
  const addConnectionDefinitions = useMemo(
    () => readDefinitionsForAgent(addConnectionTargetAgentId),
    [addConnectionTargetAgentId, readDefinitionsForAgent],
  );
  const defaultOpenAiAuthJsonPath = useMemo(
    () => readCodexAuthJsonPath(settingsState?.advanced.agentHomes),
    [settingsState?.advanced.agentHomes],
  );
  const repairUsageConnection = settingsState?.connections.find((connection) => connection.id === repairUsageConnectionId) ?? null;
  const selectedConnectionContextAgent =
    settingsState?.agents.find((agent) => agent.agentId === selectedConnectionContextAgentId) ?? null;
  const closeAddConnectionPage = () => {
    setCurrentPage(readReturnPage(addConnectionReturnTarget));
  };

  const handleAddConnection = async (input: {
    preset: Definition["preset"];
    authMode: string;
    label?: string;
    endpointUrl?: string;
    enabledAgents?: AgentId[];
    allowUndetectedGateway?: boolean;
    apiKeySource?: "direct" | "env_key";
    apiKey?: string;
    envKey?: string;
    openAiSessionSource?: "login" | "current_codex";
    openAiAuthJsonPath?: string;
    claudeSessionSource?: "login" | "current_claude";
  }) => {
    const targetAgentId = addConnectionTargetAgentId;
    const created = await window.nileDesktop.addConnection({
      preset: input.preset,
      authMode: input.authMode as Definition["supportedAuthModes"][number],
      label: input.label,
      endpointUrl: input.endpointUrl,
      enabledAgents: input.enabledAgents,
      allowUndetectedGateway: input.allowUndetectedGateway,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      openAiSessionSource: input.openAiSessionSource,
      openAiAuthJsonPath: input.openAiAuthJsonPath,
      claudeSessionSource: input.claudeSessionSource,
    });
    if (targetAgentId) {
      await window.nileDesktop.switchConnection(targetAgentId, created.id);
    }
    await refresh();
    if (created.reused) {
      setReusedConnectionDialog({
        connectionId: created.id,
        target: addConnectionReturnTarget,
      });
      return;
    }
    applyAddConnectionCompletionTarget(addConnectionReturnTarget, created.id, setCurrentPage, setSelectedConnectionId);
  };

  const handlePrepareConnectionDraft = async (input: {
    preset: Definition["preset"];
    authMode: string;
    label?: string;
    endpointUrl?: string;
    enabledAgents?: AgentId[];
    apiKeySource?: "direct" | "env_key";
    apiKey?: string;
    envKey?: string;
    openAiSessionSource?: "login" | "current_codex";
    openAiAuthJsonPath?: string;
    claudeSessionSource?: "login" | "current_claude";
  }) => {
    return await window.nileDesktop.prepareConnectionDraft({
      preset: input.preset,
      authMode: input.authMode as Definition["supportedAuthModes"][number],
      label: input.label,
      endpointUrl: input.endpointUrl,
      enabledAgents: input.enabledAgents,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      openAiSessionSource: input.openAiSessionSource,
      openAiAuthJsonPath: input.openAiAuthJsonPath,
      claudeSessionSource: input.claudeSessionSource,
    });
  };

  const handleSavePreparedConnection = async (input: {
    draftId: string;
    label?: string;
    enabledAgents?: AgentId[];
  }) => {
    const targetAgentId = addConnectionTargetAgentId;
    const created = await window.nileDesktop.savePreparedConnection({
      draftId: input.draftId,
      label: input.label,
      enabledAgents: input.enabledAgents,
    });
    if (targetAgentId) {
      await window.nileDesktop.switchConnection(targetAgentId, created.id);
    }
    await refresh();
    if (created.reused) {
      setReusedConnectionDialog({
        connectionId: created.id,
        target: addConnectionReturnTarget,
      });
      return;
    }
    applyAddConnectionCompletionTarget(addConnectionReturnTarget, created.id, setCurrentPage, setSelectedConnectionId);
  };

  const handleImportCurrent = async (agentId: AgentId) => {
    await window.nileDesktop.importCurrentConnection(agentId);
  };

  if (!settingsState || !historyState) {
    return <LoadingShell label={t("loading.desktop")} />;
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="flex h-screen flex-col overflow-hidden bg-muted/30 text-foreground">
      <header
        className="flex h-12 shrink-0 items-center border-b bg-background px-3"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex w-full items-center gap-3">
          <div className="w-[var(--desktop-titlebar-offset)] shrink-0" aria-hidden />
          <SidebarTrigger
            aria-label={sidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar")}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{t(PAGE_TITLE_KEYS[currentPage])}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <Button
              aria-label={t("nile.dialog.title")}
              className="h-9 w-9 rounded-xl p-0 [&_svg]:h-[18px] [&_svg]:w-[18px]"
              title={t("nile.dialog.title")}
              variant="ghost"
              onClick={() => setNileDialogOpen(true)}
            >
              <span
                aria-hidden="true"
                className="flex h-[18px] w-[18px] items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: nileMarkSvg }}
              />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SettingsSidebarNav
          currentPage={currentPage}
          showAgents={showAgents}
          showConnections={showConnections}
          showQuickSetup={showQuickSetupNav}
          t={t}
          onPageChange={setCurrentPage}
        />

        <SidebarInset>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:p-3">
            <div
              className={[
                "min-h-0 flex-1 overflow-auto p-4 sm:p-5",
              ].join(" ").trim()}
            >
              {visiblePage === "quick-setup" ? (
                <QuickSetupPage
                  canConfigureAgent={canConfigureAgent}
                  state={settingsState}
                  t={t}
                  onConfigureAgent={(agentId) => openAddConnectionPage(agentId)}
                  onConfirmAgent={handleImportCurrent}
                  onDone={() => {
                    setPreferences((current) => ({ ...current, quickSetupDismissed: true }));
                    setCurrentPage(hasSavedConnections ? "agents" : "quick-setup");
                  }}
                />
              ) : null}
              {visiblePage === "agents" ? (
                <AgentPage
                  agents={settingsState.agents}
                  agentHomes={settingsState.advanced.agentHomes}
                  agentOrder={preferences.agentOrder}
                  canConfigureAgent={canConfigureAgent}
                  detectedSetups={settingsState.detectedSetups}
                  history={historyState}
                  selectedDetailAgentId={selectedAgentDetailId}
                  selectedDetailTab={selectedAgentDetailTab}
                  showQuickSetupEntry={!showQuickSetupNav}
                  t={t}
                  onAgentOrderChange={(agentOrder) => setPreferences((current) => ({ ...current, agentOrder }))}
                  onAgentHomeSave={async (agentId, path) => {
                    await window.nileDesktop.updateAgentHome(agentId, path);
                  }}
                  onConfigureAgent={openAddConnectionPage}
                  onImport={async (agentId) => {
                    await window.nileDesktop.importCurrentConnection(agentId);
                  }}
                  onOpenQuickSetup={() => {
                    setPreferences((current) => ({ ...current, quickSetupDismissed: false }));
                    setCurrentPage("quick-setup");
                  }}
                  onOpenAddPage={openAddConnectionPage}
                  onOpenConnection={(connectionId, agentId) => {
                    setSelectedAgentDetailId(agentId);
                    setSelectedConnectionContextAgentId(agentId);
                    setSelectedConnectionId(connectionId);
                    setCurrentPage("connections");
                  }}
                  onRefresh={refresh}
                  onRollback={async (agentId) => {
                    await window.nileDesktop.rollbackLatestMutation(agentId);
                  }}
                  onSelectedDetailAgentIdChange={(agentId) => {
                    setSelectedAgentDetailId(agentId);
                    if (!agentId) {
                      setSelectedAgentDetailTab("connections");
                    }
                  }}
                  onSelectedDetailTabChange={setSelectedAgentDetailTab}
                  onSwitch={async (agentId, connectionId) => {
                    await window.nileDesktop.switchConnection(agentId, connectionId);
                  }}
                />
              ) : null}
              {visiblePage === "connections" ? (
                <ConnectionsPage
                  detailContextAgent={selectedConnectionContextAgent}
                  defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
                  definitions={definitions}
                  language={preferences.language}
                  state={settingsState}
                  selectedConnectionId={selectedConnectionId}
                  t={t}
                  onBackFromAgentDetail={() => {
                    setCurrentPage("agents");
                  }}
                  onOpenAddPage={() => openAddConnectionPage()}
                  onSelectConnection={(connectionId) => {
                    setSelectedConnectionId(connectionId);
                    setSelectedConnectionContextAgentId(null);
                  }}
                  onRefresh={refresh}
                  onBindCursorUsage={async (connectionId) => {
                    setRepairUsageConnectionId(connectionId);
                  }}
                  onRemove={async (connectionId) => {
                    const connection = settingsState.connections.find((entry) => entry.id === connectionId);
                    if (!connection || connection.selectedByAgents.length > 0) {
                      return;
                    }
                    await window.nileDesktop.removeConnection(connectionId);
                  }}
                  onUpdateConnection={async (input) => {
                    await window.nileDesktop.updateConnection(input);
                    await refresh();
                  }}
                />
              ) : null}
              {visiblePage === "add-connection" ? (
                <AddConnectionPage
                  key={addConnectionTargetAgentId ?? "all"}
                  defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
                  definitions={addConnectionDefinitions}
                  language={preferences.language}
                  targetAgentId={addConnectionTargetAgentId}
                  t={t}
                  onBack={closeAddConnectionPage}
                  onPrepareDraft={handlePrepareConnectionDraft}
                  onSavePrepared={handleSavePreparedConnection}
                  onSubmit={handleAddConnection}
                />
              ) : null}
              {visiblePage === "settings" ? (
                <SettingsPage
                  isResetting={isResetting}
                  preferences={preferences}
                  onReset={() => setResetDialogOpen(true)}
                  onLanguageChange={(language) => setPreferences((current) => ({ ...current, language }))}
                  onThemeChange={(theme) => setPreferences((current) => ({ ...current, theme }))}
                  t={t}
                />
              ) : null}
              {visiblePage === "providers" ? (
                <ProvidersPage
                  language={preferences.language}
                  t={t}
                  onOpenOfficialLink={async (url) => {
                    await window.nileDesktop.openExternalUrl(url);
                  }}
                />
              ) : null}
            </div>
          </div>
        </SidebarInset>
      </div>

      <CursorUsageRepairDialog
        connection={repairUsageConnection}
        open={repairUsageConnection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRepairUsageConnectionId(null);
          }
        }}
        onSubmit={async (connectionId, sessionToken) => {
          await window.nileDesktop.bindCursorUsage(connectionId, sessionToken);
          await refresh();
        }}
        t={t}
      />

      <ResetStateDialog
        isResetting={isResetting}
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        onConfirm={async () => {
          setIsResetting(true);
          try {
            await window.nileDesktop.resetState();
            setPreferences((current) => ({ ...current, quickSetupDismissed: false }));
            setResetDialogOpen(false);
            await refresh();
          } finally {
            setIsResetting(false);
          }
        }}
        t={t}
      />

      <ReusedConnectionDialog
        open={reusedConnectionDialog !== null}
        onContinue={() => {
          if (!reusedConnectionDialog) {
            return;
          }
          const { connectionId, target } = reusedConnectionDialog;
          setReusedConnectionDialog(null);
          applyAddConnectionCompletionTarget(target, connectionId, setCurrentPage, setSelectedConnectionId);
        }}
        t={t}
      />

      <NileDialog
        open={nileDialogOpen}
        t={t}
        onOpenChange={setNileDialogOpen}
        onOpenGitHubIssues={async () => {
          await window.nileDesktop.openGitHubIssues();
        }}
        onOpenSupport={async () => {
          await window.nileDesktop.openSupportEmail();
        }}
      />
    </SidebarProvider>
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
