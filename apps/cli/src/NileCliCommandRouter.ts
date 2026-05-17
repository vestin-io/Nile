import { isAgentId, type AgentId } from "@nile/core/models/agent";

import { buildAgentCommandExamples } from "./CliCatalog";
import type { ParsedArguments, CommandResult, ResolvedCliOptions } from "./types";
import { AgentCommands } from "./commands/AgentCommands";
import { ConnectionCommands } from "./commands/ConnectionCommands";
import { ResetCommands } from "./commands/ResetCommands";
import { UsageCommands } from "./commands/UsageCommands";
import { ConnectionPresenter } from "./presenters/ConnectionPresenter";
import { ResetPresenter } from "./presenters/ResetPresenter";
import { StatusPresenter } from "./presenters/StatusPresenter";
import { NileCliResultFactory } from "./NileCliResultFactory";
import { AgentCommandExtensionRegistry } from "./commands/agent/Registry";

type NileCliCommandRouterOptions = {
  agentCommands: AgentCommands;
  connectionCommands: ConnectionCommands;
  connectionPresenter: ConnectionPresenter;
  resetCommands: ResetCommands;
  resetPresenter: ResetPresenter;
  resultFactory: NileCliResultFactory;
  statusPresenter: StatusPresenter;
  usageCommands: UsageCommands;
  agentCommandExtensions: AgentCommandExtensionRegistry;
};

export class NileCliCommandRouter {
  constructor(private readonly options: NileCliCommandRouterOptions) {}

  async route(parsed: ParsedArguments): Promise<CommandResult> {
    const [head, ...rest] = parsed.command;

    switch (head) {
      case "status":
        return this.runStatus(parsed.options, parsed.flags.get("json") === true);
      case "list":
        return this.runList(parsed.options, parsed.flags.get("json") === true);
      case "history":
        return this.runHistory(parsed.options, parsed.flags.get("json") === true);
      case "reset":
        return await this.runReset(parsed.options, parsed.flags.get("json") === true, parsed.flags);
      case "usage":
        return await this.runUsage(parsed.options, rest[0], parsed.flags.get("json") === true);
      case "add":
        return await this.runAdd(parsed.options, parsed.flags);
      case "import":
        throw new Error(`import requires an agent. Use ${buildAgentCommandExamples("import")}.`);
      case "remove":
        return this.runRemove(parsed.options, rest[0]);
      case "rollback":
        throw new Error(`rollback requires an agent. Use ${buildAgentCommandExamples("rollback")}.`);
      default:
        if (isAgentId(head)) {
          return await this.runAgentCommand(head, parsed.options, rest, parsed.flags);
        }
        return this.options.resultFactory.error(`Unknown command: ${parsed.command.join(" ")}`);
    }
  }

  private runStatus(options: ResolvedCliOptions, asJson: boolean): CommandResult {
    const statuses = this.options.agentCommands.getStatuses(options);
    return asJson
      ? this.options.resultFactory.ok(statuses)
      : this.options.resultFactory.okText(this.options.statusPresenter.formatStatus(statuses));
  }

  private runList(options: ResolvedCliOptions, asJson: boolean): CommandResult {
    const connections = this.options.connectionCommands.listConnections(options);
    return asJson
      ? this.options.resultFactory.ok(connections)
      : this.options.resultFactory.okText(this.options.connectionPresenter.formatConnectionList(connections));
  }

  private runHistory(options: ResolvedCliOptions, asJson: boolean): CommandResult {
    const history = this.options.agentCommands.listHistory(options);
    return asJson
      ? this.options.resultFactory.ok(history)
      : this.options.resultFactory.okText(this.options.connectionPresenter.formatHistory(history));
  }

  private async runReset(
    options: ResolvedCliOptions,
    asJson: boolean,
    flags: Map<string, string | boolean>,
  ): Promise<CommandResult> {
    const result = await this.options.resetCommands.resetState(options, flags);
    return asJson
      ? this.options.resultFactory.ok(result)
      : this.options.resultFactory.okText(this.options.resetPresenter.formatResult(result));
  }

  private async runUsage(
    options: ResolvedCliOptions,
    connectionId: string | undefined,
    asJson: boolean,
  ): Promise<CommandResult> {
    if (!connectionId) {
      throw new Error("usage requires <connectionId>");
    }
    const usage = await this.options.usageCommands.getUsage(options, connectionId);
    return asJson
      ? this.options.resultFactory.ok(usage)
      : this.options.resultFactory.okText(this.options.connectionPresenter.formatUsage(usage));
  }

  private async runAdd(
    options: ResolvedCliOptions,
    flags: Map<string, string | boolean>,
  ): Promise<CommandResult> {
    const result = await this.options.connectionCommands.addConnection(options, flags);
    return this.options.resultFactory.okText(this.options.connectionPresenter.formatConnectionSummary(result));
  }

  private async runAgentCommand(
    agentId: AgentId,
    options: ResolvedCliOptions,
    command: string[],
    flags: Map<string, string | boolean>,
  ): Promise<CommandResult> {
    const [head, second, third] = command;
    if (head === "status") {
      return this.runAgentStatus(agentId, options, flags.get("json") === true);
    }
    if (head === "import") {
      return this.runAgentImport(agentId, options);
    }
    if (head === "use") {
      return this.runAgentUse(agentId, options, second);
    }
    if (head === "rollback") {
      return this.runAgentRollback(agentId, options);
    }
    const extensionResult = await this.options.agentCommandExtensions.route(agentId, options, command, flags);
    if (extensionResult) {
      return extensionResult;
    }

    throw new Error(`Unknown ${agentId} command: ${command.join(" ")}`);
  }

  private runAgentStatus(
    agentId: AgentId,
    options: ResolvedCliOptions,
    asJson: boolean,
  ): CommandResult {
    const status = this.options.agentCommands.getStatus(options, agentId);
    return asJson
      ? this.options.resultFactory.ok(status)
      : this.options.resultFactory.okText(this.options.statusPresenter.formatStatus(status));
  }

  private async runAgentImport(agentId: AgentId, options: ResolvedCliOptions): Promise<CommandResult> {
    const result = await this.options.connectionCommands.importCurrentConnection(options, agentId);
    return this.options.resultFactory.okText(this.options.connectionPresenter.formatImportSummary(result));
  }

  private runAgentUse(
    agentId: AgentId,
    options: ResolvedCliOptions,
    connectionId?: string,
  ): CommandResult {
    if (!connectionId) {
      throw new Error(`${agentId} use requires <connectionId>`);
    }

    const result = this.options.connectionCommands.useConnection(options, connectionId, agentId);
    return this.options.resultFactory.okText(this.options.connectionPresenter.formatAgentUseSummary(agentId, result));
  }

  private runRemove(options: ResolvedCliOptions, connectionId?: string): CommandResult {
    if (!connectionId) {
      throw new Error("remove requires <connectionId>");
    }

    const result = this.options.connectionCommands.removeConnection(options, connectionId);
    return this.options.resultFactory.okText(this.options.connectionPresenter.formatRemoveSummary(result));
  }

  private runAgentRollback(agentId: AgentId, options: ResolvedCliOptions): CommandResult {
    const result = this.options.agentCommands.rollbackLatest(options, agentId);
    return this.options.resultFactory.okText(this.options.connectionPresenter.formatRollbackSummary(result));
  }
}
