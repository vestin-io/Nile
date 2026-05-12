import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type {
  ImportDetectedSetupsResult,
  ScanLocalSetupsResult,
} from "@nile/core/actions/local-setup";
import type { CursorUsageAutoBindResult } from "@nile/core/application/local";
import type { ConnectionUsageResult } from "@nile/core/actions/usage";
import type { BindCursorUsageResult } from "@nile/core/actions/usage/cursor";
import type {
  AddConnectionResult,
  HistoryListEntry,
} from "../types";
import { formatAgentLabel } from "../formatters";
import { EndpointLabelFormatter } from "./EndpointLabelFormatter";

export class ConnectionPresenter {
  private readonly endpointLabels = new EndpointLabelFormatter();

  formatConnectionSummary(connection: AddConnectionResult): string {
    const heading = connection.reused ? "Reused existing connection" : "Connection created";
    return [
      heading,
      `endpoint: ${this.endpointLabels.formatEndpointLabel(connection.endpointLabel)}`,
      `label: ${this.endpointLabels.formatConnectionLabel(connection.endpointLabel, connection.label, connection.authMode)}`,
      `id: ${connection.id}`,
    ].join("\n");
  }

  formatImportSummary(connection: AddConnectionResult): string {
    const heading = connection.reused ? "Reused existing connection" : "Imported current connection";
    return [
      heading,
      `endpoint: ${this.endpointLabels.formatEndpointLabel(connection.endpointLabel)}`,
      `label: ${this.endpointLabels.formatConnectionLabel(connection.endpointLabel, connection.label, connection.authMode)}`,
      `id: ${connection.id}`,
    ].join("\n");
  }

  formatRollbackSummary(result: {
    rollbackMutationId: string;
    rolledBackMutationId: string;
  }): string {
    return [
      "Rolled back latest Nile change",
      `rollback id: ${result.rollbackMutationId}`,
      `reverted mutation: ${result.rolledBackMutationId}`,
    ].join("\n");
  }

  formatAgentUseSummary(
    agentId: string,
    result: { id: string; label: string; endpointLabel: string; appliedAt: string },
  ): string {
    const agentLabel = formatAgentLabel(agentId);
    return [
      `${agentLabel} connection updated`,
      `connection: ${result.label}`,
      `id: ${result.id}`,
      `endpoint: ${this.endpointLabels.formatEndpointLabel(result.endpointLabel)}`,
      `applied at: ${result.appliedAt}`,
    ].join("\n");
  }

  formatRemoveSummary(result: { id: string; removed: true; clearedAgents: string[] }): string {
    const lines = [
      "Connection removed",
      `id: ${result.id}`,
    ];

    if (result.clearedAgents.length > 0) {
      lines.push(
        `note: Nile cleared the saved local selection for ${result.clearedAgents.map((agentId) => formatAgentLabel(agentId)).join(", ")} because this connection was removed.`,
      );
    }

    return lines.join("\n");
  }

  formatConnectionChoice(connection: SavedConnectionSummary): string {
    const suffix: string[] = [
      this.endpointLabels.formatEndpointLabel(connection.endpointLabel),
      this.formatAuthMode(connection.authMode),
    ];
    if (connection.selectedByAgents.length > 0) {
      suffix.unshift(`selected by ${connection.selectedByAgents.join(", ")}`);
    }
    return `${this.endpointLabels.formatConnectionLabel(connection.endpointLabel, connection.label, connection.authMode)} (${suffix.join(" • ")})`;
  }

  formatConnectionList(connections: SavedConnectionSummary[]): string {
    if (connections.length === 0) {
      return "No saved connections.";
    }

    const divider = "────────────────────────────────────────";
    const blocks = connections.map((connection) => {
      const lines = [this.endpointLabels.formatConnectionLabel(connection.endpointLabel, connection.label, connection.authMode)];
      lines.push(this.formatConnectionMeta(connection));
      return lines.join("\n");
    });

    return ["", divider, blocks.join(`\n${divider}\n`), divider].join("\n");
  }

