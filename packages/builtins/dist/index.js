import {
  registerBuiltinAgentDeclarations
} from "./chunk-V44RJOZR.js";

// src/index.ts
import { CLAUDE_AGENT_MODULE } from "@nile/agent-claude/module";
import { CODEX_AGENT_MODULE } from "@nile/agent-codex/module";
import { CURSOR_AGENT_MODULE } from "@nile/agent-cursor/module";
import { GEMINI_AGENT_MODULE } from "@nile/agent-gemini/module";
import { OPENCLAW_AGENT_MODULE } from "@nile/agent-openclaw/module";
import { OPENCODE_AGENT_MODULE } from "@nile/agent-opencode/module";
import { ANTHROPIC_API_KEY_MODULE } from "@nile/connections/anthropic-api-key/module";
import { CLAUDE_SESSION_MODULE } from "@nile/connections/claude-session/module";
import { CURSOR_API_KEY_MODULE } from "@nile/connections/cursor-api-key/module";
import { CURSOR_SESSION_MODULE } from "@nile/connections/cursor-session/module";
import { GEMINI_CLI_SESSION_MODULE } from "@nile/connections/gemini-cli-session/module";
import { OPENCLAW_OPENAI_SESSION_MODULE } from "@nile/connections/openclaw-openai-session/module";
import { OPENAI_API_KEY_MODULE } from "@nile/connections/openai-api-key/module";
import { OPENAI_SESSION_MODULE } from "@nile/connections/openai-session/module";
import { AGENT_MODULE_REGISTRY } from "@nile/core/models/agent/module";
import { CONNECTION_FAMILY_REGISTRY } from "@nile/core/models/connection/family";
import { CONNECTION_RUNTIME_REGISTRY } from "@nile/core/models/connection";

// src/runtime/Usage.ts
import {
  ClaudeSessionConnectionUsageReader,
  CONNECTION_USAGE_READER_REGISTRY,
  GeminiSessionConnectionUsageReader,
  OpenAiSessionConnectionUsageReader
} from "@nile/core/actions/usage";
var BUILTIN_CONNECTION_USAGE_READERS = [
  new OpenAiSessionConnectionUsageReader("openai_session"),
  new OpenAiSessionConnectionUsageReader("openclaw_openai_session"),
  new ClaudeSessionConnectionUsageReader(),
  new GeminiSessionConnectionUsageReader()
];
function registerBuiltinConnectionUsageReaders() {
  CONNECTION_USAGE_READER_REGISTRY.register(BUILTIN_CONNECTION_USAGE_READERS);
}

// src/index.ts
import { ConnectionModelCatalog } from "@nile/connections/catalog";
import { ConnectionCreator, ConnectionUpdater } from "@nile/connections/mutations";
import { GatewayProbe } from "@nile/connections/setup";
import { ConnectionIdentityKeyResolver } from "@nile/connections/support";
var BUILTIN_CONNECTION_RUNTIME_SERVICES = {
  createCreator(input) {
    return new ConnectionCreator(input.endpointRegistry, input.accessRegistry);
  },
  createUpdater(input) {
    return new ConnectionUpdater(
      input.database,
      input.endpointRegistry,
      input.accessRegistry,
      input.agentSelection
    );
  },
  createModelCatalog(input) {
    return new ConnectionModelCatalog(
      input.endpointRegistry,
      input.accessRegistry,
      input.environment,
      input.localModelCatalogSources
    );
  },
  createGatewayProbe() {
    return new GatewayProbe();
  },
  createIdentityResolver() {
    return new ConnectionIdentityKeyResolver();
  }
};
function registerBuiltins() {
  registerBuiltinAgentDeclarations();
  AGENT_MODULE_REGISTRY.register([
    CODEX_AGENT_MODULE,
    CURSOR_AGENT_MODULE,
    CLAUDE_AGENT_MODULE,
    GEMINI_AGENT_MODULE,
    OPENCLAW_AGENT_MODULE,
    OPENCODE_AGENT_MODULE
  ]);
  CONNECTION_FAMILY_REGISTRY.register([
    OPENAI_API_KEY_MODULE,
    ANTHROPIC_API_KEY_MODULE,
    CURSOR_API_KEY_MODULE,
    OPENAI_SESSION_MODULE,
    OPENCLAW_OPENAI_SESSION_MODULE,
    CLAUDE_SESSION_MODULE,
    CURSOR_SESSION_MODULE,
    GEMINI_CLI_SESSION_MODULE
  ]);
  CONNECTION_RUNTIME_REGISTRY.register(BUILTIN_CONNECTION_RUNTIME_SERVICES);
  registerBuiltinConnectionUsageReaders();
}
export {
  registerBuiltins
};
