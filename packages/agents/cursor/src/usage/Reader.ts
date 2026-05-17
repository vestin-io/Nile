import type { AccessRecord } from "@nile/core/models/access";
import type { ConnectionUsageResult } from "@nile/core/actions/usage";
import { CursorUsageIdentity, CursorUsageIdentityError } from "./Identity";
import { CursorUsageBindingRegistry } from "./BindingRegistry";
import { CursorUsageSnapshotStore } from "./SnapshotStore";
import type {
  CursorAccountFingerprint,
  CursorUsageSnapshotFreshness,
  CursorUsageSnapshotRecord,
} from "./Types";

const CURSOR_USAGE_URL = "https://cursor.com/api/usage-summary";
const REQUEST_TIMEOUT_MS = 10_000;

type ReaderInput = {
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  access: Pick<AccessRecord, "id" | "identityKey">;
};

type CursorUsagePayload = {
  billingCycleStart?: unknown;
  billingCycleEnd?: unknown;
  individualUsage?: {
    plan?: {
      totalPercentUsed?: unknown;
      autoPercentUsed?: unknown;
      apiPercentUsed?: unknown;
    };
  };
};

export class CursorUsageReader {
  constructor(
    private readonly bindingRegistry: CursorUsageBindingRegistry,
    private readonly snapshotStore: CursorUsageSnapshotStore,
  ) {}

  async read(input: ReaderInput): Promise<ConnectionUsageResult> {
    const localFingerprint = CursorUsageIdentity.fromSavedAccess(input.access);
    const snapshot = this.snapshotStore.get(input.connectionId);
    const binding = this.bindingRegistry.get(input.connectionId);

    if (!binding) {
      return this.buildFallbackResult(input, snapshot, "Bind a Cursor web session for this connection to enable live usage.");
    }

    if (!CursorUsageIdentity.matches(localFingerprint, binding.accountFingerprint)) {
      this.bindingRegistry.clear(input.connectionId);
      return this.buildFallbackResult(
        input,
        this.snapshotStore.updateFreshness(input.connectionId, this.readFailureFreshness(snapshot, true)),
        "Cursor usage binding no longer matches the saved connection identity.",
      );
    }

    const boundCredential = this.bindingRegistry.readCredential(input.connectionId);
    let webFingerprint;
    try {
      webFingerprint = CursorUsageIdentity.fromUsageSessionToken(boundCredential.sessionToken);
    } catch (error) {
      if (error instanceof CursorUsageIdentityError) {
        this.bindingRegistry.clear(input.connectionId);
        return this.buildFallbackResult(
          input,
          this.snapshotStore.updateFreshness(input.connectionId, this.readFailureFreshness(snapshot, true)),
          error.message,
        );
      }
      throw error;
    }

    if (!CursorUsageIdentity.matches(localFingerprint, webFingerprint)) {
      this.bindingRegistry.clear(input.connectionId);
      return this.buildFallbackResult(
        input,
        this.snapshotStore.updateFreshness(input.connectionId, this.readFailureFreshness(snapshot, true)),
        "Cursor web session belongs to a different account than the saved connection.",
      );
    }

    let response: Response;
    try {
      response = await this.fetchUsage(boundCredential.sessionToken, webFingerprint.workosUserId);
    } catch (error) {
      return this.buildFallbackResult(
        input,
        this.snapshotStore.updateFreshness(input.connectionId, this.readFailureFreshness(snapshot, false)),
        this.readFetchErrorMessage(error),
      );
    }

    if (response.status === 401) {
      this.bindingRegistry.clear(input.connectionId);
      return this.buildFallbackResult(
        input,
        this.snapshotStore.updateFreshness(input.connectionId, this.readFailureFreshness(snapshot, true)),
        "Cursor web session expired and was cleared.",
      );
    }

    if (!response.ok) {
      return this.buildFallbackResult(
        input,
        this.snapshotStore.updateFreshness(input.connectionId, this.readFailureFreshness(snapshot, false)),
        `Cursor usage request failed with status ${response.status}`,
      );
    }

    const payload = await response.json() as CursorUsagePayload;
    const snapshotInput = this.readSnapshotPayload(input.connectionId, localFingerprint, payload);
    if (!snapshotInput) {
      return this.buildFallbackResult(
        input,
        this.snapshotStore.updateFreshness(input.connectionId, this.readFailureFreshness(snapshot, false)),
        "Cursor usage response did not include recognizable usage fields.",
      );
    }

    const saved = this.snapshotStore.save(snapshotInput);
    return this.buildSnapshotResult(input, saved, "remote_api");
  }

