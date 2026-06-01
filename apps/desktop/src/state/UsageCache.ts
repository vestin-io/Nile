import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { NileSession } from "@nile/builtins/runtime";
import type { NileLogger } from "@nile/core/services/NileLogger";
import type { ConnectionUsageResult } from "@nile/core/actions/usage/Result";

import { type DesktopUsageState, UsageSummary } from "./UsageSummary";

export type DesktopUsageRefreshMode = "auto" | "manual";
export type DesktopUsageRefreshResult = {
  refreshedConnectionIds: string[];
  usageByConnectionId: Map<string, DesktopUsageState | null>;
};

export class DesktopUsageCache {
  private static readonly CACHE_TTL_MS = 300_000;
  private static readonly REFRESH_CONCURRENCY = 4;

  private readonly usageByConnectionId = new Map<string, DesktopUsageState | null>();
  private readonly usageReadAt = new Map<string, number>();
  private readonly autoRefreshPausedConnectionIds = new Set<string>();

  constructor(private readonly logger: NileLogger) {}

  static readCacheTtlMs(): number {
    return DesktopUsageCache.CACHE_TTL_MS;
  }

  peek(connectionId: string): DesktopUsageState | null {
    return this.usageByConnectionId.get(connectionId) ?? null;
  }

  snapshotByConnectionId(savedConnections: SavedConnectionSummary[]): Map<string, DesktopUsageState | null> {
    const result = new Map<string, DesktopUsageState | null>();
    for (const connection of savedConnections) {
      result.set(connection.id, this.peek(connection.id));
    }
    return result;
  }

  async readByConnectionId(
    session: NileSession,
    savedConnections: SavedConnectionSummary[],
    options?: { mode?: DesktopUsageRefreshMode },
  ): Promise<Map<string, DesktopUsageState | null>> {
    const result = await this.refreshByConnectionId(
      session,
      savedConnections.map((connection) => connection.id),
      {
        mode: options?.mode,
      },
    );
    return result.usageByConnectionId;
  }

  canAutoRefresh(connectionId: string): boolean {
    return !this.autoRefreshPausedConnectionIds.has(connectionId);
  }

  async refreshByConnectionId(
    session: NileSession,
    connectionIds: Array<string | null>,
    options?: { force?: boolean; mode?: DesktopUsageRefreshMode },
  ): Promise<DesktopUsageRefreshResult> {
    const uniqueConnectionIds = [...new Set(connectionIds.filter((connectionId): connectionId is string => Boolean(connectionId)))];
    const forceRefresh = options?.force ?? false;
    const refreshMode = options?.mode ?? "auto";
    const refreshedConnectionIds = uniqueConnectionIds.filter((connectionId) =>
      (refreshMode === "manual" || !this.autoRefreshPausedConnectionIds.has(connectionId))
        && (forceRefresh || !this.hasFreshUsageCache(connectionId)),
    );

    if (refreshedConnectionIds.length > 0) {
      await this.refreshBatch(session, refreshedConnectionIds, refreshMode);
    }

    const now = Date.now();
    const usageByConnectionId = new Map<string, DesktopUsageState | null>();
    for (const connectionId of uniqueConnectionIds) {
      if (!this.usageByConnectionId.has(connectionId)) {
        this.usageByConnectionId.set(connectionId, null);
        this.usageReadAt.set(connectionId, now);
      }
      usageByConnectionId.set(connectionId, this.usageByConnectionId.get(connectionId) ?? null);
    }
    return {
      refreshedConnectionIds,
      usageByConnectionId,
    };
  }

  private async refreshBatch(
    session: NileSession,
    connectionIds: string[],
    refreshMode: DesktopUsageRefreshMode,
  ): Promise<void> {
    const queue = [...connectionIds];
    const workerCount = Math.min(DesktopUsageCache.REFRESH_CONCURRENCY, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const connectionId = queue.shift();
        if (!connectionId) {
          return;
        }
        const result = await this.readUsageSummary(session, connectionId, refreshMode);
        this.usageByConnectionId.set(connectionId, result.summary);
        if (result.cacheable) {
          this.usageReadAt.set(connectionId, Date.now());
          this.autoRefreshPausedConnectionIds.delete(connectionId);
        } else {
          this.usageReadAt.delete(connectionId);
          this.autoRefreshPausedConnectionIds.add(connectionId);
        }
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
    refreshMode: DesktopUsageRefreshMode,
  ): Promise<{ cacheable: boolean; summary: DesktopUsageState | null }> {
    try {
      const result = await session.getConnectionUsage(connectionId, {
        recoverUnauthorizedCurrentSession: refreshMode === "manual",
      });
      const summary = UsageSummary.fromResult(result);
      this.logGeminiQuotaResult(result, summary);
      return {
        cacheable: result.status !== "error",
        summary,
      };
    } catch (error) {
      this.logger.warn("desktop.usage.read_failed", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        cacheable: false,
        summary: null,
      };
    }
  }

  private logGeminiQuotaResult(
    result: ConnectionUsageResult,
    summary: DesktopUsageState | null,
  ): void {
    if (result.endpointFamily !== "gemini") {
      return;
    }

    this.logger.info("desktop.gemini.quota.read_result", {
      connectionId: result.connectionId,
      status: result.status,
      source: result.source,
      windowCount: result.windows.length,
      summaryVisible: summary !== null,
      ...(result.message?.trim() ? { message: result.message.trim() } : {}),
    });
  }
}
