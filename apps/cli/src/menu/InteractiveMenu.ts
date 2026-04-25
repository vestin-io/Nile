import type { HistoryCommands } from "../commands/HistoryCommands";
import type { ResetCommands } from "../commands/ResetCommands";
import type { StatusCommands } from "../commands/StatusCommands";
import type { ConnectionCommands } from "../commands/ConnectionCommands";
import type { UsageCommands } from "../commands/UsageCommands";
import type { ConnectionPresenter } from "../presenters/ConnectionPresenter";
import type { ResetPresenter } from "../presenters/ResetPresenter";
import type { StatusPresenter } from "../presenters/StatusPresenter";
import type { InteractivePrompt } from "../InteractivePrompt";
import type { ResolvedCliOptions } from "../types";
import { ManageConnectionsFlow } from "./ManageConnectionsFlow";
import { HistoryFlow } from "./HistoryFlow";
import { ConnectionSelectionFlow } from "./ConnectionSelectionFlow";
import { InfoPanel } from "./InfoPanel";
import type { NavigationCallbacks } from "./navigation";

export class InteractiveMenu {
  private readonly infoPanel: InfoPanel;
  private readonly connectionSelectionFlow: ConnectionSelectionFlow;
  private readonly manageConnectionsFlow: ManageConnectionsFlow;
  private readonly historyFlow: HistoryFlow;

  constructor(
    private readonly prompt: InteractivePrompt,
    statusCommands: StatusCommands,
    private readonly connectionCommands: ConnectionCommands,
    private readonly resetCommands: ResetCommands,
    private readonly usageCommands: UsageCommands,
    historyCommands: HistoryCommands,
    private readonly connectionPresenter: ConnectionPresenter,
    private readonly resetPresenter: ResetPresenter,
    statusPresenter: StatusPresenter,
  ) {
    this.infoPanel = new InfoPanel(prompt);
    this.connectionSelectionFlow = new ConnectionSelectionFlow(
      prompt,
      connectionCommands,
      connectionPresenter,
    );
    this.manageConnectionsFlow = new ManageConnectionsFlow(
      prompt,
      statusCommands,
      connectionCommands,
      connectionPresenter,
      statusPresenter,
      this.connectionSelectionFlow,
      this.infoPanel,
    );
    this.historyFlow = new HistoryFlow(
      prompt,
      statusCommands,
      historyCommands,
      connectionPresenter,
      this.infoPanel,
    );
  }

  async run(
    options: ResolvedCliOptions,
    actions: NavigationCallbacks,
  ): Promise<string> {
    while (true) {
      const selection = await this.prompt.select(
        "What would you like to do?",
        [
          { value: "status", label: "View current agent connections" },
          { value: "list", label: "View saved connections" },
          { value: "add", label: "Add a connection" },
          { value: "remove", label: "Remove a connection" },
          { value: "changes", label: "Review recent changes" },
          { value: "reset", label: "Reset local Nile state" },
        ],
        { allowCancel: true },
      );

      if (selection.type !== "selected") {
        throw actions.buildCancelledError();
      }

      if (selection.value === "status") {
        const next = await this.manageConnectionsFlow.run(options, actions);
        if (next === "exit") {
          return "";
        }
        continue;
      }
      if (selection.value === "list") {
        const connections = this.connectionCommands.listConnections(options);
        const usage = await this.prompt.withLoading(
          "Fetching usage…",
          () =>
            this.usageCommands.getUsageMap(
              options,
              connections.map((connection) => connection.id),
            ),
        );
        const next = await this.infoPanel.run(
          "Saved connections",
          this.connectionPresenter.formatConnectionListWithUsage(connections, usage),
        );
        if (next === "exit") {
          return "";
        }
        continue;
      }
      if (selection.value === "add") {
        try {
          const result = this.connectionPresenter.formatConnectionSummary(
            await this.connectionCommands.addConnectionInteractive(options),
          );
          const next = await this.infoPanel.runResult(
            "Connection result",
            result,
          );
          if (next === "exit") {
            return "";
          }
        } catch (error) {
          if (actions.isBackError(error)) {
            continue;
          }
          throw error;
        }
        continue;
      }
      if (selection.value === "remove") {
        const connections = this.connectionCommands.listConnections(options);
        if (connections.length === 0) {
          const next = await this.infoPanel.run(
            "No saved connections",
            this.connectionPresenter.formatEmptyConnections(),
          );
          if (next === "exit") {
            return "";
          }
          continue;
        }
        const connectionId = await this.connectionSelectionFlow.selectConnectionId(
          options,
          null,
          "Choose a connection to remove",
          actions.buildCancelledError,
        );
        const removal = this.connectionCommands.removeConnection(options, connectionId);
        const next = await this.infoPanel.runResult(
          "Connection result",
          this.connectionPresenter.formatRemoveSummary(removal),
        );
        if (next === "exit") {
          return "";
        }
        continue;
      }

      if (selection.value === "reset") {
        const result = await this.resetCommands.resetState(options, new Map());
        const next = await this.infoPanel.runResult(
          "Reset complete",
          this.resetPresenter.formatResult(result),
        );
        if (next === "exit") {
          return "";
        }
        continue;
      }

      const next = await this.historyFlow.run(options, actions.buildCancelledError);
      if (next === "exit") {
        return "";
      }
    }
  }
}