  private async fetchUsage(sessionToken: string, workosUserId: string): Promise<Response> {
    return await this.fetchWithTimeout(CURSOR_USAGE_URL, {
      headers: {
        cookie: this.buildCookieHeader(sessionToken, workosUserId),
        "user-agent": "nile/1.0",
      },
    });
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

  private readSnapshotPayload(
    connectionId: string,
    fingerprint: CursorAccountFingerprint,
    payload: CursorUsagePayload,
  ) {
    const plan = payload.individualUsage?.plan;
    if (!plan) {
      return null;
    }

    const totalPercentUsed = this.readPercent(plan.totalPercentUsed);
    const autoPercentUsed = this.readPercent(plan.autoPercentUsed);
    const apiPercentUsed = this.readPercent(plan.apiPercentUsed);
    const billingCycleStart = this.readTimestamp(payload.billingCycleStart);
    const billingCycleEnd = this.readTimestamp(payload.billingCycleEnd);

    if (
      totalPercentUsed === null
      || autoPercentUsed === null
      || apiPercentUsed === null
      || billingCycleStart === null
      || billingCycleEnd === null
    ) {
      return null;
    }

    return {
      connectionId,
      accountFingerprint: fingerprint,
      totalPercentUsed,
      autoPercentUsed,
      apiPercentUsed,
      billingCycleStart,
      billingCycleEnd,
      fetchedAt: new Date().toISOString(),
      freshness: "live" as const,
    };
  }

  private buildCookieHeader(sessionToken: string, workosUserId: string): string {
    const normalized = CursorUsageIdentity.normalizeToken(sessionToken);
    return [
      `workos_id=${workosUserId}`,
      `WorkosCursorSessionToken=${encodeURIComponent(normalized)}`,
      `cursor-web-target-synced-user=${workosUserId}`,
    ].join("; ");
  }

  private buildFallbackResult(
    input: ReaderInput,
    snapshot: CursorUsageSnapshotRecord | null,
    message: string,
  ): ConnectionUsageResult {
    if (!snapshot) {
      return {
        connectionId: input.connectionId,
        connectionLabel: input.connectionLabel,
        endpointFamily: "cursor",
        endpointLabel: input.endpointLabel,
        status: "unavailable",
        source: "remote_api",
        message,
        windows: [],
      };
    }

    return this.buildSnapshotResult(input, snapshot, "local_artifact", message);
  }

  private buildSnapshotResult(
    input: ReaderInput,
    snapshot: CursorUsageSnapshotRecord,
    source: "remote_api" | "local_artifact",
    message?: string,
  ): ConnectionUsageResult {
    const windows = [
      this.buildWindow("primary", "Total", snapshot.totalPercentUsed, snapshot),
      this.buildWindow("secondary", "Auto + Composer", snapshot.autoPercentUsed, snapshot),
      this.buildWindow("additional", "API", snapshot.apiPercentUsed, snapshot),
    ];

    return {
      connectionId: input.connectionId,
      connectionLabel: input.connectionLabel,
      endpointFamily: "cursor",
      endpointLabel: input.endpointLabel,
      status: "available",
      source,
      freshness: snapshot.freshness,
      lastFetchedAt: snapshot.fetchedAt,
      planLabel: "Cursor",
      ...(message ? { message } : {}),
      windows,
    };
  }

  private buildWindow(
    kind: "primary" | "secondary" | "additional",
    label: string,
    usedPercent: number,
    snapshot: CursorUsageSnapshotRecord,
  ) {
    const start = new Date(snapshot.billingCycleStart).getTime();
    const end = new Date(snapshot.billingCycleEnd).getTime();
    return {
      kind,
      label,
      usedPercent,
      remainingPercent: Math.max(0, 100 - usedPercent),
      windowSeconds: Number.isNaN(start) || Number.isNaN(end) ? null : Math.max(0, Math.round((end - start) / 1000)),
      resetsAt: snapshot.billingCycleEnd,
    };
  }

  private readFailureFreshness(
    snapshot: CursorUsageSnapshotRecord | null,
    bindingWasInvalidated: boolean,
  ): CursorUsageSnapshotFreshness {
    if (!snapshot) {
      return "stale";
    }
    if (Date.now() >= new Date(snapshot.billingCycleEnd).getTime()) {
      return "expired";
    }
    if (bindingWasInvalidated) {
      return "stale";
    }
    return "cached";
  }

  private readPercent(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    if (value <= 1) {
      return Math.max(0, Math.min(100, value * 100));
    }
    return Math.max(0, Math.min(100, value));
  }

  private readFetchErrorMessage(error: unknown): string {
    if (this.isAbortError(error)) {
      return `Cursor usage request timed out after ${REQUEST_TIMEOUT_MS}ms`;
    }
    return error instanceof Error
      ? `Cursor usage request failed: ${error.message}`
      : "Cursor usage request failed";
  }

  private isAbortError(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("name" in error)) {
      return false;
    }
    return (error as { name?: string }).name === "AbortError";
  }

  private readTimestamp(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
