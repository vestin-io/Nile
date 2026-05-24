import { isAgentId, type AgentId } from "@nile/core/models/agent";
import { SUPPORTED_AUTH_MODES, type AuthMode } from "@nile/core/models/access";
import {
  SUPPORTED_CONNECTION_PRESET_FAMILIES,
  type ConnectionPresetFamily,
} from "@nile/core/models/connection";
import {
  SUPPORTED_CREDENTIAL_STORAGE_BACKENDS,
  type CredentialStorageBackend,
} from "@nile/core/services/credential";

import type {
  DesktopAddConnectionInput,
  DesktopDescribeSavedConnectionOnboardingInput,
  DesktopDiscardPreparedConnectionDraftInput,
  DesktopGetConnectionModelCatalogInput,
  DesktopImportCurrentConnectionInput,
  DesktopSavePreparedConnectionInput,
  DesktopUpdateAgentConnectionModelInput,
  DesktopUpdateConnectionInput,
} from "../connections/contracts";
import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";
import type { CreateConnectionAlertInput, UpdateConnectionAlertInput } from "../alerts/Store";

export class DesktopIpcInputValidator {
  readOptionalString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be a string`);
    }
    return value;
  }

  readNullableString(value: unknown, fieldName: string): string | null {
    if (value === null) {
      return null;
    }
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be a string or null`);
    }
    return value;
  }

  readRequiredString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return value;
  }

  readBoolean(value: unknown, fieldName: string): boolean {
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName} must be a boolean`);
    }
    return value;
  }

  readAgentId(value: unknown, fieldName = "agentId"): AgentId {
    const agentId = this.readRequiredString(value, fieldName);
    if (!isAgentId(agentId)) {
      throw new Error(`${fieldName} is not a supported agent`);
    }
    return agentId;
  }

  readAgentIds(value: unknown, fieldName: string): AgentId[] {
    if (!Array.isArray(value)) {
      throw new Error(`${fieldName} must be an array`);
    }
    return value.map((entry, index) => this.readAgentId(entry, `${fieldName}[${index}]`));
  }

  readStringArray(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value)) {
      throw new Error(`${fieldName} must be an array`);
    }
    return value.map((entry, index) => this.readRequiredString(entry, `${fieldName}[${index}]`));
  }

  readAddConnectionInput(input: unknown): DesktopAddConnectionInput {
    const record = this.readRecord(input, "add connection input");
    return {
      preset: this.readPreset(record.preset),
      authMode: this.readAuthMode(record.authMode),
      ...this.readOptionalCredentialFields(record),
      ...this.readOptionalCredentialStorageModeFields(record),
      allowUndetectedGateway: this.readOptionalBoolean(record.allowUndetectedGateway, "allowUndetectedGateway"),
    };
  }

  readUpdateConnectionInput(input: unknown): DesktopUpdateConnectionInput {
    const record = this.readRecord(input, "update connection input");
    return {
      connectionId: this.readRequiredString(record.connectionId, "connectionId"),
      ...this.readOptionalCredentialFields(record),
      syncSelectedAgents: this.readOptionalBoolean(record.syncSelectedAgents, "syncSelectedAgents"),
    };
  }

  readDescribeSavedConnectionOnboardingInput(input: unknown): DesktopDescribeSavedConnectionOnboardingInput {
    const record = this.readRecord(input, "describe saved connection onboarding input");
    return {
      connectionId: this.readRequiredString(record.connectionId, "connectionId"),
      endpointUrl: this.readOptionalString(record.endpointUrl, "endpointUrl"),
      apiKeySource: this.readOptionalApiKeySource(record.apiKeySource),
      apiKey: this.readOptionalString(record.apiKey, "apiKey"),
      envKey: this.readOptionalString(record.envKey, "envKey"),
    };
  }

  readGetConnectionModelCatalogInput(input: unknown): DesktopGetConnectionModelCatalogInput {
    const record = this.readRecord(input, "get connection model catalog input");
    return {
      connectionId: this.readRequiredString(record.connectionId, "connectionId"),
      forceRefresh: this.readOptionalBoolean(record.forceRefresh, "forceRefresh"),
    };
  }

  readUpdateAgentConnectionModelInput(input: unknown): DesktopUpdateAgentConnectionModelInput {
    const record = this.parseRecord(input, "update agent connection model input");
    return {
      agentId: this.readAgentId(record.agentId, "agentId"),
      connectionId: this.readRequiredString(record.connectionId, "connectionId"),
      modelId: record.modelId === undefined ? null : this.readNullableString(record.modelId, "modelId"),
    };
  }

  readSavePreparedConnectionInput(input: unknown): DesktopSavePreparedConnectionInput {
    const record = this.readRecord(input, "save prepared connection input");
    return {
      draftId: this.readRequiredString(record.draftId, "draftId"),
      label: this.readOptionalString(record.label, "label"),
      enabledAgents: this.readOptionalAgentIds(record.enabledAgents, "enabledAgents"),
    };
  }

  readDiscardPreparedConnectionDraftInput(input: unknown): DesktopDiscardPreparedConnectionDraftInput {
    const record = this.readRecord(input, "discard prepared connection draft input");
    return {
      draftId: this.readRequiredString(record.draftId, "draftId"),
    };
  }

  readImportCurrentConnectionInput(input: unknown): DesktopImportCurrentConnectionInput {
    const record = this.readRecord(input, "import current connection input");
    return {
      agentId: this.readAgentId(record.agentId, "agentId"),
      ...this.readOptionalCredentialStorageModeFields(record),
    };
  }

  readCreateConnectionAlertInput(input: unknown): CreateConnectionAlertInput {
    const record = this.readRecord(input, "create connection alert input");
    const base = {
      connectionId: this.readRequiredString(record.connectionId, "connectionId"),
      metricKey: this.readRequiredString(record.metricKey, "metricKey"),
      metricLabel: this.readRequiredString(record.metricLabel, "metricLabel"),
      enabled: this.readBoolean(record.enabled, "enabled"),
    };
    const type = this.readConnectionAlertType(record.type);
    if (type === "renewed") {
      return {
        ...base,
        type,
      };
    }
    return {
      ...base,
      type,
      thresholdPercent: this.readPercent(record.thresholdPercent, "thresholdPercent"),
    };
  }

  readUpdateConnectionAlertInput(input: unknown): UpdateConnectionAlertInput {
    const record = this.readRecord(input, "update connection alert input");
    const base = {
      alertId: this.readRequiredString(record.alertId, "alertId"),
      connectionId: this.readRequiredString(record.connectionId, "connectionId"),
      metricKey: this.readRequiredString(record.metricKey, "metricKey"),
      metricLabel: this.readRequiredString(record.metricLabel, "metricLabel"),
      enabled: this.readBoolean(record.enabled, "enabled"),
    };
    const type = this.readConnectionAlertType(record.type);
    if (type === "renewed") {
      return {
        ...base,
        type,
      };
    }
    return {
      ...base,
      type,
      thresholdPercent: this.readPercent(record.thresholdPercent, "thresholdPercent"),
    };
  }

  readWorkspaceProfileAssignments(value: unknown): Array<{ agentId: AgentId; connectionId?: string; homePath?: string | null }> {
    if (!Array.isArray(value)) {
      throw new Error("assignments must be an array");
    }

    return value.map((entry, index) => {
      const record = this.readRecord(entry, `assignments[${index}]`);
      const assignment: { agentId: AgentId; connectionId?: string; homePath?: string | null } = {
        agentId: this.readAgentId(record.agentId, `assignments[${index}].agentId`),
      };
      const connectionId = this.readOptionalString(record.connectionId, `assignments[${index}].connectionId`);
      if (connectionId?.trim()) {
        assignment.connectionId = connectionId.trim();
      }
      if (record.homePath !== undefined) {
        assignment.homePath = this.readNullableString(record.homePath, `assignments[${index}].homePath`);
      }
      return assignment;
    });
  }

  readNotificationHistoryFilter(value: unknown): DesktopNotificationHistoryFilterInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    const record = this.readRecord(value, "notification history filter");
    const kind = record.kind === undefined ? undefined : this.readNotificationHistoryKind(record.kind);
    const connectionId = record.connectionId === undefined
      ? undefined
      : this.readNullableString(record.connectionId, "notification history filter.connectionId");
    const limit = record.limit === undefined ? undefined : this.readPositiveInteger(record.limit, "notification history filter.limit");
    return {
      ...(kind ? { kind } : {}),
      ...(connectionId !== undefined ? { connectionId } : {}),
      ...(limit !== undefined ? { limit } : {}),
    };
  }

  readRecord(value: unknown, fieldName: string): Record<string, unknown> {
    return this.parseRecord(value, fieldName);
  }

  private parseRecord(input: unknown, fieldName: string): Record<string, unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error(`${fieldName} must be an object`);
    }
    return input as Record<string, unknown>;
  }

  private readAuthMode(value: unknown): AuthMode {
    const authMode = this.readRequiredString(value, "authMode");
    if (!SUPPORTED_AUTH_MODES.includes(authMode as AuthMode)) {
      throw new Error("authMode is not supported");
    }
    return authMode as AuthMode;
  }

  private readPreset(value: unknown): ConnectionPresetFamily {
    const preset = this.readRequiredString(value, "preset");
    if (!SUPPORTED_CONNECTION_PRESET_FAMILIES.includes(preset as ConnectionPresetFamily)) {
      throw new Error("preset is not supported");
    }
    return preset as ConnectionPresetFamily;
  }

  private readOptionalCredentialFields(record: Record<string, unknown>): {
    label?: string;
    endpointUrl?: string;
    enabledAgents?: AgentId[];
    apiKeySource?: "direct" | "env_key";
    apiKey?: string;
    envKey?: string;
    sessionSource?: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor";
    sessionAuthJsonPath?: string;
  } {
    return {
      label: this.readOptionalString(record.label, "label"),
      endpointUrl: this.readOptionalString(record.endpointUrl, "endpointUrl"),
      enabledAgents: this.readOptionalAgentIds(record.enabledAgents, "enabledAgents"),
      apiKeySource: this.readOptionalApiKeySource(record.apiKeySource),
      apiKey: this.readOptionalString(record.apiKey, "apiKey"),
      envKey: this.readOptionalString(record.envKey, "envKey"),
      sessionSource: this.readOptionalSessionSource(record.sessionSource),
      sessionAuthJsonPath: this.readOptionalString(record.sessionAuthJsonPath, "sessionAuthJsonPath"),
    };
  }

  private readOptionalCredentialStorageModeFields(record: Record<string, unknown>): {
    credentialStorageBackend?: CredentialStorageBackend;
    encryptedLocalPassphrase?: string;
  } {
    return {
      credentialStorageBackend: this.readOptionalCredentialStorageBackend(record.credentialStorageBackend),
      encryptedLocalPassphrase: this.readOptionalString(record.encryptedLocalPassphrase, "encryptedLocalPassphrase"),
    };
  }

  private readOptionalCredentialStorageBackend(value: unknown): CredentialStorageBackend | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (
      typeof value !== "string"
      || !SUPPORTED_CREDENTIAL_STORAGE_BACKENDS.includes(value as CredentialStorageBackend)
    ) {
      throw new Error("credentialStorageBackend is not supported");
    }
    return value as CredentialStorageBackend;
  }

  private readOptionalAgentIds(value: unknown, fieldName: string): AgentId[] | undefined {
    if (value === undefined) {
      return undefined;
    }
    return this.readAgentIds(value, fieldName);
  }

  private readOptionalApiKeySource(value: unknown): "direct" | "env_key" | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value !== "direct" && value !== "env_key") {
      throw new Error("apiKeySource is not supported");
    }
    return value;
  }

  private readOptionalSessionSource(
    value: unknown,
  ): "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor" | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (
      value !== "login"
      && value !== "current_codex"
      && value !== "current_claude"
      && value !== "current_gemini"
      && value !== "current_cursor"
    ) {
      throw new Error("sessionSource is not supported");
    }
    return value;
  }

  private readOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName} must be a boolean`);
    }
    return value;
  }

  private readPositiveInteger(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    return value;
  }

  private readPercent(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${fieldName} must be a number`);
    }
    const rounded = Math.round(value);
    if (rounded < 1 || rounded > 100) {
      throw new Error(`${fieldName} must be between 1 and 100`);
    }
    return rounded;
  }

  private readConnectionAlertType(value: unknown): "low-percent" | "renewed" {
    if (value !== "low-percent" && value !== "renewed") {
      throw new Error("type is not supported");
    }
    return value;
  }

  private readNotificationHistoryKind(value: unknown): "all" | "alerts" {
    if (value !== "all" && value !== "alerts") {
      throw new Error("notification history filter kind is not supported");
    }
    return value;
  }
}
