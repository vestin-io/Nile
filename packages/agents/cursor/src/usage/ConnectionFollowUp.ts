import type { NileLogger } from "@nile/core/services/NileLogger";

export type ConnectionChangeResult = {
  id: string;
  endpointFamily: string | null;
  authMode: string;
};

export class CursorUsageConnectionFollowUp {
  constructor(
    private readonly autoBindCursorUsage: (connectionId: string) => void,
    private readonly logger?: NileLogger,
  ) {}

  async applyAfterConnectionChange<T extends ConnectionChangeResult>(result: Promise<T>): Promise<T> {
    return this.applyAfterResolvedConnectionChange(await result);
  }

  applyAfterResolvedConnectionChange<T extends ConnectionChangeResult>(result: T): T {
    if (result.endpointFamily !== "cursor" || result.authMode !== "cursor_session") {
      return result;
    }

    try {
      this.autoBindCursorUsage(result.id);
    } catch (error) {
      this.logger?.warn("session.cursor_usage.auto_bind_failed", {
        connectionId: result.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return result;
  }
}
