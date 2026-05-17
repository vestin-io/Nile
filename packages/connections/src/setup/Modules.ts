import { type ConnectionPresetFamily, CONNECTION_PRESET_MODULES } from "@nile/core/models/connection/preset";
import { IndexedRegistry } from "@nile/core/services/IndexedRegistry";
import { AnthropicEndpointBuilder } from "./AnthropicEndpointBuilder";
import { createAnthropicEndpointModule } from "./Anthropic";
import { createCursorEndpointModule } from "./Cursor";
import { createGeminiEndpointModule } from "./Gemini";
import { GatewayEndpointBuilder } from "./GatewayEndpointBuilder";
import { createGatewayEndpointModule } from "./Gateway";
import { OpenAiEndpointBuilder } from "./OpenAiEndpointBuilder";
import { createOpenAiEndpointModules } from "./OpenAi";
import type { ConnectionEndpointModule } from "./Types";

export function createConnectionEndpointModules(input: {
  gatewayBuilder: GatewayEndpointBuilder;
  openAiBuilder?: OpenAiEndpointBuilder;
  anthropicBuilder?: AnthropicEndpointBuilder;
}): readonly ConnectionEndpointModule[] {
  const implementedModules = [
    ...createOpenAiEndpointModules(input.openAiBuilder),
    createGatewayEndpointModule(input.gatewayBuilder),
    createCursorEndpointModule(),
    createAnthropicEndpointModule(input.anthropicBuilder),
    createGeminiEndpointModule(),
  ] as const satisfies readonly ConnectionEndpointModule[];
  const registry = new IndexedRegistry<ConnectionPresetFamily, ConnectionEndpointModule>(
    implementedModules,
    (module) => module.preset,
    (preset) => `Missing connection endpoint module for preset: ${preset}`,
  );

  return CONNECTION_PRESET_MODULES.map((module) => registry.read(module.manifest.id));
}
