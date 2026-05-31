import type {
  OpenAiSessionCredential,
  OpenClawOpenAiSessionCredential,
} from "../../services/credential/Types";
import type { ConnectionUsageResult, ConnectionUsageWindow } from "./Result";

const CHATGPT_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_USER_AGENT = "codex-cli/0.27.0";
const USAGE_REQUEST_TIMEOUT_MS = 10_000;

type OpenAiSessionUsageReaderInput = {
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  credential: OpenAiSessionCredential | OpenClawOpenAiSessionCredential;
};

type OpenAiUsagePayload = {
  plan_type?: string;
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: OpenAiUsageWindowPayload;
    secondary_window?: OpenAiUsageWindowPayload;
  };
  additional_rate_limits?: OpenAiAdditionalRateLimitPayload[] | null;
};

type OpenAiUsageWindowPayload = {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_at?: number;
};

type OpenAiAdditionalRateLimitPayload = {
  limit_name?: string;
  metered_feature?: string;
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: OpenAiUsageWindowPayload;
    secondary_window?: OpenAiUsageWindowPayload;
  };
};

export class OpenAiSessionUsageReader {
  async read(input: OpenAiSessionUsageReaderInput): Promise<ConnectionUsageResult> {
    let response: Response;
    try {
      response = await this.fetchUsage(input.credential.accessToken, input.credential.accountId);
    } catch (error) {
      return this.buildErrorResult(input, this.readFetchErrorMessage(error));
    }

    if (response.status === 401 || response.status === 403) {
      return this.buildErrorResult(
        input,
        "OpenAI session is expired or unauthorized. Sign in to Codex again and retry.",
        "credential_unauthorized",
      );
    }
    if (!response.ok) {
      return this.buildErrorResult(input, `Quota request failed with status ${response.status}`);
    }

    let payload: OpenAiUsagePayload;
    try {
      payload = await response.json() as OpenAiUsagePayload;
    } catch {
      return this.buildErrorResult(input, "Quota response could not be parsed");
    }

    const windows = this.buildWindows(payload);
    if (windows.length === 0) {
      return {
        connectionId: input.connectionId,
        connectionLabel: input.connectionLabel,
        endpointFamily: "openai",
        endpointLabel: input.endpointLabel,
        status: "unavailable",
        source: "remote_api",
        planLabel: this.mapPlanLabel(payload.plan_type),
        message: "Quota response did not include recognizable quota windows",
        windows: [],
      };
    }

    return {
      connectionId: input.connectionId,
      connectionLabel: input.connectionLabel,
      endpointFamily: "openai",
      endpointLabel: input.endpointLabel,
      status: "available",
      source: "remote_api",
      planLabel: this.mapPlanLabel(payload.plan_type),
      windows,
    };
  }

  private async fetchUsage(accessToken: string, accountId?: string): Promise<Response> {
    return await this.fetchWithTimeout(CHATGPT_USAGE_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "user-agent": CODEX_USER_AGENT,
        ...(accountId ? { "chatgpt-account-id": accountId } : {}),
      },
    });
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), USAGE_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private readFetchErrorMessage(error: unknown): string {
    if (this.isAbortError(error)) {
      return `Quota request timed out after ${USAGE_REQUEST_TIMEOUT_MS}ms`;
    }
    return error instanceof Error
      ? `Quota request failed: ${error.message}`
      : "Quota request failed";
  }

  private isAbortError(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("name" in error)) {
      return false;
    }
    return (error as { name?: string }).name === "AbortError";
  }

  private buildErrorResult(
    input: OpenAiSessionUsageReaderInput,
    message: string,
    errorCode?: "credential_unauthorized",
  ): ConnectionUsageResult {
    return {
      connectionId: input.connectionId,
      connectionLabel: input.connectionLabel,
      endpointFamily: "openai",
      endpointLabel: input.endpointLabel,
      status: "error",
      source: "remote_api",
      message,
      ...(errorCode ? { errorCode } : {}),
      windows: [],
    };
  }

  private buildWindows(payload: OpenAiUsagePayload): ConnectionUsageWindow[] {
    const windows: ConnectionUsageWindow[] = [];

    const primary = this.buildWindow("primary", "5h", payload.rate_limit?.primary_window, payload.rate_limit);
    if (primary) {
      windows.push(primary);
    }

    const secondary = this.buildWindow("secondary", "7d", payload.rate_limit?.secondary_window, payload.rate_limit);
    if (secondary) {
      windows.push(secondary);
    }

    for (const limit of payload.additional_rate_limits ?? []) {
      const additional = this.buildWindow(
        "additional",
        limit.limit_name ?? limit.metered_feature ?? "Additional limit",
        limit.rate_limit?.primary_window ?? limit.rate_limit?.secondary_window,
        limit.rate_limit,
        limit.metered_feature,
      );
      if (additional) {
        windows.push(additional);
      }
    }

    return windows;
  }

  private buildWindow(
    kind: ConnectionUsageWindow["kind"],
    label: string,
    payload: OpenAiUsageWindowPayload | undefined,
    rateLimit?: { allowed?: boolean; limit_reached?: boolean },
    featureName?: string,
  ): ConnectionUsageWindow | null {
    if (!payload) {
      return null;
    }

    const usedPercent = typeof payload.used_percent === "number" ? payload.used_percent : null;
    return {
      kind,
      label,
      usedPercent,
      remainingPercent: usedPercent === null ? null : Math.max(0, 100 - usedPercent),
      windowSeconds: typeof payload.limit_window_seconds === "number" ? payload.limit_window_seconds : null,
      resetsAt: typeof payload.reset_at === "number" ? new Date(payload.reset_at * 1000).toISOString() : null,
      allowed: rateLimit?.allowed,
      limitReached: rateLimit?.limit_reached,
      featureName,
    };
  }

  private mapPlanLabel(planType?: string): string | undefined {
    if (!planType) {
      return undefined;
    }
    if (planType === "prolite") {
      return "Pro Lite";
    }
    if (planType === "plus") {
      return "Plus";
    }
    return planType.charAt(0).toUpperCase() + planType.slice(1);
  }
}
