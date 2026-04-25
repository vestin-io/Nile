import type { AgentId } from "@nile/core/models/agent/types";
import codexSvg from "@lobehub/icons-static-svg/icons/codex.svg";
import cursorSvg from "@lobehub/icons-static-svg/icons/cursor.svg";
import claudeCodeSvg from "@lobehub/icons-static-svg/icons/claudecode.svg";
import openClawSvg from "@lobehub/icons-static-svg/icons/openclaw.svg";

export function renderAgentIcon(agentId: AgentId): string {
  if (agentId === "codex") {
    return codexSvg;
  }

  if (agentId === "cursor") {
    return cursorSvg;
  }
  if (agentId === "openclaw") {
    return openClawSvg;
  }

  return claudeCodeSvg;
}

export function agentToneClass(agentId: AgentId): string {
  return `agent-tone-${agentId}`;
}
