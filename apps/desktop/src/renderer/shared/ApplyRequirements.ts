import {
  CONNECTION_APPLY_REQUIREMENTS,
  type ConnectionApplyRequirementKind,
  type ConnectionApplyRequirements,
} from "@nile/core/models/connection/requirements";
import type { AgentId } from "@nile/core/models/agent";

import type { DesktopConnection } from "../../state/Types";

export function readConnectionApplyRequirements(
  agentId: AgentId,
  connection: DesktopConnection,
  selectedModelId: string | null,
) : ConnectionApplyRequirements {
  if (connection.authMode === "unknown") {
    return {
      canApply: false,
      requirements: [],
    };
  }

  return CONNECTION_APPLY_REQUIREMENTS.read({
    agentId,
    authMode: connection.authMode,
    envKey: connection.envKey ?? null,
    selectedModelId,
  });
}

export function hasConnectionApplyRequirement(
  requirements: ConnectionApplyRequirements | null | undefined,
  kind: ConnectionApplyRequirementKind,
): boolean {
  return requirements?.requirements.some((requirement) => requirement.kind === kind) ?? false;
}
