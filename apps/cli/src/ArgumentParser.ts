import { defaultAgentHomes, isAgentId, mergeAgentHomes, type AgentId } from "@nile/core/models/agent";

import { BASE_KNOWN_FLAGS, buildCliHelpLines } from "./CliCatalog";
import type { CliOptions, ParsedArguments, ResolvedCliOptions } from "./types";

export class ArgumentParser {
  private readonly knownFlags: Set<string>;

  constructor(
    private readonly defaults: CliOptions,
    private readonly agentExtensionHelpLines: string[] = [],
    agentExtensionFlags: string[] = [],
  ) {
    this.knownFlags = new Set([...BASE_KNOWN_FLAGS, ...agentExtensionFlags]);
  }

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
        if (!this.knownFlags.has(name)) {
          throw new Error(`Unknown flag: --${name}`);
        }
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
    return buildCliHelpLines(this.agentExtensionHelpLines).join("\n");
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
