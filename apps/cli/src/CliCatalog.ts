import { SUPPORTED_AGENT_IDS } from "@nile/core/models/agent";

export const BASE_KNOWN_FLAGS = [
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
  "model-id",
  "from-codex-current",
  "from-claude-current",
  "from-cursor-current",
  "from-gemini-current",
  "agents",
];

export function buildCliHelpLines(agentExtensionHelpLines: string[] = []): string[] {
  return [
    "Usage:",
    "  nile",
    "  nile status [--json] [--db-path <path>] [--home <agent>=<path>]",
    ...SUPPORTED_AGENT_IDS.map((agentId) => `  nile ${agentId} status [--json] [--db-path <path>] [--home ${agentId}=<path>]`),
    "  nile list [--json] [--db-path <path>]",
    "  nile usage <connectionId> [--json] [--db-path <path>]",
    ...agentExtensionHelpLines,
    "  nile history [--json] [--db-path <path>]",
    "  nile reset [--json] [--db-path <path>]",
    "  nile reset --yes --confirm-reset [--json] [--db-path <path>]",
    "  nile add [--preset <preset>] [--auth-mode <mode>] [--id <id>] [--label <label>] [--endpoint-url <url>] [--login] [--api-key <key>] [--model-id <model>] [--from-codex-current] [--from-claude-current] [--from-cursor-current] [--from-gemini-current] [--db-path <path>] [--home <agent>=<path>]",
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
