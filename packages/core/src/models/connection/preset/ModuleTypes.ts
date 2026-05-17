import type { AgentId } from "../../agent";
import type { EndpointProtocols } from "../../endpoint";
import type { ConnectionPresetManifest } from "./ManifestTypes";

export type ConnectionPresetOnboardingConfig = {
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
};

export type ConnectionPresetModule<Id extends string = string> = {
  manifest: ConnectionPresetManifest<Id>;
  resolveOnboardingConfig?: (protocols?: EndpointProtocols) => ConnectionPresetOnboardingConfig | null;
};
