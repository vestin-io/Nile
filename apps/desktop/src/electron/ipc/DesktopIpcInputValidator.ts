import { isAgentId, type AgentId } from "@nile/core/models/agent";
import { SUPPORTED_AUTH_MODES, type AuthMode } from "@nile/core/models/access";
import {
  SUPPORTED_CONNECTION_PRESET_FAMILIES,
  type ConnectionPresetFamily,
} from "@nile/core/models/connection";

import type {
  DesktopAddConnectionInput,
  DesktopDescribeSavedConnectionOnboardingInput,
  DesktopDiscardPreparedConnectionDraftInput,
  DesktopSavePreparedConnectionInput,
  DesktopUpdateConnectionInput,
} from "../types";

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

  readAddConnectionInput(input: unknown): DesktopAddConnectionInput {
    const record = this.readRecord(input, "add connection input");
    return {
      preset: this.readPreset(record.preset),
      authMode: this.readAuthMode(record.authMode),
      ...this.readOptionalConnectionFields(record),
      allowUndetectedGateway: this.readOptionalBoolean(record.allowUndetectedGateway, "allowUndetectedGateway"),
    };
  }

  readUpdateConnectionInput(input: unknown): DesktopUpdateConnectionInput {
    const record = this.readRecord(input, "update connection input");
    return {
      connectionId: this.readRequiredString(record.connectionId, "connectionId"),
      ...this.readOptionalConnectionFields(record),
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

  private readRecord(input: unknown, fieldName: string): Record<string, unknown> {
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

  private readOptionalConnectionFields(record: Record<string, unknown>): Omit<
    DesktopAddConnectionInput,
    "preset" | "authMode" | "allowUndetectedGateway"
  > {
    return {
      label: this.readOptionalString(record.label, "label"),
      endpointUrl: this.readOptionalString(record.endpointUrl, "endpointUrl"),
      enabledAgents: this.readOptionalAgentIds(record.enabledAgents, "enabledAgents"),
      apiKeySource: this.readOptionalApiKeySource(record.apiKeySource),
      apiKey: this.readOptionalString(record.apiKey, "apiKey"),
      envKey: this.readOptionalString(record.envKey, "envKey"),
      openAiSessionSource: this.readOptionalOpenAiSessionSource(record.openAiSessionSource),
      openAiAuthJsonPath: this.readOptionalString(record.openAiAuthJsonPath, "openAiAuthJsonPath"),
      claudeSessionSource: this.readOptionalClaudeSessionSource(record.claudeSessionSource),
    };
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

  private readOptionalOpenAiSessionSource(value: unknown): "login" | "current_codex" | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value !== "login" && value !== "current_codex") {
      throw new Error("openAiSessionSource is not supported");
    }
    return value;
  }

  private readOptionalClaudeSessionSource(value: unknown): "login" | "current_claude" | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value !== "login" && value !== "current_claude") {
      throw new Error("claudeSessionSource is not supported");
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
}
