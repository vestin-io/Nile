import type { ConnectionEndpointModule } from "./Types";
import { AnthropicEndpointBuilder } from "./AnthropicEndpointBuilder";

export function createAnthropicEndpointModule(
  builder: AnthropicEndpointBuilder = new AnthropicEndpointBuilder(),
): ConnectionEndpointModule {
  return {
    preset: "anthropic",
    async build({ input }) {
      return builder.build(input.endpointUrl, input.authMode);
    },
  };
}
