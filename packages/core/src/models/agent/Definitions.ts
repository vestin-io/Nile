import {
  listAgentDeclarations,
  readAgentDeclaration,
  formatAgentDeclarationLabel,
} from "./registry";
import { SUPPORTED_AGENT_IDS, type AgentId, isAgentId } from "./Ids";

export { SUPPORTED_AGENT_IDS, isAgentId };
export type { AgentId };

export function formatAgentLabel(agentId: string): string {
  return formatAgentDeclarationLabel(agentId);
}

export function listAgentDefinitions() {
  return listAgentDeclarations().map((declaration) => ({
    id: declaration.id,
    label: declaration.label,
  }));
}

export function readAgentDefinition(agentId: AgentId) {
  const declaration = readAgentDeclaration(agentId);
  return {
    id: declaration.id,
    label: declaration.label,
    iconKey: declaration.iconKey,
  };
}
