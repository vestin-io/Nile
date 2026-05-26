import { StateReset } from "@nile/builtins/local";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { InteractivePrompt } from "../InteractivePrompt";
import type { ResolvedCliOptions } from "../types";

export class ResetCommands {
  private readonly stateReset: StateReset;

  constructor(
    private readonly prompt: InteractivePrompt,
    private readonly logger: NileLogger,
    credentialStore?: CredentialStore,
  ) {
    this.stateReset = new StateReset(credentialStore);
  }

  async resetState(options: ResolvedCliOptions, flags: Map<string, string | boolean>) {
    if (flags.get("yes") === true && flags.get("confirm-reset") === true) {
      return this.performReset(options);
    }

    if (!this.prompt.isInteractive()) {
      throw new Error("reset requires --yes --confirm-reset when not running interactively");
    }

    const firstConfirmation = await this.prompt.select(
      "Reset local Nile state on this machine?",
      [{ value: "reset", label: "Continue to reset local SQLite state and history" }],
      { allowCancel: true },
    );
    if (firstConfirmation.type === "cancel") {
      throw new Error("Cancelled");
    }

    const secondConfirmation = await this.prompt.input(
      "Type RESET to confirm",
      { allowCancel: true },
    );
    if (secondConfirmation.type === "cancel") {
      throw new Error("Cancelled");
    }
    if (secondConfirmation.type !== "value") {
      throw new Error("Cancelled");
    }
    if (secondConfirmation.value !== "RESET") {
      throw new Error("reset requires typing RESET");
    }

    return this.performReset(options);
  }

  private performReset(options: ResolvedCliOptions) {
    const result = this.stateReset.reset(options.databasePath);

    this.logger.info("cli.reset.completed", {
      databasePath: result.databasePath,
      historyPath: result.historyPath,
      credentialsRemoved: result.credentialsRemoved,
      databaseRemoved: result.databaseRemoved,
      historyRemoved: result.historyRemoved,
    });

    return result;
  }
}
