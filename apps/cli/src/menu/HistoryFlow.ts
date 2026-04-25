import type { AgentId } from "@nile/core/models/agent";
import type { HistoryCommands } from "../commands/HistoryCommands";
import type { StatusCommands } from "../commands/StatusCommands";
import type { ConnectionPresenter } from "../presenters/ConnectionPresenter";
import type { InteractivePrompt } from "../InteractivePrompt";
import type { ResolvedCliOptions } from "../types";
import type { InfoPanel } from "./InfoPanel";
import type { MenuNavigation } from "./navigation";
import { formatAgentLabel } from "../formatters";

export class HistoryFlow {
  constructor(
    private readonly prompt: InteractivePrompt,
    private readonly statusCommands: StatusCommands,
    private readonly historyCommands: HistoryCommands,
    private readonly connectionPresenter: ConnectionPresenter,
    private readonly infoPanel: InfoPanel,
  ) {}

  async run(
    options: ResolvedCliOptions,
    buildCancelledError: () => Error,
  ): Promise<MenuNavigation> {
    while (true) {
      const selection = await this.prompt.select(
        "Recent changes",
        [
          { value: "history", label: "View change history" },
          { value: "rollback", label: "Rollback latest Nile change" },
        ],
        { allowBack: true, allowCancel: true },
      );

      if (selection.type === "cancel") {
        throw buildCancelledError();
      }
      if (selection.type === "back") {
        return "menu";
      }
      if (selection.value === "history") {
        const body = this.connectionPresenter.formatHistory(this.historyCommands.listHistory(options));
        const next = await this.infoPanel.run("Change history", body);
        if (next === "exit") {
          return "exit";
        }
        continue;
      }

      const agentId = await this.selectRollbackAgent(options, buildCancelledError);
      return this.infoPanel.runResult(
        "Change result",
        this.connectionPresenter.formatRollbackSummary(
          this.historyCommands.rollbackLatest(options, agentId),
        ),
      );
    }
  }

  private async selectRollbackAgent(
    options: ResolvedCliOptions,
    buildCancelledError: () => Error,
  ): Promise<AgentId> {
    const statuses = this.statusCommands.getStatuses(options);
    const selection = await this.prompt.select(
      "Choose an agent to roll back",
      statuses.map((status) => ({
        value: status.agent,
        label: formatAgentLabel(status.agent),
      })),
      { allowBack: true, allowCancel: true },
    );

    if (selection.type === "cancel") {
      throw buildCancelledError();
    }
    if (selection.type === "back") {
      throw new Error("Back");
    }
    return selection.value as AgentId;
  }
}
