import {
  readAgentDeclaration,
  type AgentDeclaration,
} from "./Declarations";
import { SUPPORTED_AGENT_IDS, type AgentId } from "../Ids";
import type { AgentConnectionEntryMode } from "./Types";
import type { AuthMode } from "../../access";
import type { ConnectionApplyRequirementKind } from "../../connection/RequirementKinds";
import {
  CONNECTION_SUPPORT_KINDS,
  type ConnectionPresetFamily,
  type ConnectionSupportKind,
} from "../../connection/Support";

export type AgentCapability = {
  iconKey: AgentDeclaration["iconKey"];
  requiredApplyRequirements: ConnectionApplyRequirementKind[];
  supportsManagedEnvBackedApiKey: boolean;
  requiresManagedApiKeyShellEnvironment: boolean;
  supportedConnectionFamilyIds: ConnectionSupportKind[];
  autoSyncMatchedSelection: boolean;
  connectionEntryMode: AgentConnectionEntryMode;
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
  read(agentId: AgentId): AgentCapability {
    const manifest = readAgentDeclaration(agentId);
    return {
      iconKey: manifest.iconKey,
      requiredApplyRequirements: [...manifest.requiredApplyRequirements],
      supportsManagedEnvBackedApiKey: manifest.supportsManagedEnvBackedApiKey,
      requiresManagedApiKeyShellEnvironment: manifest.requiresManagedApiKeyShellEnvironment,
      supportedConnectionFamilyIds: [...manifest.supportedConnectionFamilyIds],
      autoSyncMatchedSelection: manifest.autoSyncMatchedSelection,
      connectionEntryMode: manifest.connectionEntryMode,
    };
  }

  listConfiguredAgentIds(): AgentId[] {
    return [...SUPPORTED_AGENT_IDS];
  }

  supportsDetectedProtocols(
    agentId: AgentId,
    protocols: AgentCapabilityProtocols,
  ): boolean {
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

  private supportsKinds(
    agentId: AgentId,
    familyIds: ConnectionSupportKind[],
  ): boolean {
    const supportedFamilyIds = this.read(agentId).supportedConnectionFamilyIds;
    return familyIds.some((familyId) => supportedFamilyIds.includes(familyId));
  }
}

export const AGENT_CAPABILITIES = new AgentCapabilities();