  formatConnectionListWithUsage(
    connections: SavedConnectionSummary[],
    usageByConnectionId: Map<string, ConnectionUsageResult>,
  ): string {
    if (connections.length === 0) {
      return "No saved connections.";
    }

    const divider = "────────────────────────────────────────";
    const blocks = connections.map((connection) => {
      const lines = [this.endpointLabels.formatConnectionLabel(connection.endpointLabel, connection.label, connection.authMode)];
      lines.push(this.formatConnectionMeta(connection));

      const usage = usageByConnectionId.get(connection.id);
      if (!usage) {
        return lines.join("\n");
      }

      lines.push(...this.formatUsageSummaryLines(usage));
      return lines.join("\n");
    });

    return ["", divider, blocks.join(`\n${divider}\n`), divider].join("\n");
  }

  formatHistory(entries: HistoryListEntry[]): string {
    if (entries.length === 0) {
      return "No Nile changes recorded yet.";
    }

    const divider = "────────────────────────────────────────";
    const blocks = entries.map((entry) => [
      `- ${entry.startedAt.replace("T", " ").replace(".000Z", "Z")}`,
      `  Endpoint: ${this.endpointLabels.formatEndpointLabel(entry.endpointLabel)}`,
      `  Connection: ${entry.connectionLabel}`,
      `  Status: ${entry.status}`,
      `  Files: ${this.formatHistoryFiles(entry)}`,
    ].join("\n"));

    return [
      divider,
      blocks.join(`\n${divider}\n`),
      divider,
      "",
      "Rollback restores the latest safe Nile change only.",
    ].join("\n");
  }

  formatUsage(result: ConnectionUsageResult): string {
    const lines = [
      "Connection usage",
      `connection: ${result.connectionLabel}`,
      `endpoint: ${this.endpointLabels.formatEndpointLabel(result.endpointLabel)}`,
    ];

    if (result.planLabel) {
      lines.push(`plan: ${result.planLabel}`);
    }

    if (result.status !== "available") {
      lines.push(`status: ${result.status === "unsupported" ? "usage unavailable" : result.status}`);
      if (result.message) {
        lines.push(`note: ${result.message}`);
      }
      return lines.join("\n");
    }

    if (result.freshness && result.freshness !== "live") {
      lines.push(`freshness: ${result.freshness}`);
    }
    if (result.lastFetchedAt) {
      lines.push(`last fetched: ${result.lastFetchedAt}`);
    }

    for (const window of result.windows) {
      const parts = [];
      if (window.remainingPercent !== null) {
        parts.push(`${window.remainingPercent.toFixed(0)}% left`);
      }
      if (window.resetsAt) {
        parts.push(`resets at ${window.resetsAt}`);
      }
      lines.push(`${window.label}: ${parts.join(", ")}`);
    }

    return lines.join("\n");
  }

  formatCursorUsageBindingSummary(result: BindCursorUsageResult): string {
    return [
      "Cursor usage binding saved",
      `connection: ${result.connectionLabel}`,
      `id: ${result.connectionId}`,
      `endpoint: ${this.endpointLabels.formatEndpointLabel(result.endpointLabel)}`,
      `workos user: ${result.workosUserId}`,
      `verified at: ${result.boundAt}`,
    ].join("\n");
  }

  formatCursorUsageAutoBindSummary(result: CursorUsageAutoBindResult): string {
    if (result.status === "bound") {
      return [
        "Cursor usage auto-bound",
        `connection: ${result.binding.connectionLabel}`,
        `id: ${result.connectionId}`,
        `source: ${result.sourceLabel} (${result.locationLabel})`,
        `workos user: ${result.binding.workosUserId}`,
        `verified at: ${result.binding.boundAt}`,
      ].join("\n");
    }

    if (result.status === "already_bound") {
      return `Cursor usage is already bound for ${result.connectionId}`;
    }

    if (result.status === "no_session_found") {
      return `No matching Cursor usage session was found for ${result.connectionId}`;
    }

    return `Connection ${result.connectionId} is not an auto-bindable Cursor session`;
  }

