import type { ConnectionPresetModule } from "./ModuleTypes";

export const ANTHROPIC_PRESET_MODULE: ConnectionPresetModule<"anthropic"> = {
  manifest: {
    id: "anthropic",
    label: "Official Claude",
    iconKey: "anthropic",
    supportedAuthModes: ["api_key", "claude_session"],
    requiresEndpointUrl: false,
    configurableAgents: ["claude", "openclaw"],
    defaultEnabledAgents: ["claude"],
    suggestEnabledAgents: false,
  },
};
