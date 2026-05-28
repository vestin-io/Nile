import { AGENT_CAPABILITIES } from "@nile/core/models/agent/capabilities";
import type { AgentId } from "@nile/core/models/agent/definitions";
import codexSvg from "@lobehub/icons-static-svg/icons/codex-color.svg";
import cursorSvg from "@lobehub/icons-static-svg/icons/cursor.svg";
import claudeCodeSvg from "@lobehub/icons-static-svg/icons/claudecode-color.svg";
import geminiCliSvg from "@lobehub/icons-static-svg/icons/geminicli-color.svg";
import openClawSvg from "@lobehub/icons-static-svg/icons/openclaw-color.svg";
import openCodeSvg from "@lobehub/icons-static-svg/icons/opencode.svg";

const cursorColorSvg = cursorSvg.replaceAll("currentColor", "#3478F6");
const AGENT_ICON_SVGS = {
  claude: claudeCodeSvg,
  codex: codexSvg,
  cursor: cursorColorSvg,
  gemini: geminiCliSvg,
  openclaw: openClawSvg,
  opencode: openCodeSvg,
} as const;

export function renderAgentIcon(agentId: AgentId, instanceId?: string): string {
  const icon = readAgentIconSvg(agentId);
  if (!instanceId) {
    return icon;
  }
  return namespaceSvgIds(icon, instanceId);
}

function readAgentIconSvg(agentId: AgentId): string {
  const iconKey = AGENT_CAPABILITIES.read(agentId).iconKey;
  return AGENT_ICON_SVGS[iconKey as keyof typeof AGENT_ICON_SVGS] ?? claudeCodeSvg;
}

function namespaceSvgIds(svg: string, instanceId: string): string {
  const ids = Array.from(svg.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  if (ids.length === 0) {
    return svg;
  }

  let next = svg;
  for (const id of ids) {
    const namespaced = `${id}-${instanceId}`;
    next = next.replaceAll(`id="${id}"`, `id="${namespaced}"`);
    next = next.replaceAll(`url(#${id})`, `url(#${namespaced})`);
    next = next.replaceAll(`href="#${id}"`, `href="#${namespaced}"`);
    next = next.replaceAll(`xlink:href="#${id}"`, `xlink:href="#${namespaced}"`);
  }
  return next;
}
