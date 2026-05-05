import type { AgentId } from "@nile/core/models/agent";
import type { AgentCommands } from "../commands/AgentCommands";
import type { ConnectionCommands } from "../commands/ConnectionCommands";
import type { ConnectionPresenter } from "../presenters/ConnectionPresenter";
import type { StatusPresenter } from "../presenters/StatusPresenter";
import type { InteractivePrompt } from "../InteractivePrompt";
import type { ResolvedCliOptions } from "../types";
import type { ConnectionSelectionFlow } from "./ConnectionSelectionFlow";
import type { InfoPanel } from "./InfoPanel";
import type { NavigationCallbacks, MenuNavigation } from "./navigation";
import { formatAgentLabel } from "../formatters";

type ManageSelection = AgentId | "import-detected";

export class ManageConnectionsFlow {
  constructor(
    private readonly prompt: InteractivePrompt,
    private readonly agentCommands: AgentCommands,
    private readonly connectionCommands: ConnectionCommands,
    private readonly connectionPresenter: ConnectionPresenter,
    private readonly statusPresenter: StatusPresenter,
    private readonly connectionSelection: ConnectionSelectionFlow,
    private readonly infoPanel: InfoPanel,
  ) {}

  async run(options: ResolvedCliOptions, actions: NavigationCallbacks): Promise<MenuNavigation> {
    while (true) {
      const allStatuses = this.agentCommands.getStatuses(options);
      const scan = this.connectionCommands.scanLocalSetups(options);

      if (allStatuses.length === 0) {
        return this.infoPanel.run(
          "Current agent connections",
          "No connected agents detected.",
        );
      }

      this.prompt.showNote(
        this.statusPresenter.formatStatus(allStatuses),
        "Current agent connections",
      );

      const agentOptions: Array<{ value: ManageSelection; label: string }> = [...allStatuses]
        .map((status) => ({
          value: status.agent as ManageSelection,
          label: `Change ${formatAgentLabel(status.agent)} connection`,
        }));

      if (scan.importableCount > 0) {
        agentOptions.unshift({
          value: "import-detected",
          label: `${this.formatNewBadge()} Import detected local setups`,
        });
      }

      const selection = await this.prompt.select(
        "Manage agent connections",
        agentOptions,
        { allowBack: true, allowCancel: true },
      );

      if (selection.type === "cancel") {
        throw actions.buildCancelledError();
      }
      if (selection.type === "back") {
        return "menu";
      }

      try {
        if ((selection.value as ManageSelection) === "import-detected") {
          const result = await this.runDetectedImport(options, scan, actions);
          return this.infoPanel.runResult(
            "Connection saved",
            this.connectionPresenter.formatDetectedImportSummary(result),
          );
        }

        const agentId = selection.value as AgentId;
        const compatibleConnections = this.connectionCommands.listConnectionsForAgent(options, agentId);
        if (compatibleConnections.length === 0) {
          const next = await this.infoPanel.run(
            "No saved connections",
            this.connectionPresenter.formatEmptyAgentConnections(agentId),
          );
          if (next === "exit") {
            return "exit";
          }
          continue;
        }
        const connectionId = await this.connectionSelection.selectConnectionId(
          options,
          agentId,
          `Choose a connection for ${formatAgentLabel(agentId)}`,
          actions.buildCancelledError,
          true,
        );
        const result = this.connectionCommands.useConnection(options, connectionId, agentId);
        return this.infoPanel.runResult(
          "Agent connection result",
          this.connectionPresenter.formatAgentUseSummary(agentId, result),
        );
      } catch (error) {
        if (actions.isBackError(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  private formatNewBadge(): string {
    if (!process.stdout.isTTY || process.env.NO_COLOR) {
      return "New:";
    }
    return "\x1b[33mNew:\x1b[39m";
  }

  private async runDetectedImport(
    options: ResolvedCliOptions,
    scan: ReturnType<ConnectionCommands["scanLocalSetups"]>,
    actions: NavigationCallbacks,
  ) {
    const importableItems = scan.items.filter((item) => item.importable);
    if (importableItems.length === 1) {
      return this.connectionCommands.importDetectedSetups(options, {
        selections: [{ scanId: importableItems[0].scanId }],
      });
    }

    this.prompt.showNote(
      this.connectionPresenter.formatScannedLocalSetups(scan),
      "Detected local setups",
    );

    const selection = await this.prompt.multiSelect(
      "Choose local setups to import",
      importableItems.map((item) => ({
        value: item.scanId,
        label: `${formatAgentLabel(item.agentId)} · ${item.subtitle}`,
      })),
      { allowDone: true, doneLabel: "Import selected", allowBack: true, allowCancel: true },
    );
    if (selection.type === "cancel") {
      throw actions.buildCancelledError();
    }
    if (selection.type === "back") {
      throw new Error("Back");
    }

    return this.connectionCommands.importDetectedSetups(options, {
      selections: selection.values.map((scanId) => ({ scanId })),
    });
  }
}
