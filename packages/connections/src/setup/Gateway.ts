import type { ConnectionEndpointModule } from "./Types";
import { GatewayEndpointBuilder } from "./GatewayEndpointBuilder";

export function createGatewayEndpointModule(
  builder: GatewayEndpointBuilder,
): ConnectionEndpointModule {
  return {
    preset: "gateway",
    async build({ input }) {
      return await builder.build({
        endpointUrl: input.endpointUrl,
        credential: input.credential,
        enabledAgents: input.enabledAgents,
        allowUndetectedGateway: input.allowUndetectedGateway === true,
      });
    },
  };
}
