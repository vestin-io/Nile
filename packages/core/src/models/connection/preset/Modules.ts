import { ANTHROPIC_PRESET_MODULE } from "./Anthropic";
import { AZURE_OPENAI_PRESET_MODULE } from "./AzureOpenAi";
import { CURSOR_PRESET_MODULE } from "./Cursor";
import { GATEWAY_PRESET_MODULE } from "./Gateway";
import { GEMINI_PRESET_MODULE } from "./Gemini";
import { OPENAI_PRESET_MODULE } from "./OpenAi";
import type { ConnectionPresetModule } from "./ModuleTypes";

export const CONNECTION_PRESET_MODULES = [
  OPENAI_PRESET_MODULE,
  GATEWAY_PRESET_MODULE,
  CURSOR_PRESET_MODULE,
  AZURE_OPENAI_PRESET_MODULE,
  ANTHROPIC_PRESET_MODULE,
  GEMINI_PRESET_MODULE,
] as const satisfies readonly ConnectionPresetModule[];
