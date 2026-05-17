import type { ConnectionModelCatalogResult } from "@nile/core/models/connection";

type Entry = {
  result: ConnectionModelCatalogResult;
  fetchedAtMs: number;
};

type DesktopConnectionModelCatalogOptions = {
  ttlMs?: number;
  now?: () => number;
};

export class DesktopConnectionModelCatalog {
  static readonly defaultTtlMs = 10 * 60 * 1000;

  private readonly cache = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: DesktopConnectionModelCatalogOptions = {}) {
    this.ttlMs = options.ttlMs ?? DesktopConnectionModelCatalog.defaultTtlMs;
    this.now = options.now ?? Date.now;
  }

  async read(
    connectionId: string,
    reader: () => Promise<ConnectionModelCatalogResult>,
    options: { forceRefresh?: boolean } = {},
  ): Promise<ConnectionModelCatalogResult> {
    if (!options.forceRefresh) {
      const cached = this.cache.get(connectionId);
      if (cached && this.now() - cached.fetchedAtMs < this.ttlMs) {
        return cached.result;
      }
    }

    const result = await reader();
    this.cache.set(connectionId, {
      result,
      fetchedAtMs: this.now(),
    });
    return result;
  }

  clear(connectionId?: string): void {
    if (connectionId) {
      this.cache.delete(connectionId);
      return;
    }
    this.cache.clear();
  }
}
