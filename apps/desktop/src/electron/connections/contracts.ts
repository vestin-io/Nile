import type { AgentId, RollbackLatestAgentResult } from "@nile/core/models/agent";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-setup";
import type { RemoveConnectionResult, ResetStateResult } from "@nile/builtins/local";
import type { BindCursorUsageResult } from "@nile/builtins/cursor-usage";
import type { AuthMode } from "@nile/core/models/access";
import type { ConnectionPresetFamily, ConnectionOnboardingSuggestion, ConnectionModelCatalogResult } from "@nile/core/models/connection";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { DesktopConnectionAlert, DesktopConnection } from "../../state/Types";
import type { CreateConnectionAlertInput, UpdateConnectionAlertInput } from "../alerts/Store";

export type DesktopConnectionCredentialInput = {
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  sessionSource?: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor";
  sessionAuthJsonPath?: string;
  credentialStorageBackend?: CredentialStorageBackend;
  encryptedLocalPassphrase?: string;
};

export type DesktopAddConnectionInput = DesktopConnectionCredentialInput & {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
  label?: string;
  endpointUrl?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
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
};

export type DesktopCredentialStorageState = {
  encryptedLocalVaultExists: boolean;
  encryptedLocalUnlocked: boolean;
};

export type DesktopConnectionModelCatalog = ConnectionModelCatalogResult;

export type DesktopGetConnectionModelCatalogInput = {
  connectionId: string;
  forceRefresh?: boolean;
};

export type DesktopSavePreparedConnectionInput = {
  draftId: string;
  label?: string;
  enabledAgents?: AgentId[];
};

export type DesktopImportCurrentConnectionInput = DesktopConnectionCredentialInput & {
  agentId: AgentId;
};

export type DesktopDiscardPreparedConnectionDraftInput = {
  draftId: string;
};

export type DesktopUpdateConnectionInput = DesktopConnectionCredentialInput & {
  connectionId: string;
  label?: string;
  enabledAgents?: AgentId[];
  endpointUrl?: string;
  syncSelectedAgents?: boolean;
};

export type DesktopDescribeSavedConnectionOnboardingInput = DesktopConnectionCredentialInput & {
  connectionId: string;
  endpointUrl?: string;
};

export type DesktopUpdateAgentConnectionModelInput = {
  agentId: AgentId;
  connectionId: string;
  modelId: string | null;
};

export type DesktopConnectionBridge = {
  listConnectionDefinitions(): Promise<import("@nile/core/models/connection").ConnectionDefinition[]>;
  getCredentialStorageState(): Promise<DesktopCredentialStorageState>;
  unlockEncryptedLocalStorage(passphrase: string): Promise<void>;
  chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null>;
  describeConnectionOnboarding(input: DesktopAddConnectionInput): Promise<ConnectionOnboardingSuggestion>;
  describeSavedConnectionOnboarding(input: DesktopDescribeSavedConnectionOnboardingInput): Promise<ConnectionOnboardingSuggestion>;
  prepareConnectionDraft(input: DesktopAddConnectionInput): Promise<DesktopPreparedConnectionDraft>;
  savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary>;
  discardPreparedConnectionDraft(input: DesktopDiscardPreparedConnectionDraftInput): Promise<void>;
  switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection>;
  rollbackLatestMutation(agentId: AgentId): Promise<RollbackLatestAgentResult>;
  addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary>;
  updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary>;
  importDetectedSetups(scanIds: AgentId[]): Promise<ImportDetectedSetupsResult>;
  importCurrentConnection(input: DesktopImportCurrentConnectionInput): Promise<DesktopConnectionSummary>;
  removeConnection(connectionId: string): Promise<RemoveConnectionResult>;
  updateAgentConnectionModel(input: DesktopUpdateAgentConnectionModelInput): Promise<string | null>;
  getConnectionModelCatalog(input: DesktopGetConnectionModelCatalogInput): Promise<DesktopConnectionModelCatalog>;
  bindCursorUsage(connectionId: string, sessionToken: string): Promise<BindCursorUsageResult>;
  createUsageAlert(input: CreateConnectionAlertInput): Promise<DesktopConnectionAlert>;
  updateUsageAlert(input: UpdateConnectionAlertInput): Promise<DesktopConnectionAlert>;
  deleteUsageAlert(connectionId: string, alertId: string): Promise<void>;
  resetState(): Promise<ResetStateResult>;
};
