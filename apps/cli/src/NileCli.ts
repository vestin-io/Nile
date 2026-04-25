import {
  type CredentialStore,
  KeychainCredentialStore,
} from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { AgentId } from "@nile/core/models/agent";
import { CodexSessionLogin } from "@nile/core/agents";

import { NILE_WELCOME_BODY, NILE_WORDMARK } from "./Branding";
import { ConnectionCommands } from "./commands/ConnectionCommands";
import { HistoryCommands } from "./commands/HistoryCommands";
import { ResetCommands } from "./commands/ResetCommands";
import { StatusCommands } from "./commands/StatusCommands";
import { UsageCommands } from "./commands/UsageCommands";
import { ArgumentParser } from "./ArgumentParser";
import { InteractiveMenu } from "./menu/InteractiveMenu";
import { ConnectionPresenter } from "./presenters/ConnectionPresenter";
import { ResetPresenter } from "./presenters/ResetPresenter";
import { StatusPresenter } from "./presenters/StatusPresenter";
import { InteractivePrompt } from "./InteractivePrompt";
import type { CliOptions, CommandResult, ResolvedCliOptions } from "./types";

export class NileCli {
  private readonly logger: NileLogger;
  private readonly parser: ArgumentParser;
  private readonly connectionCommands: ConnectionCommands;
  private readonly historyCommands: HistoryCommands;
  private readonly resetCommands: ResetCommands;
  private readonly statusCommands: StatusCommands;
  private readonly usageCommands: UsageCommands;
  private readonly connectionPresenter: ConnectionPresenter;
  private readonly resetPresenter: ResetPresenter;
  private readonly statusPresenter: StatusPresenter;
  private readonly prompt: InteractivePrompt;
  private readonly interactiveMenu: InteractiveMenu;

  constructor(
    options: CliOptions,
    credentialStore: CredentialStore = options.credentialStore ?? new KeychainCredentialStore(),
  ) {
    this.logger = options.logger ?? NileLogger.createDefault({ module: "cli" });
    const prompt = options.prompt ?? new InteractivePrompt();
    const loginRunner = options.loginRunner ?? new CodexSessionLogin();

    this.prompt = prompt;
    this.parser = new ArgumentParser(options);
    this.connectionCommands = new ConnectionCommands(
      credentialStore,
      prompt,
      loginRunner,
      this.logger,
    );
    this.historyCommands = new HistoryCommands(credentialStore, this.logger);
    this.resetCommands = new ResetCommands(prompt, this.logger);
    this.statusCommands = new StatusCommands(credentialStore, this.logger);
    this.usageCommands = new UsageCommands(credentialStore, this.logger);
    this.connectionPresenter = new ConnectionPresenter();
    this.resetPresenter = new ResetPresenter();
    this.statusPresenter = new StatusPresenter();
    this.interactiveMenu = new InteractiveMenu(
      this.prompt,
      this.statusCommands,
      this.connectionCommands,
      this.resetCommands,
      this.usageCommands,
      this.historyCommands,
      this.connectionPresenter,
      this.resetPresenter,
      this.statusPresenter,
    );
  }

