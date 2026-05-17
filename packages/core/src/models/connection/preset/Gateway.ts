import { AGENT_CAPABILITIES } from "../../agent/registry/Capabilities";
import { SUPPORTED_AGENT_IDS } from "../../agent/Ids";
import type { ConnectionPresetModule } from "./ModuleTypes";

export const GATEWAY_PRESET_MODULE: ConnectionPresetModule<"gateway"> = {
  manifest: {
    id: "gateway",
    label: "Gateway",
    iconKey: "gateway",
    supportedAuthModes: ["api_key"],
    requiresEndpointUrl: true,
    configurableAgents: [...SUPPORTED_AGENT_IDS],
    defaultEnabledAgents: ["codex", "claude"],
    suggestEnabledAgents: true,
  },
  resolveOnboardingConfig: (protocols) => {
    if (!protocols) {
      return null;
    }
    const detectedAgents = SUPPORTED_AGENT_IDS.filter((agentId) =>
      AGENT_CAPABILITIES.supportsDetectedProtocols(agentId, protocols));
    if (detectedAgents.length === 0) {
      return null;
    }

    const uniqueAgents = [...new Set(detectedAgents)];
    return {
      configurableAgents: uniqueAgents,
      defaultEnabledAgents: uniqueAgents,
    };
  },
};
