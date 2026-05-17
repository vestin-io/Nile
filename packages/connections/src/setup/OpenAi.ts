import type { ConnectionEndpointModule } from "./Types";
import { OpenAiEndpointBuilder } from "./OpenAiEndpointBuilder";

export function createOpenAiEndpointModules(
  builder: OpenAiEndpointBuilder = new OpenAiEndpointBuilder(),
): readonly ConnectionEndpointModule[] {
  return [
    {
      preset: "openai",
      async build() {
        return builder.buildOfficial();
      },
    },
    {
      preset: "azure-openai",
      async build({ input }) {
        return builder.buildCompatible("azure-openai", input.endpointUrl, "azure-openai");
      },
    },
  ] as const;
}
