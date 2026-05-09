import type { AgentId } from "@nile/core/models/agent/types";

import type { DesktopAgentState, DesktopReleaseInfo } from "../../../state/Types";
import { AgentPage } from "../../agents/AgentPage";
import { AddConnectionPage } from "../../connections/add/Page";
import { ConnectionsPage } from "../../connections/list/Page";
import { ProvidersPage } from "../../providers/ProvidersPage";
import { ProfilesPage } from "../../profiles/Page";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "../../profiles/useProfiles";
import { QuickSetupPage } from "../../quick-setup/Page";
import { SettingsPage } from "../../settings/general/Page";
import type {
  DesktopPreferences,
  LanguagePreference,
  ThemePreference,
} from "../../settings/Preferences";
import type { HistoryState, SettingsState } from "../../shared/DesktopData";
import type { Definition } from "../../shared/Definitions";
import type { Translator } from "../../shared/I18n";
import type { AgentDetailTab } from "../../agents/detail/Page";
import type { PageId } from "./useNavigation";
import type {
  AddConnectionPreparedSaveInput,
  AddConnectionSubmitInput,
  PreparedConnectionDraft,
} from "../../connections/add/Types";

type SettingsPageContentProps = {
  addConnectionDefinitions: Definition[];
  addConnectionTargetAgentId: AgentId | null;
  canConfigureAgent(agentId: AgentId): boolean;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  historyState: HistoryState;
  isResetting: boolean;
  isSavingProfileFeature: boolean;
  language: LanguagePreference;
  preferences: DesktopPreferences;
  profileFeatureEnabled: boolean;
  profileError: string | null;
  profiles: WorkspaceProfile[];
  releaseInfo: DesktopReleaseInfo | null;
  selectedAgentDetailId: AgentId | null;
  selectedAgentDetailTab: AgentDetailTab;
  selectedConnectionContextAgent: DesktopAgentState | null;
  selectedConnectionId: string | null;
  selectedProfileId: string | null;
  settingsState: SettingsState;
  showQuickSetupNav: boolean;
  showProfiles: boolean;
  t: Translator;
  visiblePage: PageId;
  onAddConnection(input: AddConnectionSubmitInput): Promise<void>;
  onApplyProfile(profileId: string): Promise<void>;
  onAgentOrderChange(agentOrder: AgentId[]): void;
  onBackFromAgentDetail(): void;
  onBindCursorUsage(connectionId: string): Promise<void>;
  onCheckForUpdates(): Promise<void>;
  onCloseAddConnectionPage(): void;
  onConfigureAgent(agentId: AgentId): void;
  onConfirmImportAgent(agentId: AgentId): Promise<void>;
  onCompleteQuickSetup(): void;
  onCreateProfile(name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<string>;
  onDeleteProfile(profileId: string): Promise<void>;
  onInstallUpdate(): Promise<void>;
  onLanguageChange(language: LanguagePreference): void;
  onOpenAddConnection(): void;
  onOpenConnection(connectionId: string, agentId: AgentId): void;
  onOpenProvidersLink(url: string): Promise<void>;
  onOpenQuickSetup(): void;
  onProfileFeatureEnabledChange(enabled: boolean): Promise<void>;
  onPrepareConnectionDraft(input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft>;
  onRefresh(): Promise<void>;
  onRemoveConnection(connectionId: string): Promise<void>;
  onReset(): void;
  onRollbackAgent(agentId: AgentId): Promise<void>;
  onSavePreparedConnection(input: AddConnectionPreparedSaveInput): Promise<void>;
  onSelectAgentDetail(agentId: AgentId | null): void;
  onSelectAgentDetailTab(tab: AgentDetailTab): void;
  onSelectConnection(connectionId: string | null): void;
  onSelectConnectionContextAgent(agentId: AgentId | null): void;
  onSelectProfile(profileId: string | null): void;
  onThemeChange(theme: ThemePreference): void;
  onUpdateAgentHome(agentId: AgentId, path: string | null): Promise<void>;
  onSaveProfile(profileId: string, name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<void>;
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
  onUseConnection(agentId: AgentId, connectionId: string): Promise<void>;
};

export function SettingsPageContent({
  addConnectionDefinitions,
  addConnectionTargetAgentId,
  canConfigureAgent,
  defaultOpenAiAuthJsonPath,
  definitions,
  historyState,
  isResetting,
  isSavingProfileFeature,
  language,
  preferences,
  profileFeatureEnabled,
  profileError,
  profiles,
  releaseInfo,
  selectedAgentDetailId,
  selectedAgentDetailTab,
  selectedConnectionContextAgent,
  selectedConnectionId,
  selectedProfileId,
  settingsState,
  showQuickSetupNav,
  showProfiles,
  t,
  visiblePage,
  onAddConnection,
  onApplyProfile,
  onAgentOrderChange,
  onBackFromAgentDetail,
  onBindCursorUsage,
  onCheckForUpdates,
  onCloseAddConnectionPage,
  onConfigureAgent,
  onConfirmImportAgent,
  onCompleteQuickSetup,
  onCreateProfile,
  onDeleteProfile,
  onInstallUpdate,
  onLanguageChange,
  onOpenAddConnection,
  onOpenConnection,
  onOpenProvidersLink,
  onOpenQuickSetup,
  onProfileFeatureEnabledChange,
  onPrepareConnectionDraft,
  onRefresh,
  onRemoveConnection,
  onReset,
  onRollbackAgent,
  onSavePreparedConnection,
  onSelectAgentDetail,
  onSelectAgentDetailTab,
  onSelectConnection,
  onSelectConnectionContextAgent,
  onSelectProfile,
  onThemeChange,
  onUpdateAgentHome,
  onSaveProfile,
  onUpdateConnection,
  onUseConnection,
}: SettingsPageContentProps) {
  if (visiblePage === "quick-setup") {
    return (
      <QuickSetupPage
        canConfigureAgent={canConfigureAgent}
        state={settingsState}
        t={t}
        onConfigureAgent={onConfigureAgent}
        onConfirmAgent={onConfirmImportAgent}
        onDone={onCompleteQuickSetup}
      />
    );
  }

  if (visiblePage === "agents") {
    return (
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
        onAgentOrderChange={onAgentOrderChange}
        onAgentHomeSave={onUpdateAgentHome}
        onConfigureAgent={onConfigureAgent}
        onImport={onConfirmImportAgent}
        onOpenQuickSetup={onOpenQuickSetup}
        onOpenAddPage={onOpenAddConnection}
        onOpenConnection={onOpenConnection}
        onRefresh={onRefresh}
        onRollback={onRollbackAgent}
        onSelectedDetailAgentIdChange={onSelectAgentDetail}
        onSelectedDetailTabChange={onSelectAgentDetailTab}
        onSwitch={onUseConnection}
      />
    );
  }

  if (visiblePage === "connections") {
    return (
      <ConnectionsPage
        detailContextAgent={selectedConnectionContextAgent}
        defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
        definitions={definitions}
        language={language}
        state={settingsState}
        selectedConnectionId={selectedConnectionId}
        t={t}
        onBackFromAgentDetail={onBackFromAgentDetail}
        onOpenAddPage={onOpenAddConnection}
        onSelectConnection={(connectionId) => {
          onSelectConnection(connectionId);
          if (connectionId) {
            return;
          }
          onSelectConnectionContextAgent(null);
        }}
        onRefresh={onRefresh}
        onBindCursorUsage={onBindCursorUsage}
        onRemove={onRemoveConnection}
        onUpdateConnection={onUpdateConnection}
      />
    );
  }

  if (visiblePage === "profiles") {
    return (
      <ProfilesPage
        agentHomes={settingsState.advanced.agentHomes}
        agents={settingsState.agents}
        isAvailable={showProfiles}
        profileError={profileError}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        t={t}
        onApplyProfile={onApplyProfile}
        onBackFromDetail={() => onSelectProfile(null)}
        onCreateProfile={onCreateProfile}
        onDeleteProfile={onDeleteProfile}
        onOpenProfile={onSelectProfile}
        onSaveProfile={onSaveProfile}
      />
    );
  }

  if (visiblePage === "add-connection") {
    return (
      <AddConnectionPage
        key={addConnectionTargetAgentId ?? "all"}
        defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
        definitions={addConnectionDefinitions}
        language={language}
        targetAgentId={addConnectionTargetAgentId}
        t={t}
        onBack={onCloseAddConnectionPage}
        onPrepareDraft={onPrepareConnectionDraft}
        onSavePrepared={onSavePreparedConnection}
        onSubmit={onAddConnection}
      />
    );
  }

  if (visiblePage === "settings") {
    return (
      <SettingsPage
        isResetting={isResetting}
        isSavingProfileFeature={isSavingProfileFeature}
        preferences={preferences}
        profileFeatureEnabled={profileFeatureEnabled}
        releaseInfo={releaseInfo}
        t={t}
        onCheckForUpdates={onCheckForUpdates}
        onInstallUpdate={onInstallUpdate}
        onLanguageChange={onLanguageChange}
        onProfileFeatureEnabledChange={onProfileFeatureEnabledChange}
        onReset={onReset}
        onThemeChange={onThemeChange}
      />
    );
  }

  return (
    <ProvidersPage
      language={language}
      t={t}
      onOpenOfficialLink={onOpenProvidersLink}
    />
  );
}
