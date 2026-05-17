import type { AgentId } from "../../agent";
import type { AuthMode } from "../../access";

export type ConnectionPresetManifest<Id extends string = string> = {
  id: Id;
  label: string;
  iconKey: string;
  supportedAuthModes: AuthMode[];
  requiresEndpointUrl: boolean;
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
  suggestEnabledAgents: boolean;
};
