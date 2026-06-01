import { describe, expect, it } from "vitest";

import { DesktopUsageCache } from "./UsageCache";

describe("DesktopUsageCache", () => {
  it("logs Gemini quota results that stay visible in the desktop summary", async () => {
    const logger = new StubLogger();
    const cache = new DesktopUsageCache(logger as never);

    await cache.refreshByConnectionId(createSession({
      connectionId: "gemini-session",
      connectionLabel: "gemini@example.com",
      endpointFamily: "gemini",
      endpointLabel: "Gemini",
      status: "available",
      source: "remote_api",
      planLabel: "Gemini",
      windows: [
        {
          label: "Pro",
          remainingPercent: 42,
        },
      ],
    }), ["gemini-session"], { force: true });

    expect(logger.infos).toEqual([
      {
        event: "desktop.gemini.quota.read_result",
        fields: {
          connectionId: "gemini-session",
          status: "available",
          source: "remote_api",
          windowCount: 1,
          summaryVisible: true,
        },
      },
    ]);
  });

  it("logs Gemini quota results that get hidden by the desktop summary", async () => {
    const logger = new StubLogger();
    const cache = new DesktopUsageCache(logger as never);

    await cache.refreshByConnectionId(createSession({
      connectionId: "gemini-session",
      connectionLabel: "gemini@example.com",
      endpointFamily: "gemini",
      endpointLabel: "Gemini",
      status: "unavailable",
      source: "remote_api",
      planLabel: "Gemini",
      message: "Gemini quota response did not include recognizable quota buckets",
      windows: [],
    }), ["gemini-session"], { force: true });

    expect(logger.infos).toEqual([
      {
        event: "desktop.gemini.quota.read_result",
        fields: {
          connectionId: "gemini-session",
          status: "unavailable",
          source: "remote_api",
          windowCount: 0,
          summaryVisible: false,
          message: "Gemini quota response did not include recognizable quota buckets",
        },
      },
    ]);
  });

  it("does not cache quota read errors as fresh null usage and requires a manual retry", async () => {
    const logger = new StubLogger();
    const cache = new DesktopUsageCache(logger as never);
    const session = createFlakySession();

    const first = await cache.refreshByConnectionId(session as never, ["openai-session"]);
    const second = await cache.refreshByConnectionId(session as never, ["openai-session"]);
    const third = await cache.refreshByConnectionId(session as never, ["openai-session"], { mode: "manual" });

    expect(first.usageByConnectionId.get("openai-session")).toBeNull();
    expect(second.usageByConnectionId.get("openai-session")).toBeNull();
    expect(third.usageByConnectionId.get("openai-session")).toEqual({
      status: "available",
      planLabel: "Plus",
      windows: [
        { key: "weekly", label: "weekly", remainingPercent: 66, resetsAt: null },
      ],
      windowLabel: "weekly",
      remainingPercent: 66,
      text: "weekly 66% left",
    });
  });

  it("pauses automatic refresh after an error until a manual refresh succeeds", async () => {
    const logger = new StubLogger();
    const cache = new DesktopUsageCache(logger as never);
    const session = createSequenceSession([
      {
        connectionId: "openai-session",
        connectionLabel: "openai@example.com",
        endpointFamily: "openai",
        endpointLabel: "OpenAI",
        status: "error",
        source: "remote_api",
        message: "Quota request timed out after 10000ms",
        windows: [],
      },
      {
        connectionId: "openai-session",
        connectionLabel: "openai@example.com",
        endpointFamily: "openai",
        endpointLabel: "OpenAI",
        status: "available",
        source: "remote_api",
        planLabel: "Plus",
        windows: [
          {
            label: "weekly",
            remainingPercent: 66,
          },
        ],
      },
      {
        connectionId: "openai-session",
        connectionLabel: "openai@example.com",
        endpointFamily: "openai",
        endpointLabel: "OpenAI",
        status: "available",
        source: "remote_api",
        planLabel: "Plus",
        windows: [
          {
            label: "weekly",
            remainingPercent: 66,
          },
        ],
      },
    ]);

    await cache.refreshByConnectionId(session as never, ["openai-session"], { force: true, mode: "auto" });
    await cache.refreshByConnectionId(session as never, ["openai-session"], { force: true, mode: "auto" });
    await cache.refreshByConnectionId(session as never, ["openai-session"], { force: true, mode: "manual" });
    await cache.refreshByConnectionId(session as never, ["openai-session"], { force: true, mode: "auto" });

    expect(session.calls).toBe(3);
  });

  it("disables interactive session recovery for automatic refresh but keeps it for manual refresh", async () => {
    const logger = new StubLogger();
    const cache = new DesktopUsageCache(logger as never);
    const session = createRecoveryTrackingSession();

    await cache.refreshByConnectionId(session as never, ["openai-session"], { force: true, mode: "auto" });
    await cache.refreshByConnectionId(session as never, ["openai-session"], { force: true, mode: "manual" });

    expect(session.recoveryFlags).toEqual([false, true]);
  });
});

function createSession(result: {
  connectionId: string;
  connectionLabel: string;
  endpointFamily: string;
  endpointLabel: string;
  status: string;
  source: string;
  planLabel?: string;
  message?: string;
  windows: Array<{
    label: string;
    remainingPercent: number | null;
  }>;
}) {
  return {
    async getConnectionUsage() {
      return result;
    },
  } as never;
}

function createFlakySession() {
  let calls = 0;
  return {
    async getConnectionUsage() {
      calls += 1;
      if (calls === 1) {
        return {
          connectionId: "openai-session",
          connectionLabel: "openai@example.com",
          endpointFamily: "openai",
          endpointLabel: "OpenAI",
          status: "error",
          source: "remote_api",
          message: "Quota request timed out after 10000ms",
          windows: [],
        };
      }

      return {
        connectionId: "openai-session",
        connectionLabel: "openai@example.com",
        endpointFamily: "openai",
        endpointLabel: "OpenAI",
        status: "available",
        source: "remote_api",
        planLabel: "Plus",
        windows: [
          {
            label: "weekly",
            remainingPercent: 66,
          },
        ],
      };
    },
  };
}

function createSequenceSession(results: Array<{
  connectionId: string;
  connectionLabel: string;
  endpointFamily: string;
  endpointLabel: string;
  status: string;
  source: string;
  planLabel?: string;
  message?: string;
  windows: Array<{
    label: string;
    remainingPercent: number | null;
  }>;
}>) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async getConnectionUsage() {
      const result = results[Math.min(calls, results.length - 1)];
      calls += 1;
      return result;
    },
  };
}

function createRecoveryTrackingSession() {
  const recoveryFlags: boolean[] = [];
  return {
    get recoveryFlags() {
      return recoveryFlags;
    },
    async getConnectionUsage(
      _connectionId?: string,
      options?: { recoverUnauthorizedCurrentSession?: boolean },
    ) {
      recoveryFlags.push(options?.recoverUnauthorizedCurrentSession === true);
      return {
        connectionId: "openai-session",
        connectionLabel: "openai@example.com",
        endpointFamily: "openai",
        endpointLabel: "OpenAI",
        status: "error",
        errorCode: "credential_unauthorized" as const,
        source: "remote_api",
        message: "OpenAI session is expired or unauthorized. Sign in to Codex again and retry.",
        windows: [],
      };
    },
  };
}

class StubLogger {
  readonly infos: Array<{ event: string; fields: Record<string, unknown> }> = [];

  info(event: string, fields?: Record<string, unknown>): void {
    this.infos.push({ event, fields: fields ?? {} });
  }

  warn(): void {}
}
