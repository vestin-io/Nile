import type { NileLogger } from "../services/NileLogger";
import type { SessionUsageAccess } from "./UsageAccess";

export type LocalEffectResult = {
  id: string;
  endpointFamily: string;
  authMode: string;
};

export class NileSessionEffects {
  constructor(
    private readonly getUsageAccess: () => SessionUsageAccess,
    private readonly logger?: NileLogger,
  ) {}

  async applyLocalEffects<T extends LocalEffectResult>(result: Promise<T>): Promise<T> {
    return this.applyResolvedLocalEffects(await result);
  }

  applyResolvedLocalEffects<T extends LocalEffectResult>(result: T): T {
    this.tryAutoBindCursorUsage(result.id, result.endpointFamily, result.authMode);
    return result;
  }

  private tryAutoBindCursorUsage(
    connectionId: string,
    endpointFamily: string,
    authMode: string,
  ): void {
    if (endpointFamily !== "cursor" || authMode !== "cursor_session") {
      return;
    }

    try {
      this.getUsageAccess().autoBindCursorUsage(connectionId);
    } catch (error) {
      this.logger?.warn("session.cursor_usage.auto_bind_failed", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
