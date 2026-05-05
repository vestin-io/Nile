import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { NileSession } from "@nile/core/runtime-local";
import type { NileLogger } from "@nile/core/services/NileLogger";

import { type DesktopUsageState, UsageSummary } from "./UsageSummary";

export class DesktopUsageCache {
  private static readonly CACHE_TTL_MS = 60_000;
  private static readonly REFRESH_CONCURRENCY = 4;

  private readonly usageByConnectionId = new Map<string, DesktopUsageState | null>();
  private readonly usageReadAt = new Map<string, number>();

  constructor(private readonly logger: NileLogger) {}

  peek(connectionId: string): DesktopUsageState | null {
    return this.usageByConnectionId.get(connectionId) ?? null;
  }

  async readByConnectionId(
    session: NileSession,
    savedConnections: SavedConnectionSummary[],
  ): Promise<Map<string, DesktopUsageState | null>> {
    return await this.refreshByConnectionId(
      session,
      savedConnections.map((connection) => connection.id),
    );
  }

  async refreshByConnectionId(
    session: NileSession,
    connectionIds: Array<string | null>,
    options?: { force: boolean },
  ): Promise<Map<string, DesktopUsageState | null>> {
    const uniqueConnectionIds = [...new Set(connectionIds.filter((connectionId): connectionId is string => Boolean(connectionId)))];
    const forceRefresh = options?.force ?? false;
    const shouldRefresh = uniqueConnectionIds.filter((connectionId) =>
      forceRefresh || !this.hasFreshUsageCache(connectionId),
    );

    if (shouldRefresh.length > 0) {
      await this.refreshBatch(session, shouldRefresh);
    }

    const now = Date.now();
    const result = new Map<string, DesktopUsageState | null>();
    for (const connectionId of uniqueConnectionIds) {
      if (!this.usageByConnectionId.has(connectionId)) {
        this.usageByConnectionId.set(connectionId, null);
        this.usageReadAt.set(connectionId, now);
      }
      result.set(connectionId, this.usageByConnectionId.get(connectionId) ?? null);
    }
    return result;
  }

  private async refreshBatch(session: NileSession, connectionIds: string[]): Promise<void> {
    const queue = [...connectionIds];
    const workerCount = Math.min(DesktopUsageCache.REFRESH_CONCURRENCY, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const connectionId = queue.shift();
        if (!connectionId) {
          return;
        }
        const summary = await this.readUsageSummary(session, connectionId);
        this.usageByConnectionId.set(connectionId, summary);
        this.usageReadAt.set(connectionId, Date.now());
      }
    });
    await Promise.all(workers);
  }

  private hasFreshUsageCache(connectionId: string): boolean {
    const readAt = this.usageReadAt.get(connectionId);
    if (typeof readAt !== "number") {
      return false;
    }
    return Date.now() - readAt <= DesktopUsageCache.CACHE_TTL_MS;
  }

  private async readUsageSummary(
    session: NileSession,
    connectionId: string,
  ): Promise<DesktopUsageState | null> {
    try {
      const result = await session.getConnectionUsage(connectionId);
      return UsageSummary.fromResult(result);
    } catch (error) {
      this.logger.warn("desktop.usage.read_failed", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
