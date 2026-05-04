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

export function syncDefaultAuthJsonPath(
  currentPath: string,
  previousDefaultPath: string,
  nextDefaultPath: string,
): string {
  const trimmedCurrentPath = currentPath.trim();
  const trimmedPreviousDefaultPath = previousDefaultPath.trim();
  if (trimmedCurrentPath && trimmedCurrentPath !== trimmedPreviousDefaultPath) {
    return currentPath;
  }

  return nextDefaultPath;
}
