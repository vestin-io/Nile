import type { AgentId } from "./Types";
import type { AuthMode } from "../access";
import type { ConnectionApplyRequirementKind } from "../connection/RequirementKinds";
import type { ConnectionPresetFamily } from "../connection/setup/PresetTypes";
import {
  CONNECTION_SUPPORT_KINDS,
  type ConnectionSupportKind,
} from "../connection/Support";

export type AgentCapability = {
  requiredApplyRequirements: ConnectionApplyRequirementKind[];
  supportsManagedEnvBackedApiKey: boolean;
  supportedConnectionKinds: ConnectionSupportKind[];
  autoSyncMatchedSelection: boolean;
};

type AgentCapabilityProtocols = Parameters<typeof CONNECTION_SUPPORT_KINDS.readDetectedApiKeyKinds>[0];

type AgentSavedConnectionSupportInput = {
  protocols: AgentCapabilityProtocols;
  authMode: AuthMode;
};

type AgentSelectableConnectionInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
};

export class AgentCapabilities {
  private readonly capabilities = new Map<AgentId, AgentCapability>([
    [
      "codex",
      this.createCapability({
        supportsManagedEnvBackedApiKey: true,
        supportedConnectionKinds: ["openai-api-key", "openai-session"],
        autoSyncMatchedSelection: true,
      }),
    ],
    [
      "cursor",
      this.createCapability({
        supportedConnectionKinds: ["cursor-api-key", "cursor-session"],
        autoSyncMatchedSelection: true,
      }),
    ],
    [
      "claude",
      this.createCapability({
        supportsManagedEnvBackedApiKey: true,
        supportedConnectionKinds: ["anthropic-api-key", "claude-session"],
        autoSyncMatchedSelection: true,
      }),
    ],
    [
      "openclaw",
      this.createCapability({
        requiredApplyRequirements: ["selected-model", "env-backed-api-key"],
        supportsManagedEnvBackedApiKey: true,
        supportedConnectionKinds: [
          "openai-api-key",
          "anthropic-api-key",
          "openai-session",
          "claude-session",
        ],
        autoSyncMatchedSelection: false,
      }),
    ],
  ]);

  read(agentId: AgentId): AgentCapability {
    return this.capabilities.get(agentId) ?? this.createCapability();
  }

  listConfiguredAgentIds(): AgentId[] {
    return [...this.capabilities.keys()];
  }

  supportsDetectedProtocols(agentId: AgentId, protocols: AgentCapabilityProtocols): boolean {
    return this.supportsKinds(agentId, CONNECTION_SUPPORT_KINDS.readDetectedApiKeyKinds(protocols));
  }

  supportsSavedConnection(
    agentId: AgentId,
    input: AgentSavedConnectionSupportInput,
  ): boolean {
    return this.supportsKinds(agentId, CONNECTION_SUPPORT_KINDS.readSavedKinds({
      authMode: input.authMode,
      protocols: input.protocols,
    }));
  }

  supportsSelectableConnection(
    agentId: AgentId,
    input: AgentSelectableConnectionInput,
  ): boolean {
    const selectableKinds = CONNECTION_SUPPORT_KINDS.readSelectableKinds({
      preset: input.preset,
      authMode: input.authMode,
    });
    return this.supportsKinds(agentId, selectableKinds);
  }

  private createCapability(
    overrides: Partial<AgentCapability> = {},
  ): AgentCapability {
    return {
      requiredApplyRequirements: [],
      supportsManagedEnvBackedApiKey: false,
      supportedConnectionKinds: [],
      autoSyncMatchedSelection: false,
      ...overrides,
    };
  }

  private supportsKinds(
    agentId: AgentId,
    kinds: ConnectionSupportKind[],
  ): boolean {
    const supportedKinds = this.read(agentId).supportedConnectionKinds;
    return kinds.some((kind) => supportedKinds.includes(kind));
  }
}

export const AGENT_CAPABILITIES = new AgentCapabilities();
