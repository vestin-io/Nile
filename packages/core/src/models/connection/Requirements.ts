import { AGENT_CAPABILITIES } from "../agent/Capabilities";
import type { AgentId } from "../agent/Types";
import type { AuthMode } from "../access";
import type { ConnectionApplyRequirementKind } from "./RequirementKinds";

export type { ConnectionApplyRequirementKind } from "./RequirementKinds";

export type ConnectionApplyRequirement = {
  kind: ConnectionApplyRequirementKind;
};

export type ConnectionApplyRequirements = {
  canApply: boolean;
  requirements: ConnectionApplyRequirement[];
};

type ReadConnectionApplyRequirementsInput = {
  agentId: AgentId;
  authMode: AuthMode;
  envKey?: string | null;
  selectedModelId?: string | null;
};

class CapabilityDrivenConnectionApplyPolicy {
  read(input: ReadConnectionApplyRequirementsInput): ConnectionApplyRequirement[] {
    const requirements: ConnectionApplyRequirement[] = [];
    const capability = AGENT_CAPABILITIES.read(input.agentId);
    if (capability.requiredApplyRequirements.includes("selected-model") && !(input.selectedModelId?.trim())) {
      requirements.push({ kind: "selected-model" });
    }
    if (
      capability.requiredApplyRequirements.includes("env-backed-api-key")
      && input.authMode === "api_key"
      && !(input.envKey?.trim())
    ) {
      requirements.push({ kind: "env-backed-api-key" });
    }
    return requirements;
  }
}

export class ConnectionApplyRequirementsReader {
  private readonly policy = new CapabilityDrivenConnectionApplyPolicy();

  read(input: ReadConnectionApplyRequirementsInput): ConnectionApplyRequirements {
    const requirements = this.policy.read(input);
    return {
      canApply: requirements.length === 0,
      requirements,
    };
  }
}

export const CONNECTION_APPLY_REQUIREMENTS = new ConnectionApplyRequirementsReader();
