import type { AgentId } from "@nile/core/models/agent";
import type { ConnectionCommands } from "../commands/ConnectionCommands";
import type { ConnectionPresenter } from "../presenters/ConnectionPresenter";
import type { InteractivePrompt } from "../InteractivePrompt";
import type { ResolvedCliOptions } from "../types";

export class ConnectionSelectionFlow {
  constructor(
    private readonly prompt: InteractivePrompt,
    private readonly connectionCommands: ConnectionCommands,
    private readonly connectionPresenter: ConnectionPresenter,
  ) {}

  async selectConnectionId(
    options: ResolvedCliOptions,
    agentId: AgentId | null,
    message: string,
    buildCancelledError: () => Error,
    allowBack: boolean = false,
  ): Promise<string> {
    const connections = agentId
      ? this.connectionCommands.listConnectionsForAgent(options, agentId)
      : this.connectionCommands.listConnections(options);
    if (connections.length === 0) {
      throw new Error("No connections found");
    }

    const selection = await this.prompt.select(
      message,
      connections.map((connection) => ({
        value: connection.id,
        label: this.connectionPresenter.formatConnectionChoice(connection),
      })),
      { allowBack, allowCancel: true },
    );

    if (selection.type === "back") {
      throw new Error("Back");
    }
    if (selection.type !== "selected") {
      throw buildCancelledError();
    }

    return selection.value;
  }
}
