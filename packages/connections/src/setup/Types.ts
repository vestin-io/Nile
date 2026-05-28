import type { AgentId } from "@nile/core/models/agent";
import type { AuthMode } from "@nile/core/models/access";
import type { ConnectionPresetFamily } from "@nile/core/models/connection/preset";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { StoredCredential } from "@nile/core/services/credential/Types";

export type ConnectionEndpointBuildInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
  credential: StoredCredential;
  endpointUrl?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
};

export type ConnectionEndpointBuildContext = {
  input: Omit<ConnectionEndpointBuildInput, "preset">;
};

export type ConnectionEndpointModule = {
  preset: ConnectionPresetFamily;
  build(context: ConnectionEndpointBuildContext): Promise<EndpointRegistryInput>;
};
