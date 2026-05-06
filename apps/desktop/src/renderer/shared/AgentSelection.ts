import { formatAgentLabel as readAgentLabel, type AgentId } from "@nile/core/models/agent/types";
import type { Translator } from "./I18n";

export function formatAgentLabel(agentId: string): string {
  return readAgentLabel(agentId as AgentId);
}

export function formatAgentsList(agentIds: string[], t: Translator): string {
  if (agentIds.length === 0) {
    return t("common.none");
  }

  return agentIds.map(formatAgentLabel).join(", ");
}

export function sameAgentSelection(
  left: AgentId[],
  right: AgentId[],
): boolean {
  return left.length === right.length && left.every((agentId, index) => agentId === right[index]);
}