  async run(argv: string[]): Promise<CommandResult> {
    const commandLogFields = this.buildCommandLogFields(argv);
    this.logger.info("cli.command.start", commandLogFields);

    try {
      const parsed = this.parser.parse(argv);
      if (parsed.command.length === 0) {
        return await this.runDefault(parsed.options);
      }

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
          return this.runUsage(parsed.options, rest[0], parsed.flags.get("json") === true);
        case "add":
          return await this.runAdd(parsed.options, parsed.flags);
        case "import":
          throw new Error("import requires an agent. Use `nile codex import`, `nile cursor import`, `nile claude import`, or `nile openclaw import`.");
        case "codex":
        case "cursor":
        case "claude":
        case "openclaw":
          return await this.runAgentCommand(head, parsed.options, rest, parsed.flags);
        case "remove":
          return this.runRemove(parsed.options, rest[0]);
        case "rollback":
          throw new Error("rollback requires an agent. Use `nile codex rollback`, `nile cursor rollback`, `nile claude rollback`, or `nile openclaw rollback`.");
        default:
          return {
            exitCode: 1,
            stdout: "",
            stderr: `Unknown command: ${parsed.command.join(" ")}`,
          };
      }
    } catch (error) {
      if (this.isCancelledError(error)) {
        return {
          exitCode: 0,
          stdout: "",
        };
      }
      this.logger.error("cli.command.failed", error, commandLogFields);
      return {
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async runDefault(options: ResolvedCliOptions): Promise<CommandResult> {
    if (!this.prompt.isInteractive()) {
      return this.help();
    }

    this.showWelcome();
    const stdout = await this.interactiveMenu.run(options, {
      buildCancelledError: () => this.buildCancelledError(),
      isBackError: (error) => this.isBackError(error),
    });
    return stdout ? this.okText(stdout) : { exitCode: 0, stdout: "" };
  }

  private runStatus(options: ResolvedCliOptions, asJson: boolean): CommandResult {
    const statuses = this.statusCommands.getStatuses(options);
    if (asJson) {
      return this.ok(statuses);
    }
    return this.okText(this.statusPresenter.formatStatus(statuses));
  }

  private buildCommandLogFields(argv: string[]): Record<string, unknown> {
    const commandToken = argv.find((token) => !token.startsWith("-")) ?? "default";
    const flags = argv
      .filter((token) => token.startsWith("-"))
      .map((token) => {
        const separatorIndex = token.indexOf("=");
        if (separatorIndex === -1) {
          return token;
        }
        return `${token.slice(0, separatorIndex)}=<redacted>`;
      });
    return {
      command: commandToken,
      argCount: argv.length,
      flags,
    };
  }

  private runList(options: ResolvedCliOptions, asJson: boolean): CommandResult {
    const connections = this.connectionCommands.listConnections(options);
    if (asJson) {
      return this.ok(connections);
    }
    return this.okText(this.connectionPresenter.formatConnectionList(connections));
  }

  private runHistory(options: ResolvedCliOptions, asJson: boolean): CommandResult {
    const history = this.historyCommands.listHistory(options);
    if (asJson) {
      return this.ok(history);
    }
    return this.okText(this.connectionPresenter.formatHistory(history));
  }

  private async runReset(
    options: ResolvedCliOptions,
    asJson: boolean,
    flags: Map<string, string | boolean>,
  ): Promise<CommandResult> {
    const result = await this.resetCommands.resetState(options, flags);
    if (asJson) {
      return this.ok(result);
    }
    return this.okText(this.resetPresenter.formatResult(result));
  }

  private async runUsage(
    options: ResolvedCliOptions,
    connectionId: string | undefined,
    asJson: boolean,
  ): Promise<CommandResult> {
    if (!connectionId) {
      throw new Error("usage requires <connectionId>");
    }
    const usage = await this.usageCommands.getUsage(options, connectionId);
    if (asJson) {
      return this.ok(usage);
    }
    return this.okText(this.connectionPresenter.formatUsage(usage));
  }

  private async runAdd(
    options: ResolvedCliOptions,
    flags: Map<string, string | boolean>,
  ): Promise<CommandResult> {
    const result = await this.connectionCommands.addConnection(options, flags);
    return this.okText(this.connectionPresenter.formatConnectionSummary(result));
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
    if (agentId === "cursor" && head === "usage" && second === "bind") {
      return await this.runCursorUsageBind(options, third, flags, flags.get("json") === true);
    }
    if (agentId === "cursor" && head === "usage" && second === "auto-bind") {
      return await this.runCursorUsageAutoBind(options, third, flags.get("json") === true);
    }

    throw new Error(`Unknown ${agentId} command: ${command.join(" ")}`);
  }

  private runAgentStatus(
    agentId: AgentId,
    options: ResolvedCliOptions,
    asJson: boolean,
  ): CommandResult {
    const status = this.statusCommands.getStatus(options, agentId);
    if (asJson) {
      return this.ok(status);
    }
    return this.okText(this.statusPresenter.formatStatus(status));
  }

  private runAgentImport(agentId: AgentId, options: ResolvedCliOptions): CommandResult {
    const result = this.connectionCommands.importCurrentConnection(options, agentId);
    return this.okText(this.connectionPresenter.formatImportSummary(result));
  }

  private runAgentUse(
    agentId: AgentId,
    options: ResolvedCliOptions,
    connectionId?: string,
  ): CommandResult {
    if (!connectionId) {
      throw new Error(`${agentId} use requires <connectionId>`);
    }

    const result = this.connectionCommands.useConnection(options, connectionId, agentId);
    return this.okText(this.connectionPresenter.formatAgentUseSummary(agentId, result));
  }

  private runRemove(options: ResolvedCliOptions, connectionId?: string): CommandResult {
    if (!connectionId) {
      throw new Error("remove requires <connectionId>");
    }

    const result = this.connectionCommands.removeConnection(options, connectionId);
    return this.okText(this.connectionPresenter.formatRemoveSummary(result));
  }

  private runAgentRollback(agentId: AgentId, options: ResolvedCliOptions): CommandResult {
    const result = this.historyCommands.rollbackLatest(options, agentId);
    return this.okText(this.connectionPresenter.formatRollbackSummary(result));
  }

  private async runCursorUsageBind(
    options: ResolvedCliOptions,
    connectionId: string | undefined,
    flags: Map<string, string | boolean>,
    asJson: boolean,
  ): Promise<CommandResult> {
    if (!connectionId) {
      throw new Error("cursor usage bind requires <connectionId>");
    }

    const sessionToken = flags.get("session-token") ?? flags.get("workos-session-token");
    if (typeof sessionToken !== "string" || !sessionToken.trim()) {
      throw new Error("cursor usage bind requires --session-token <token>");
    }

    const result = await this.usageCommands.bindCursorUsage(options, connectionId, sessionToken);
    if (asJson) {
      return this.ok(result);
    }
    return this.okText(this.connectionPresenter.formatCursorUsageBindingSummary(result));
  }

  private async runCursorUsageAutoBind(
    options: ResolvedCliOptions,
    connectionId: string | undefined,
    asJson: boolean,
  ): Promise<CommandResult> {
    if (!connectionId) {
      throw new Error("cursor usage auto-bind requires <connectionId>");
    }

    const result = await this.usageCommands.autoBindCursorUsage(options, connectionId);
    if (asJson) {
      return this.ok(result);
    }
    return this.okText(this.connectionPresenter.formatCursorUsageAutoBindSummary(result));
  }

  private help(): CommandResult {
    const header = [NILE_WORDMARK, "", NILE_WELCOME_BODY, ""].join("\n");
    return {
      exitCode: 0,
      stdout: `${header}${this.parser.helpText()}`,
    };
  }

  private showWelcome(): void {
    this.prompt.showNote(`${NILE_WORDMARK}\n\n${NILE_WELCOME_BODY}`, "Welcome");
  }

  private ok(payload: unknown): CommandResult {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(payload, null, 2)}\n`,
    };
  }

  private okText(stdout: string): CommandResult {
    return {
      exitCode: 0,
      stdout: `${stdout}\n`,
    };
  }

  private buildCancelledError(): Error {
    return new Error("Cancelled");
  }

  private isCancelledError(error: unknown): boolean {
    return error instanceof Error && error.message === "Cancelled";
  }

  private isBackError(error: unknown): boolean {
    return error instanceof Error && error.message === "Back";
  }
}
