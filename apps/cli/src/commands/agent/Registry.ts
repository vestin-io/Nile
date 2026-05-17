import type { AgentId } from "@nile/core/models/agent";

import type { CommandResult, ResolvedCliOptions } from "../../types";
import type { AgentCommandExtension } from "./Types";

export class AgentCommandExtensionRegistry {
  private readonly extensionsByAgentId = new Map<AgentId, AgentCommandExtension>();

  constructor(extensions: AgentCommandExtension[]) {
    for (const extension of extensions) {
      this.extensionsByAgentId.set(extension.agentId, extension);
    }
  }

  listHelpLines(): string[] {
    return [...this.extensionsByAgentId.values()].flatMap((extension) => extension.listHelpLines());
  }

  listKnownFlags(): string[] {
    return [...this.extensionsByAgentId.values()].flatMap((extension) => extension.listKnownFlags());
  }

  async route(
    agentId: AgentId,
    options: ResolvedCliOptions,
    command: string[],
    flags: Map<string, string | boolean>,
  ): Promise<CommandResult | null> {
    const extension = this.extensionsByAgentId.get(agentId);
    if (!extension) {
      return null;
    }

    return await extension.route({
      agentId,
      options,
      command,
      flags,
    });
  }
}
