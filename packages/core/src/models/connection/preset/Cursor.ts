import type { ConnectionPresetModule } from "./ModuleTypes";

export const CURSOR_PRESET_MODULE: ConnectionPresetModule<"cursor"> = {
  manifest: {
    id: "cursor",
    label: "Cursor",
    iconKey: "cursor",
    supportedAuthModes: ["cursor_session"],
    requiresEndpointUrl: false,
    configurableAgents: ["cursor"],
    defaultEnabledAgents: ["cursor"],
    suggestEnabledAgents: false,
  },
};
