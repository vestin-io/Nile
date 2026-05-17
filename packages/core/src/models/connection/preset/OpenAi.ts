import type { ConnectionPresetModule } from "./ModuleTypes";

export const OPENAI_PRESET_MODULE: ConnectionPresetModule<"openai"> = {
  manifest: {
    id: "openai",
    label: "Official OpenAI",
    iconKey: "openai",
    supportedAuthModes: ["openai_session", "api_key"],
    requiresEndpointUrl: false,
    configurableAgents: ["codex", "openclaw"],
    defaultEnabledAgents: ["codex"],
    suggestEnabledAgents: false,
  },
};
