import { dirname, join } from "node:path";

import { readOptionalTextFile } from "@nile/core/services/OptionalTextFile";

type ClaudeGatewayModelCache = {
  baseUrl?: unknown;
  models?: unknown;
};

export class ClaudeGatewayModelCatalog {
  constructor(private readonly settingsPath: string) {}

  readModels(baseUrl?: string): string[] {
    if (!baseUrl) {
      return [];
    }

    const cache = this.readCache();
    if (!cache) {
      return [];
    }

    const cacheBaseUrl = typeof cache.baseUrl === "string" ? cache.baseUrl.trim() : "";
    if (!cacheBaseUrl || this.normalizeUrl(cacheBaseUrl) !== this.normalizeUrl(baseUrl)) {
      return [];
    }

    if (!Array.isArray(cache.models)) {
      return [];
    }

    return cache.models.flatMap((model) => {
      if (!model || typeof model !== "object" || Array.isArray(model)) {
        return [];
      }
      const id = (model as Record<string, unknown>).id;
      return typeof id === "string" && id.trim() ? [id.trim()] : [];
    });
  }

  selectPreferredModel(models: string[]): string | null {
    const ranked = models
      .map((model) => ({ model, score: this.rankModel(model) }))
      .filter((candidate): candidate is { model: string; score: number[] } => candidate.score !== null)
      .sort((left, right) => this.compareRank(right.score, left.score));

    return ranked[0]?.model ?? null;
  }

  private readCache(): ClaudeGatewayModelCache | null {
    const cachePath = join(dirname(this.settingsPath), "cache", "gateway-models.json");
    const raw = readOptionalTextFile(cachePath, "Claude gateway model cache");
    if (!raw?.trim()) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as ClaudeGatewayModelCache;
  }

  private rankModel(model: string): number[] | null {
    const match = /^claude-(sonnet|opus|haiku)-(.+)$/.exec(model);
    if (!match) {
      return null;
    }

    const family = match[1];
    const version = match[2];
    const familyWeight = family === "sonnet" ? 3 : family === "opus" ? 2 : 1;
    const normalizedVersion = version.replace(/\./g, "-");
    const parts = normalizedVersion.split("-").filter(Boolean);
    const numericParts = parts
      .filter((part) => /^\d+$/.test(part))
      .map((part) => Number.parseInt(part, 10));
    const hasDateSuffix = numericParts.length >= 3 && numericParts[numericParts.length - 1] > 10000000;
    const date = hasDateSuffix ? numericParts.pop() ?? 0 : 0;
    const major = numericParts[0] ?? 0;
    const minor = numericParts[1] ?? 0;
    const patch = numericParts[2] ?? 0;
    const exactStyleWeight = version.includes(".") ? 0 : 1;

    return [familyWeight, major, minor, patch, date, exactStyleWeight];
  }

  private compareRank(left: number[], right: number[]): number {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const delta = (left[index] ?? 0) - (right[index] ?? 0);
      if (delta !== 0) {
        return delta;
      }
    }
    return 0;
  }

  private normalizeUrl(value: string): string {
    return value.trim().replace(/\/+$/, "");
  }
}
