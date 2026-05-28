import { CLAUDE_DECLARATION } from "@nile/agent-claude/declaration";
import { CODEX_DECLARATION } from "@nile/agent-codex/declaration";
import { CURSOR_DECLARATION } from "@nile/agent-cursor/declaration";
import { GEMINI_DECLARATION } from "@nile/agent-gemini/declaration";
import { OPENCLAW_DECLARATION } from "@nile/agent-openclaw/declaration";
import { OPENCODE_DECLARATION } from "@nile/agent-opencode/declaration";

import {
  AGENT_DECLARATION_REGISTRY,
  type AgentDeclaration,
} from "@nile/core/models/agent/registry";

export const BUILTIN_AGENT_DECLARATIONS = [
  CODEX_DECLARATION,
  CURSOR_DECLARATION,
  CLAUDE_DECLARATION,
  GEMINI_DECLARATION,
  OPENCLAW_DECLARATION,
  OPENCODE_DECLARATION,
] as const satisfies readonly AgentDeclaration[];

export function registerBuiltinAgentDeclarations(): void {
  AGENT_DECLARATION_REGISTRY.register(BUILTIN_AGENT_DECLARATIONS);
}