  formatScannedLocalSetups(result: ScanLocalSetupsResult): string {
    const divider = "────────────────────────────────────────";
    const blocks = result.items.map((item) => {
      const lines = [
        `${formatAgentLabel(item.agentId)} · ${item.title.replace(`${formatAgentLabel(item.agentId)} · `, "")}`,
        `${this.formatScanState(item.state)} · ${item.subtitle}`,
      ];
      if (item.issues.length > 0) {
        lines.push(`note: ${item.issues[0]}`);
      }
      return lines.join("\n");
    });

    return ["", divider, blocks.join(`\n${divider}\n`), divider].join("\n");
  }

  formatDetectedImportSummary(result: ImportDetectedSetupsResult): string {
    if (result.results.length === 0) {
      return "No local setups were selected for import.";
    }

    return result.results.map((item) => {
      if (item.status === "created") {
        return `Imported ${item.connectionLabel}\nid: ${item.connectionId}`;
      }
      if (item.status === "reused") {
        return `Reused existing connection ${item.connectionLabel}\nid: ${item.connectionId}`;
      }
      if (item.status === "skipped") {
        return `Skipped ${formatAgentLabel(item.scanId)}\nreason: ${item.message ?? "No longer importable"}`;
      }
      return `Failed to import ${formatAgentLabel(item.scanId)}\nreason: ${item.message ?? "Unknown error"}`;
    }).join("\n\n");
  }

  formatEmptyAgentConnections(agentId: string): string {
    const agentLabel = formatAgentLabel(agentId);
    return `No saved ${agentLabel} connections yet. Import the current local setup or add a compatible connection first.`;
  }

  formatEmptyConnections(): string {
    return "No saved connections yet. Add or import a connection first.";
  }

  private formatUsageSummaryLines(result: ConnectionUsageResult): string[] {
    if (result.status !== "available") {
      const statusLabel = result.status === "unsupported" ? "unavailable" : result.status;
      return [`usage: ${statusLabel}${result.message ? ` (${result.message})` : ""}`];
    }

    const parts: string[] = [];
    if (result.freshness && result.freshness !== "live") {
      parts.push(result.freshness);
    }
    if (result.planLabel) {
      parts.push(`plan ${result.planLabel}`);
    }

    for (const window of result.windows) {
      if (window.remainingPercent === null) {
        continue;
      }
      parts.push(`${window.label} ${window.remainingPercent.toFixed(0)}% left`);
    }

    if (parts.length === 0) {
      return ["usage: available"];
    }

    return [`usage: ${parts.join(" · ")}`];
  }

  private formatScanState(state: ScanLocalSetupsResult["items"][number]["state"]): string {
    if (state === "new") {
      return "new";
    }
    if (state === "already_saved") {
      return "already saved";
    }
    if (state === "unavailable") {
      return "unavailable";
    }
    return "invalid";
  }

  private formatSelectedBy(agentLabel: string): string {
    const text = `selected by: ${agentLabel}`;
    if (!process.stdout.isTTY || process.env.NO_COLOR) {
      return text;
    }

    return `\x1b[32m${text}\x1b[39m`;
  }

  private formatConnectionMeta(connection: SavedConnectionSummary): string {
    const segments = [this.endpointLabels.formatEndpointLabel(connection.endpointLabel), this.formatAuthMode(connection.authMode)];
    if (connection.selectedByAgents.length > 0) {
      segments.push(this.formatSelectedBy(connection.selectedByAgents.join(", ")));
    }

    return segments.join(" · ");
  }

  private formatAuthMode(authMode: string): string {
    if (authMode === "openai_session") {
      return "OpenAI sign-in";
    }
    if (authMode === "claude_session") {
      return "Claude sign-in";
    }
    if (authMode === "api_key") {
      return "API key";
    }
    return authMode;
  }

  private formatHistoryFiles(entry: HistoryListEntry): string {
    return entry.files.map((file) => file.path.split("/").pop() ?? file.path).join(", ");
  }
}
