import type { CommandResult } from "../../types";
import { ConnectionPresenter } from "../../presenters/ConnectionPresenter";
import { NileCliResultFactory } from "../../NileCliResultFactory";
import { UsageCommands } from "../UsageCommands";
import type { AgentCommandExtension, AgentCommandExtensionInput } from "./Types";

export class CursorUsageCommandExtension implements AgentCommandExtension {
  readonly agentId = "cursor" as const;

  constructor(
    private readonly usageCommands: UsageCommands,
    private readonly connectionPresenter: ConnectionPresenter,
    private readonly resultFactory: NileCliResultFactory,
  ) {}

  listHelpLines(): string[] {
    return [
      "  nile cursor usage bind <connectionId> --session-token <token> [--json] [--db-path <path>] [--home cursor=<path>]",
      "  nile cursor usage auto-bind <connectionId> [--json] [--db-path <path>] [--home cursor=<path>]",
    ];
  }

  listKnownFlags(): string[] {
    return ["session-token", "workos-session-token"];
  }

  async route(input: AgentCommandExtensionInput): Promise<CommandResult | null> {
    const [head, second, third] = input.command;
    if (head !== "usage") {
      return null;
    }
    if (second === "bind") {
      return await this.runBind(input, third);
    }
    if (second === "auto-bind") {
      return await this.runAutoBind(input, third);
    }
    return null;
  }

  private async runBind(
    input: AgentCommandExtensionInput,
    connectionId: string | undefined,
  ): Promise<CommandResult> {
    if (!connectionId) {
      throw new Error("cursor usage bind requires <connectionId>");
    }

    const sessionToken = input.flags.get("session-token") ?? input.flags.get("workos-session-token");
    if (typeof sessionToken !== "string" || !sessionToken.trim()) {
      throw new Error("cursor usage bind requires --session-token <token>");
    }

    const result = await this.usageCommands.bindCursorUsage(input.options, connectionId, sessionToken);
    if (input.flags.get("json") === true) {
      return this.resultFactory.ok(result);
    }

    return this.resultFactory.okText(this.connectionPresenter.formatCursorUsageBindingSummary(result));
  }

  private async runAutoBind(
    input: AgentCommandExtensionInput,
    connectionId: string | undefined,
  ): Promise<CommandResult> {
    if (!connectionId) {
      throw new Error("cursor usage auto-bind requires <connectionId>");
    }

    const result = await this.usageCommands.autoBindCursorUsage(input.options, connectionId);
    if (input.flags.get("json") === true) {
      return this.resultFactory.ok(result);
    }

    return this.resultFactory.okText(this.connectionPresenter.formatCursorUsageAutoBindSummary(result));
  }
}
