import type { GeminiCliSessionCredential } from "../../services/credential/Types";
import type { ConnectionUsageResult, ConnectionUsageWindow } from "./Result";

const LOAD_CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const RETRIEVE_USER_QUOTA_URL = "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota";
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "nile/1.0";

type ReaderInput = {
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  credential: GeminiCliSessionCredential;
};

type GeminiLoadCodeAssistPayload = {
  cloudaicompanionProject?: unknown;
};

type GeminiRetrieveQuotaPayload = {
  buckets?: GeminiQuotaBucketPayload[] | null;
};

type GeminiQuotaBucketPayload = {
  modelId?: unknown;
  remainingFraction?: unknown;
  resetTime?: unknown;
};

type GeminiTier = "pro" | "flash" | "flash-lite";

type DedupedQuota = {
  label: string;
  remainingFraction: number;
  resetsAt: string | null;
};

export class GeminiSessionUsageReader {
  async read(input: ReaderInput): Promise<ConnectionUsageResult> {
    const projectId = await this.readProjectId(input);
    if (projectId.kind !== "ok") {
      return projectId.result;
    }

    let response: Response;
    try {
      response = await this.fetchQuota(input.credential, projectId.value);
    } catch (error) {
      return this.buildError(input, this.readFetchErrorMessage(error));
    }

    if (response.status === 401 || response.status === 403) {
      return this.buildError(
        input,
        "Gemini session is expired or unauthorized. Refresh the Gemini CLI session and try again.",
      );
    }
    if (!response.ok) {
      return this.buildError(input, `Gemini usage request failed with status ${response.status}`);
    }

    let payload: GeminiRetrieveQuotaPayload;
    try {
      payload = await response.json() as GeminiRetrieveQuotaPayload;
    } catch {
      return this.buildError(input, "Gemini usage response could not be parsed");
    }

    const windows = this.readWindows(payload);
    if (windows.length === 0) {
      return {
        connectionId: input.connectionId,
        connectionLabel: input.connectionLabel,
        endpointFamily: "gemini",
        endpointLabel: input.endpointLabel,
        status: "unavailable",
        source: "remote_api",
        planLabel: "Gemini",
        message: "Gemini usage response did not include recognizable quota buckets",
        windows: [],
      };
    }

    return {
      connectionId: input.connectionId,
      connectionLabel: input.connectionLabel,
      endpointFamily: "gemini",
      endpointLabel: input.endpointLabel,
      status: "available",
      source: "remote_api",
      planLabel: "Gemini",
      windows,
    };
  }

  private async readProjectId(
    input: ReaderInput,
  ): Promise<
    | { kind: "ok"; value: string }
    | { kind: "error"; result: ConnectionUsageResult }
  > {
    let response: Response;
    try {
      response = await this.fetchLoadCodeAssist(input.credential);
    } catch (error) {
      return {
        kind: "error",
        result: this.buildError(input, this.readFetchErrorMessage(error)),
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        kind: "error",
        result: this.buildError(
          input,
          "Gemini session is expired or unauthorized. Refresh the Gemini CLI session and try again.",
        ),
      };
    }
    if (!response.ok) {
      return {
        kind: "error",
        result: this.buildError(
          input,
          `Gemini project discovery failed with status ${response.status}`,
        ),
      };
    }

    let payload: GeminiLoadCodeAssistPayload;
    try {
      payload = await response.json() as GeminiLoadCodeAssistPayload;
    } catch {
      return {
        kind: "error",
        result: this.buildError(input, "Gemini project discovery response could not be parsed"),
      };
    }

    const projectId = this.extractProjectId(payload.cloudaicompanionProject);
    if (!projectId) {
      return {
        kind: "error",
        result: {
          connectionId: input.connectionId,
          connectionLabel: input.connectionLabel,
          endpointFamily: "gemini",
          endpointLabel: input.endpointLabel,
          status: "unavailable",
          source: "remote_api",
          planLabel: "Gemini",
          message: "Gemini usage project metadata is unavailable for this session.",
          windows: [],
        },
      };
    }

    return {
      kind: "ok",
      value: projectId,
    };
  }

  private async fetchLoadCodeAssist(credential: GeminiCliSessionCredential): Promise<Response> {
    return await this.fetchWithTimeout(LOAD_CODE_ASSIST_URL, {
      method: "POST",
      headers: this.buildHeaders(credential),
      body: JSON.stringify({
        metadata: {
          pluginType: "GEMINI",
        },
      }),
    });
  }

  private async fetchQuota(
    credential: GeminiCliSessionCredential,
    projectId: string,
  ): Promise<Response> {
    return await this.fetchWithTimeout(RETRIEVE_USER_QUOTA_URL, {
      method: "POST",
      headers: this.buildHeaders(credential),
      body: JSON.stringify({ project: projectId }),
    });
  }

