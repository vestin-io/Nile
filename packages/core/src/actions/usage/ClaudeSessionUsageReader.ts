import type { ClaudeSessionCredential } from "../../services/credential/Types";
import type { ConnectionUsageResult, ConnectionUsageWindow } from "./Result";

const OAUTH_BETA_HEADER = "oauth-2025-04-20";
const OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const OAUTH_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const OAUTH_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

type ReaderInput = {
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  credential: ClaudeSessionCredential;
};

type RawWindow = {
  utilization?: unknown;
  resets_at?: unknown;
  resetsAt?: unknown;
};

export class ClaudeSessionUsageReader {
  async read(input: ReaderInput): Promise<ConnectionUsageResult> {
    const credential = await this.refreshIfNeeded(input.credential);
    let response: Response;
    try {
      response = await this.fetchUsage(credential.accessToken);
    } catch (error) {
      return this.buildError(input, this.readFetchErrorMessage(error));
    }

    if (response.status === 401) {
      const refreshed = await this.refreshCredential(credential);
      if (!refreshed) {
        return this.buildError(input, "Claude session is expired and could not be refreshed");
      }

      let retry: Response;
      try {
        retry = await this.fetchUsage(refreshed.accessToken);
      } catch (error) {
        return this.buildError(input, this.readFetchErrorMessage(error));
      }
      return this.buildResult(input, retry);
    }

    return this.buildResult(input, response);
  }

  private async refreshIfNeeded(credential: ClaudeSessionCredential): Promise<ClaudeSessionCredential> {
    if (!this.isExpired(credential.expiresAt)) {
      return credential;
    }

    return await this.refreshCredential(credential) ?? credential;
  }

  private isExpired(expiresAt?: number): boolean {
    return typeof expiresAt === "number" && Date.now() + EXPIRY_BUFFER_MS >= expiresAt;
  }

  private async refreshCredential(credential: ClaudeSessionCredential): Promise<ClaudeSessionCredential | null> {
    if (!credential.refreshToken.trim()) {
      return null;
    }

    let response: Response;
    try {
      response = await this.fetchWithTimeout(OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "nile/1.0",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: credential.refreshToken,
          client_id: OAUTH_CLIENT_ID,
        }),
      });
    } catch {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as Record<string, unknown>;
    const accessToken = this.readString(payload, "access_token");
    const expiresIn = this.readNumber(payload, "expires_in");
    if (!accessToken || !expiresIn) {
      return null;
    }

    return {
      ...credential,
      accessToken,
      expiresAt: Date.now() + (expiresIn * 1000),
      ...(this.readString(payload, "refresh_token") ? { refreshToken: this.readString(payload, "refresh_token")! } : {}),
    };
  }

  private async fetchUsage(accessToken: string): Promise<Response> {
    return await this.fetchWithTimeout(OAUTH_USAGE_URL, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "anthropic-beta": OAUTH_BETA_HEADER,
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

  private async buildResult(input: ReaderInput, response: Response): Promise<ConnectionUsageResult> {
    if (!response.ok) {
      return this.buildError(input, `Claude usage request failed with ${response.status}`);
    }

    const payload = await response.json() as Record<string, unknown>;
    const windows = this.readWindows(payload);
    if (windows.length === 0) {
      return {
        connectionId: input.connectionId,
        connectionLabel: input.connectionLabel,
        endpointFamily: "anthropic",
        endpointLabel: input.endpointLabel,
        status: "unavailable",
        source: "remote_api",
        message: "Claude usage response did not include any quota windows",
        windows: [],
      };
    }

    return {
      connectionId: input.connectionId,
      connectionLabel: input.connectionLabel,
      endpointFamily: "anthropic",
      endpointLabel: input.endpointLabel,
      status: "available",
      source: "remote_api",
      planLabel: "Claude",
      windows,
    };
  }

  private readWindows(payload: Record<string, unknown>): ConnectionUsageWindow[] {
    return Object.entries(payload)
      .map(([key, value]) => this.readWindow(key, value))
      .filter((window): window is ConnectionUsageWindow => window !== null);
  }

  private readWindow(key: string, value: unknown): ConnectionUsageWindow | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const raw = value as RawWindow;
    const utilization = this.readPercent(raw.utilization);
    if (utilization === null) {
      return null;
    }

    return {
      kind: key === "five_hour" ? "primary" : key === "seven_day" ? "secondary" : "additional",
      label: this.formatWindowLabel(key),
      usedPercent: utilization,
      remainingPercent: Math.max(0, 100 - utilization),
      windowSeconds: this.windowSeconds(key),
      resetsAt: this.readTimestamp(raw.resets_at ?? raw.resetsAt),
    };
  }

  private formatWindowLabel(key: string): string {
    if (key === "five_hour") {
      return "5h";
    }
    if (key === "seven_day") {
      return "7d";
    }
    return key
      .split(/[_-]+/g)
      .filter(Boolean)
      .map((segment) => /^\d+$/.test(segment) ? segment : `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
      .join(" ");
  }

  private windowSeconds(key: string): number | null {
    if (key === "five_hour") {
      return 18_000;
    }
    if (key.startsWith("seven_day")) {
      return 604_800;
    }
    return null;
  }

  private readPercent(value: unknown): number | null {
    const numeric = this.readNumber({ value }, "value");
    if (numeric === null) {
      return null;
    }

    const normalized = numeric <= 1 ? numeric * 100 : numeric;
    return Math.max(0, Math.min(100, normalized));
  }

  private readTimestamp(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  }

  private buildError(input: ReaderInput, message: string): ConnectionUsageResult {
    return {
      connectionId: input.connectionId,
      connectionLabel: input.connectionLabel,
      endpointFamily: "anthropic",
      endpointLabel: input.endpointLabel,
      status: "error",
      source: "remote_api",
      message,
      windows: [],
    };
  }

  private readFetchErrorMessage(error: unknown): string {
    if (this.isAbortError(error)) {
      return `Claude usage request timed out after ${REQUEST_TIMEOUT_MS}ms`;
    }
    return error instanceof Error
      ? `Claude usage request failed: ${error.message}`
      : "Claude usage request failed";
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

  private readNumber(payload: Record<string, unknown>, field: string): number | null {
    const value = payload[field];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}
