import type { ResetStateResult } from "@nile/core/application/local";

export class ResetPresenter {
  formatResult(result: ResetStateResult): string {
    return [
      "Local Nile state reset",
      `database: ${this.formatLine(result.databaseRemoved, result.databasePath)}`,
      `history: ${this.formatLine(result.historyRemoved, result.historyPath)}`,
      `credentials: ${this.formatCredentials(result.credentialsRemoved)}`,
    ].join("\n");
  }

  private formatLine(removed: boolean, path: string): string {
    return removed ? `removed (${path})` : `already empty (${path})`;
  }

  private formatCredentials(removed: boolean): string {
    return removed
      ? "removed Nile-managed keychain entries"
      : "no Nile-managed keychain entries found";
  }
}
