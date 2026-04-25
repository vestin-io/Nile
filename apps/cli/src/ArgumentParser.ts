import { defaultAgentHomes, isAgentId, mergeAgentHomes, type AgentId } from "@nile/core/models/agent";

import type { CliOptions, ParsedArguments, ResolvedCliOptions } from "./types";

export class ArgumentParser {
  constructor(private readonly defaults: CliOptions) {}

  parse(argv: string[]): ParsedArguments {
    const command: string[] = [];
    const flags = new Map<string, string | boolean>();
    const options: ResolvedCliOptions = {
      databasePath: this.defaults.databasePath,
      agentHomes: mergeAgentHomes(defaultAgentHomes(), this.defaults.agentHomes),
      environment: this.defaults.environment,
      secureSnapshotStore: this.defaults.secureSnapshotStore,
    };

    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === "--db-path") {
        const value = this.requireFlagValue(token, argv[index + 1]);
        options.databasePath = value;
        index += 1;
        continue;
      }
      if (token === "--home") {
        const value = this.requireFlagValue(token, argv[index + 1]);
        const [agentId, homePath] = this.parseAgentHomeAssignment(value);
        options.agentHomes = mergeAgentHomes(options.agentHomes, { [agentId]: homePath });
        index += 1;
        continue;
      }
      if (token.startsWith("--")) {
        const name = token.slice(2);
        const next = argv[index + 1];
        if (next && !next.startsWith("--")) {
          flags.set(name, next);
          index += 1;
          continue;
        }
        flags.set(name, true);
        continue;
      }
      command.push(token);
    }

    return { command, options, flags };
  }

  helpText(): string {
    return [
      "Usage:",
      "  nile",
      "  nile status [--json] [--db-path <path>] [--home <agent>=<path>]",
      "  nile openclaw status [--json] [--db-path <path>] [--home openclaw=<path>]",
      "  nile cursor status [--json] [--db-path <path>] [--home cursor=<path>]",
      "  nile claude status [--json] [--db-path <path>] [--home claude=<path>]",
      "  nile list [--json] [--db-path <path>]",
      "  nile usage <connectionId> [--json] [--db-path <path>]",
      "  nile cursor usage bind <connectionId> --session-token <token> [--json] [--db-path <path>] [--home cursor=<path>]",
      "  nile cursor usage auto-bind <connectionId> [--json] [--db-path <path>] [--home cursor=<path>]",
      "  nile history [--json] [--db-path <path>]",
      "  nile reset [--json] [--db-path <path>]",
      "  nile reset --yes --confirm-reset [--json] [--db-path <path>]",
      "  nile add [--preset <preset>] [--auth-mode <mode>] [--id <id>] [--label <label>] [--endpoint-url <url>] [--login] [--api-key <key>] [--openclaw-model-id <model>] [--from-codex-current] [--from-claude-current] [--from-cursor-current] [--db-path <path>] [--home <agent>=<path>]",
      "  nile cursor import [--db-path <path>] [--home cursor=<path>]",
      "  nile codex import [--db-path <path>] [--home codex=<path>]",
      "  nile claude import [--db-path <path>] [--home claude=<path>]",
      "  nile openclaw import [--db-path <path>] [--home openclaw=<path>]",
      "  nile codex use <connectionId> [--db-path <path>] [--home codex=<path>]",
      "  nile cursor use <connectionId> [--db-path <path>] [--home cursor=<path>]",
      "  nile claude use <connectionId> [--db-path <path>] [--home claude=<path>]",
      "  nile openclaw use <connectionId> [--db-path <path>] [--home openclaw=<path>]",
      "  nile remove <connectionId> [--db-path <path>]",
      "  nile cursor rollback [--db-path <path>] [--home cursor=<path>]",
      "  nile codex rollback [--db-path <path>] [--home codex=<path>]",
      "  nile claude rollback [--db-path <path>] [--home claude=<path>]",
      "  nile openclaw rollback [--db-path <path>] [--home openclaw=<path>]",
    ].join("\n");
  }

  private requireFlagValue(flag: string, value: string | undefined): string {
    if (!value) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  }

  private parseAgentHomeAssignment(value: string): [AgentId, string] {
    const separatorIndex = value.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      throw new Error("--home requires <agent>=<path>");
    }

    const agentId = value.slice(0, separatorIndex).trim();
    const homePath = value.slice(separatorIndex + 1).trim();
    if (!isAgentId(agentId)) {
      throw new Error(`Unsupported agent for --home: ${agentId}`);
    }

    return [agentId, homePath];
  }
}
