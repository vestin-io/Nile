import type { AgentId } from "@nile/core/models/agent";

import type { CommandResult, ResolvedCliOptions } from "../../types";

export type AgentCommandExtensionInput = {
  agentId: AgentId;
  command: string[];
  options: ResolvedCliOptions;
  flags: Map<string, string | boolean>;
};

export interface AgentCommandExtension {
  readonly agentId: AgentId;

  listHelpLines(): string[];
  listKnownFlags(): string[];
  route(input: AgentCommandExtensionInput): Promise<CommandResult | null>;
}
