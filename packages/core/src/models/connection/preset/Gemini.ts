import type { ConnectionPresetModule } from "./ModuleTypes";

export const GEMINI_PRESET_MODULE: ConnectionPresetModule<"gemini"> = {
  manifest: {
    id: "gemini",
    label: "Gemini CLI",
    iconKey: "gemini",
    supportedAuthModes: ["gemini_cli_session"],
    requiresEndpointUrl: false,
    configurableAgents: ["gemini"],
    defaultEnabledAgents: ["gemini"],
    suggestEnabledAgents: false,
  },
};
