import type { AgentId } from "@nile/core/models/agent/definitions";

export const STATUS_ENTRY_DISPLAY_MODES = ["app_entry", "summary"] as const;
export const LEGACY_STATUS_ENTRY_DISPLAY_MODES = ["app_entry", "ticker"] as const;

export type DesktopStatusEntryDisplayMode = (typeof STATUS_ENTRY_DISPLAY_MODES)[number];
export type LegacyDesktopStatusEntryDisplayMode = (typeof LEGACY_STATUS_ENTRY_DISPLAY_MODES)[number];
export type DesktopStatusEntryDisplayState = {
  hasConfiguredSelectedAgents: boolean;
  mode: DesktopStatusEntryDisplayMode;
  selectedAgentIds: AgentId[];
};

export function parseLegacyStatusEntryDisplayMode(value: string | null | undefined): DesktopStatusEntryDisplayMode {
  return value === "ticker" ? "summary" : "app_entry";
}

export function serializeLegacyStatusEntryDisplayMode(
  mode: DesktopStatusEntryDisplayMode,
): LegacyDesktopStatusEntryDisplayMode {
  return mode === "summary" ? "ticker" : "app_entry";
}
