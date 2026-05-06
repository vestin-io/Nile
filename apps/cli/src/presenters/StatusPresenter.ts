import type { AgentStatusView } from "@nile/core/actions/local-state";
import { formatAgentLabel } from "../formatters";

export class StatusPresenter {
  formatStatus(status: AgentStatusView | AgentStatusView[]): string {
    const statuses = Array.isArray(status) ? status : [status];
    return this.formatStatusAgentList(statuses);
  }

  private formatStatusAgentList(statuses: AgentStatusView[]): string {
    const items = statuses
      .map((status) => this.formatAgentStatusItem(status))
      .filter((item): item is string[] => item !== null);
    const divider = "────────────────────────────────────────";

    if (items.length === 0) {
      return "No connected agents detected.";
    }

    return [
      divider,
      ...items.flatMap((item) => [...item, divider]),
    ].join("\n");
  }

  private formatAgentStatusItem(status: AgentStatusView): string[] | null {
    const connection = status.liveConnection ?? status.currentConnection;
    const agentLabel = formatAgentLabel(status.agent);

    if (!connection) {
      // Not configured at all — show a minimal entry with a setup hint
      return [
        `- ${agentLabel}`,
        `  State: not configured`,
        `  Hint: ${this.formatNotConfiguredHint(status, agentLabel)}`,
      ];
    }

    return [
      `- ${agentLabel}`,
      `  Endpoint: ${connection.endpointLabel}`,
      `  Connection: ${connection.label}`,
      `  State: ${this.formatSyncStateLabel(status)}`,
      `  Hint: ${this.formatSyncStateHint(status, agentLabel)}`,
    ];
  }

  private formatNotConfiguredHint(status: AgentStatusView, agentLabel: string): string {
    const issue = status.liveIssues?.[0];
    if (issue) {
      return `${issue} Select "Change ${agentLabel} connection" to apply a saved connection.`;
    }
    return `No active ${agentLabel} setup detected. Select "Change ${agentLabel} connection" to apply a saved connection.`;
  }

  private formatSyncStateLabel(status: AgentStatusView): string {
    if (status.currentConnectionState === "orphaned" && !status.liveConnection) {
      return "saved connection removed";
    }

    const { syncState } = status;
    if (syncState === "new_connection_detected") {
      return "new connection detected";
    }
    if (syncState === "invalid_live_state") {
      return "invalid live state";
    }
    if (syncState === "unverified_live_state") {
      return "unverified live state";
    }
    return "synced";
  }

  private formatSyncStateHint(status: AgentStatusView, agentLabel: string): string {
    if (status.currentConnectionState === "orphaned") {
      const orphanHint =
        `Last applied ${agentLabel} connection was removed from Nile. Select "Change ${agentLabel} connection" to repair the saved state.`;
      if (status.syncState === "new_connection_detected") {
        return `${orphanHint} Current ${agentLabel} setup is still valid and can be saved again with ${this.formatImportCommand(status.agent)}.`;
      }
      return orphanHint;
    }

    const { syncState } = status;
    if (syncState === "synced") {
      return `Current ${agentLabel} setup matches a saved Nile connection.`;
    }
    if (syncState === "new_connection_detected") {
      return `Current ${agentLabel} setup is valid but not yet saved in Nile. Run: ${this.formatImportCommand(status.agent)}`;
    }
    if (syncState === "invalid_live_state") {
      return `Nile could not safely match the current ${agentLabel} setup.`;
    }
    return `Nile could read the current ${agentLabel} setup, but it is not yet safe to match or import.`;
  }

  private formatCommand(command: string): string {
    if (!process.stdout.isTTY || process.env.NO_COLOR) {
      return command;
    }
    return `\x1b[36m${command}\x1b[39m`;
  }

  private formatImportCommand(agentId: string): string {
    return this.formatCommand(`nile ${agentId} import`);
  }
}
