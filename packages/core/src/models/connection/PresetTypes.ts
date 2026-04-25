export const SUPPORTED_CONNECTION_PRESET_FAMILIES = [
  "openai",
  "gateway",
  "azure-openai",
  "anthropic",
] as const;

export type ConnectionPresetFamily = (typeof SUPPORTED_CONNECTION_PRESET_FAMILIES)[number];
