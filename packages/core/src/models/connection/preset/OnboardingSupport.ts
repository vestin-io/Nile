import type { EndpointProtocols } from "../../endpoint";
import type { ConnectionPresetFamily } from "./Types";
import { CONNECTION_PRESET_REGISTRY } from "./Registry";
import type { ConnectionPresetOnboardingConfig } from "./ModuleTypes";

export class ConnectionPresetOnboardingSupport {
  readConfig(
    preset: ConnectionPresetFamily,
    protocols?: EndpointProtocols,
  ): ConnectionPresetOnboardingConfig {
    const module = CONNECTION_PRESET_REGISTRY.readModule(preset);
    const resolved = module.resolveOnboardingConfig?.(protocols);
    if (resolved) {
      return resolved;
    }

    return {
      configurableAgents: [...module.manifest.configurableAgents],
      defaultEnabledAgents: [...module.manifest.defaultEnabledAgents],
    };
  }
}

export const CONNECTION_PRESET_ONBOARDING_SUPPORT = new ConnectionPresetOnboardingSupport();
