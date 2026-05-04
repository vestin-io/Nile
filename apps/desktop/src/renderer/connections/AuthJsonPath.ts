import type { DesktopAdvancedState } from "../../DesktopTypes";

export function readCodexAuthJsonPath(
  agentHomes: DesktopAdvancedState["agentHomes"] | undefined,
): string {
  const codexHome = agentHomes?.find((entry) => entry.agentId === "codex")?.path?.trim();
  if (!codexHome) {
    return "~/.codex/auth.json";
  }

  return `${codexHome.replace(/\/+$/, "")}/auth.json`;
}
