import { SUPPORTED_AGENT_IDS } from "@nile/core/models/agent";

export const KNOWN_FLAGS = new Set([
  "db-path",
  "home",
  "json",
  "yes",
  "confirm-reset",
  "preset",
  "auth-mode",
  "id",
  "label",
  "endpoint-url",
  "login",
  "api-key",
  "openclaw-model-id",
  "from-codex-current",
  "from-claude-current",
  "from-cursor-current",
  "agents",
  "session-token",
  "workos-session-token",
]);

export function buildCliHelpLines(): string[] {
  return [
    "Usage:",
    "  nile",
    "  nile status [--json] [--db-path <path>] [--home <agent>=<path>]",
    ...SUPPORTED_AGENT_IDS.map((agentId) => `  nile ${agentId} status [--json] [--db-path <path>] [--home ${agentId}=<path>]`),
    "  nile list [--json] [--db-path <path>]",
    "  nile usage <connectionId> [--json] [--db-path <path>]",
    "  nile cursor usage bind <connectionId> --session-token <token> [--json] [--db-path <path>] [--home cursor=<path>]",
    "  nile cursor usage auto-bind <connectionId> [--json] [--db-path <path>] [--home cursor=<path>]",
    "  nile history [--json] [--db-path <path>]",
    "  nile reset [--json] [--db-path <path>]",
    "  nile reset --yes --confirm-reset [--json] [--db-path <path>]",
    "  nile add [--preset <preset>] [--auth-mode <mode>] [--id <id>] [--label <label>] [--endpoint-url <url>] [--login] [--api-key <key>] [--openclaw-model-id <model>] [--from-codex-current] [--from-claude-current] [--from-cursor-current] [--db-path <path>] [--home <agent>=<path>]",
    ...SUPPORTED_AGENT_IDS.map((agentId) => `  nile ${agentId} import [--db-path <path>] [--home ${agentId}=<path>]`),
    ...SUPPORTED_AGENT_IDS.map((agentId) => `  nile ${agentId} use <connectionId> [--db-path <path>] [--home ${agentId}=<path>]`),
    "  nile remove <connectionId> [--db-path <path>]",
    ...SUPPORTED_AGENT_IDS.map((agentId) => `  nile ${agentId} rollback [--db-path <path>] [--home ${agentId}=<path>]`),
  ];
}

export function buildAgentCommandExamples(command: "import" | "rollback"): string {
  const examples = SUPPORTED_AGENT_IDS.map((agentId) => `\`nile ${agentId} ${command}\``);
  if (examples.length <= 1) {
    return examples[0] ?? "";
  }

  return `${examples.slice(0, -1).join(", ")}, or ${examples.at(-1)}`;
}
