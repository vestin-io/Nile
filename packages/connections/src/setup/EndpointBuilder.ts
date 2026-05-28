import type { StoredCredential } from "@nile/core/services/credential/Types";
import type { AuthMode } from "@nile/core/models/access";
import type { AgentId } from "@nile/core/models/agent";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { GatewayCapabilityProbe } from "@nile/core/models/connection";
import type { ConnectionPresetFamily } from "@nile/core/models/connection/preset";

import { createConnectionEndpointModules } from "./Modules";
import { GatewayProbe } from "./GatewayProbe";
import { GatewayEndpointBuilder } from "./GatewayEndpointBuilder";
import { OpenAiEndpointBuilder } from "./OpenAiEndpointBuilder";
import { AnthropicEndpointBuilder } from "./AnthropicEndpointBuilder";
import type { ConnectionEndpointModule } from "./Types";

export class ConnectionEndpointBuilder {
  private readonly modules: readonly ConnectionEndpointModule[];

  constructor(gatewayProbe: GatewayCapabilityProbe = new GatewayProbe()) {
    this.modules = createConnectionEndpointModules({
      gatewayBuilder: new GatewayEndpointBuilder(gatewayProbe),
      openAiBuilder: new OpenAiEndpointBuilder(),
      anthropicBuilder: new AnthropicEndpointBuilder(),
    });
  }

  async build(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    credential: StoredCredential;
    endpointUrl?: string;
    enabledAgents?: AgentId[];
    allowUndetectedGateway?: boolean;
  }): Promise<EndpointRegistryInput> {
    const module = this.modules.find((candidate) => candidate.preset === input.preset);
    if (!module) {
      throw new Error(`Unsupported connection preset: ${String(input.preset)}`);
    }
    return await module.build({ input });
  }
}
