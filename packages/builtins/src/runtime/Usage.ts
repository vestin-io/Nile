import {
  ClaudeSessionConnectionUsageReader,
  CONNECTION_USAGE_READER_REGISTRY,
  GeminiSessionConnectionUsageReader,
  OpenAiSessionConnectionUsageReader,
} from "@nile/core/actions/usage";

export const BUILTIN_CONNECTION_USAGE_READERS = [
  new OpenAiSessionConnectionUsageReader("openai_session"),
  new OpenAiSessionConnectionUsageReader("openclaw_openai_session"),
  new ClaudeSessionConnectionUsageReader(),
  new GeminiSessionConnectionUsageReader(),
] as const;

export function registerBuiltinConnectionUsageReaders(): void {
  CONNECTION_USAGE_READER_REGISTRY.register(BUILTIN_CONNECTION_USAGE_READERS);
}
