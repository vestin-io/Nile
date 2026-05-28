import type { ConnectionPresetModule } from "./ModuleTypes";

export const AZURE_OPENAI_PRESET_MODULE: ConnectionPresetModule<"azure-openai"> = {
  manifest: {
    id: "azure-openai",
    label: "Azure OpenAI",
    iconKey: "azure-openai",
    supportedAuthModes: ["api_key"],
    requiresEndpointUrl: true,
    configurableAgents: ["codex", "openclaw", "opencode"],
    defaultEnabledAgents: ["codex"],
    suggestEnabledAgents: false,
  },
};