  private buildHeaders(credential: GeminiCliSessionCredential): Record<string, string> {
    const tokenType = credential.tokenType?.trim() || "Bearer";
    return {
      authorization: `${tokenType} ${credential.accessToken}`,
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private readWindows(payload: GeminiRetrieveQuotaPayload): ConnectionUsageWindow[] {
    const buckets = Array.isArray(payload.buckets) ? payload.buckets : [];
    const perModel = new Map<string, { remainingFraction: number; resetsAt: string | null }>();
    for (const bucket of buckets) {
      const modelId = this.readBucketModelId(bucket);
      const remainingFraction = this.readBucketRemainingFraction(bucket);
      if (!modelId || remainingFraction === null) {
        continue;
      }

      const current = perModel.get(modelId);
      const resetsAt = this.normalizeResetTime(bucket.resetTime);
      if (!current || remainingFraction < current.remainingFraction) {
        perModel.set(modelId, { remainingFraction, resetsAt });
      }
    }

    const quotas = this.dedupeAliases(perModel);
    return quotas.map((quota, index) => ({
      kind: index === 0 ? "primary" : "additional",
      label: quota.label,
      usedPercent: Math.max(0, Math.min(100, 100 - (quota.remainingFraction * 100))),
      remainingPercent: Math.max(0, Math.min(100, quota.remainingFraction * 100)),
      windowSeconds: null,
      resetsAt: quota.resetsAt,
    }));
  }

  private dedupeAliases(
    perModel: ReadonlyMap<string, { remainingFraction: number; resetsAt: string | null }>,
  ): DedupedQuota[] {
    const grouped = new Map<string, { modelId: string; remainingFraction: number; resetsAt: string | null }>();
    for (const [modelId, data] of perModel.entries()) {
      const tier = this.readTier(modelId);
      const key = `${tier ?? `model:${modelId}`}:${data.remainingFraction}:${data.resetsAt ?? ""}`;
      const existing = grouped.get(key);
      if (!existing || this.isPreferredModel(modelId, existing.modelId)) {
        grouped.set(key, {
          modelId,
          remainingFraction: data.remainingFraction,
          resetsAt: data.resetsAt,
        });
      }
    }

    return [...grouped.values()]
      .map((entry) => ({
        label: this.readTierLabel(entry.modelId),
        remainingFraction: entry.remainingFraction,
        resetsAt: entry.resetsAt,
      }))
      .sort((left, right) =>
        left.remainingFraction === right.remainingFraction
          ? left.label.localeCompare(right.label)
          : left.remainingFraction - right.remainingFraction,
      );
  }

  private readTier(modelId: string): GeminiTier | null {
    const lower = modelId.toLowerCase();
    if (lower.includes("flash-lite")) {
      return "flash-lite";
    }
    if (lower.includes("flash")) {
      return "flash";
    }
    if (lower.includes("pro")) {
      return "pro";
    }
    return null;
  }

  private readTierLabel(modelId: string): string {
    const tier = this.readTier(modelId);
    if (tier === "pro") {
      return "Pro";
    }
    if (tier === "flash") {
      return "Flash";
    }
    if (tier === "flash-lite") {
      return "Flash Lite";
    }
    return modelId;
  }

  private isPreferredModel(candidate: string, existing: string): boolean {
    const candidatePreview = candidate.toLowerCase().includes("preview");
    const existingPreview = existing.toLowerCase().includes("preview");
    if (candidatePreview !== existingPreview) {
      return !candidatePreview;
    }

    const candidateScore = this.readVersionScore(candidate);
    const existingScore = this.readVersionScore(existing);
    if (candidateScore !== existingScore) {
      return candidateScore > existingScore;
    }
    return candidate.localeCompare(existing) < 0;
  }

  private readVersionScore(modelId: string): number {
    const stripped = modelId.toLowerCase().replace(/^gemini-/, "");
    const head = stripped.split("-")[0];
    if (!head) {
      return 0;
    }

    const numericParts = head.split(".").map((segment) => Number(segment));
    const major = numericParts[0];
    if (!Number.isFinite(major)) {
      return 0;
    }
    const minor = Number.isFinite(numericParts[1]) ? numericParts[1]! : 0;
    return major + (minor / 100);
  }

  private readBucketModelId(bucket: GeminiQuotaBucketPayload): string | null {
    return typeof bucket.modelId === "string" && bucket.modelId.trim()
      ? bucket.modelId
      : null;
  }

  private readBucketRemainingFraction(bucket: GeminiQuotaBucketPayload): number | null {
    return typeof bucket.remainingFraction === "number" && Number.isFinite(bucket.remainingFraction)
      ? Math.max(0, Math.min(1, bucket.remainingFraction))
      : null;
  }

  private normalizeResetTime(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private buildError(input: ReaderInput, message: string): ConnectionUsageResult {
    return {
      connectionId: input.connectionId,
      connectionLabel: input.connectionLabel,
      endpointFamily: "gemini",
      endpointLabel: input.endpointLabel,
      status: "error",
      source: "remote_api",
      planLabel: "Gemini",
      message,
      windows: [],
    };
  }

  private readFetchErrorMessage(error: unknown): string {
    if (this.isAbortError(error)) {
      return `Gemini usage request timed out after ${REQUEST_TIMEOUT_MS}ms`;
    }
    return error instanceof Error
      ? `Gemini usage request failed: ${error.message}`
      : "Gemini usage request failed";
  }

  private isAbortError(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("name" in error)) {
      return false;
    }
    return (error as { name?: string }).name === "AbortError";
  }

  private readString(payload: Record<string, unknown>, field: string): string | null {
    const value = payload[field];
    return typeof value === "string" && value.trim() ? value : null;
  }

  private extractProjectId(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const projectId = record.id ?? record.projectId;
    return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
  }
}
