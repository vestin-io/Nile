import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import {
  CONNECTION_PRESET_ONBOARDING_SUPPORT,
  CONNECTION_PRESET_REGISTRY,
} from "@nile/core/models/connection/preset";
import type { ConnectionPresetFamily } from "@nile/core/models/connection/preset";
import type { ConnectionOnboardingSuggestion } from "./Types";

export type { ConnectionOnboardingSuggestion } from "./Types";

export class ConnectionOnboardingPolicy {
  suggest(
    preset: ConnectionPresetFamily,
    endpointCandidate: EndpointRegistryInput,
  ): ConnectionOnboardingSuggestion {
    CONNECTION_PRESET_REGISTRY.readRequired(preset);
    return CONNECTION_PRESET_ONBOARDING_SUPPORT.readConfig(preset, endpointCandidate.protocols);
  }
}
