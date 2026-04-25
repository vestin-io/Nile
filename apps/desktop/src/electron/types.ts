import type { AgentId } from "@nile/core/models/agent";
import type { ResetStateResult } from "@nile/core/application/local";
import type { AuthMode } from "@nile/core/models/access";
import type { ConnectionPresetFamily } from "@nile/core/models/connection";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type {
  BindCursorUsageResult,
  ConnectionOnboardingSuggestion,
  ImportDetectedSetupsResult,
  RemoveConnectionResult,
} from "@nile/core/runtime-local";

export type DesktopAddConnectionInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
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
};

export type DesktopConnectionSummary = {
  id: string;
  label: string;
  endpointId: string;
  endpointUrl?: string | null;
  endpointLabel: string;
  endpointFamily: EndpointFamily | "unknown";
  authMode: AuthMode;
  apiKeySource?: "direct" | "env_key";
  envKey?: string | null;
  reused?: boolean;
};

export type DesktopPreparedConnectionDraft = {
  id: string;
  authMode: AuthMode;
  labelSuggestion: string;
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
  suggestedAgents: AgentId[];
};

export type DesktopSavePreparedConnectionInput = {
  draftId: string;
  label?: string;
  enabledAgents?: AgentId[];
};

export type DesktopUpdateConnectionInput = {
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
};

export type DesktopDescribeSavedConnectionOnboardingInput = {
  connectionId: string;
  endpointUrl?: string;
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
};

export type DesktopBridge = {
  getMenubarState(): Promise<import("../DesktopTypes").MenubarState>;
  getSettingsState(): Promise<import("../DesktopTypes").SettingsState>;
  getHistoryState(): Promise<import("../DesktopTypes").HistoryState>;
  listConnectionDefinitions(): Promise<import("@nile/core/models/connection").ConnectionDefinition[]>;
  chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null>;
  describeConnectionOnboarding(input: DesktopAddConnectionInput): Promise<ConnectionOnboardingSuggestion>;
  describeSavedConnectionOnboarding(input: DesktopDescribeSavedConnectionOnboardingInput): Promise<ConnectionOnboardingSuggestion>;
  prepareConnectionDraft(input: DesktopAddConnectionInput): Promise<DesktopPreparedConnectionDraft>;
  savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary>;
  switchConnection(agentId: AgentId, connectionId: string): Promise<import("../DesktopTypes").DesktopConnection>;
  rollbackLatestMutation(agentId: AgentId): Promise<import("@nile/core/runtime-local").RollbackLatestAgentResult>;
  addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary>;
  updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary>;
  importDetectedSetups(scanIds: AgentId[]): Promise<ImportDetectedSetupsResult>;
  importCurrentConnection(agentId: AgentId): Promise<DesktopConnectionSummary>;
  removeConnection(connectionId: string): Promise<RemoveConnectionResult>;
  bindCursorUsage(connectionId: string, sessionToken: string): Promise<BindCursorUsageResult>;
  resetState(): Promise<ResetStateResult>;
  openGitHubIssues(): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  openSettings(): Promise<void>;
  openSupportEmail(): Promise<void>;
  refreshSettings(): Promise<void>;
  refreshMenubar(): Promise<void>;
  updateAgentHome(agentId: AgentId, path: string | null): Promise<void>;
};
