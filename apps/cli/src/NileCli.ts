import {
  type CredentialStore,
  KeychainCredentialStore,
} from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { CodexSessionLogin } from "@nile/core/agents";

import { NILE_WELCOME_BODY, NILE_WORDMARK } from "./Branding";
import { AgentCommands } from "./commands/AgentCommands";
import { ConnectionCommands } from "./commands/ConnectionCommands";
import { ResetCommands } from "./commands/ResetCommands";
import { UsageCommands } from "./commands/UsageCommands";
import { ArgumentParser } from "./ArgumentParser";
import { InteractiveMenu } from "./menu/InteractiveMenu";
import { NileCliCommandRouter } from "./NileCliCommandRouter";
import { NileCliResultFactory } from "./NileCliResultFactory";
import { ConnectionPresenter } from "./presenters/ConnectionPresenter";
import { ResetPresenter } from "./presenters/ResetPresenter";
import { StatusPresenter } from "./presenters/StatusPresenter";
import { InteractivePrompt } from "./InteractivePrompt";
import type { CliOptions, CommandResult, ResolvedCliOptions } from "./types";

export class NileCli {
  private readonly logger: NileLogger;
  private readonly parser: ArgumentParser;
  private readonly prompt: InteractivePrompt;
  private readonly interactiveMenu: InteractiveMenu;
  private readonly resultFactory = new NileCliResultFactory();
  private readonly router: NileCliCommandRouter;

  constructor(
    options: CliOptions,
    credentialStore: CredentialStore = options.credentialStore ?? new KeychainCredentialStore(),
  ) {
    this.logger = options.logger ?? NileLogger.createDefault({ module: "cli" });
    const prompt = options.prompt ?? new InteractivePrompt();
    const loginRunner = options.loginRunner ?? new CodexSessionLogin();

    this.prompt = prompt;
    this.parser = new ArgumentParser(options);
    const agentCommands = new AgentCommands(credentialStore, this.logger);
    const connectionCommands = new ConnectionCommands(
      credentialStore,
      prompt,
      loginRunner,
      this.logger,
    );
    const resetCommands = new ResetCommands(prompt, this.logger);
    const usageCommands = new UsageCommands(credentialStore, this.logger);
    const connectionPresenter = new ConnectionPresenter();
    const resetPresenter = new ResetPresenter();
    const statusPresenter = new StatusPresenter();
    this.interactiveMenu = new InteractiveMenu(
      this.prompt,
      agentCommands,
      connectionCommands,
      resetCommands,
      usageCommands,
      connectionPresenter,
      resetPresenter,
      statusPresenter,
    );
    this.router = new NileCliCommandRouter({
      agentCommands,
      connectionCommands,
      connectionPresenter,
      resetCommands,
      resetPresenter,
      resultFactory: this.resultFactory,
      statusPresenter,
      usageCommands,
    });
  }

  async run(argv: string[]): Promise<CommandResult> {
    const commandLogFields = this.buildCommandLogFields(argv);
    this.logger.info("cli.command.start", commandLogFields);

    try {
      const parsed = this.parser.parse(argv);
      if (parsed.command.length === 0) {
        return await this.runDefault(parsed.options);
      }

      return await this.router.route(parsed);
    } catch (error) {
      if (this.isCancelledError(error)) {
        return this.resultFactory.cancelled();
      }
      this.logger.error("cli.command.failed", error, commandLogFields);
      return this.resultFactory.error(error);
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
    return stdout ? this.resultFactory.okText(stdout) : this.resultFactory.cancelled();
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

  private help(): CommandResult {
    const header = [NILE_WORDMARK, "", NILE_WELCOME_BODY, ""].join("\n");
    return this.resultFactory.okText(`${header}${this.parser.helpText()}`);
  }

  private showWelcome(): void {
    this.prompt.showNote(`${NILE_WORDMARK}\n\n${NILE_WELCOME_BODY}`, "Welcome");
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
