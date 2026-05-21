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

class StubLogger {
  readonly infos: Array<{ event: string; fields: Record<string, unknown> }> = [];

  info(event: string, fields?: Record<string, unknown>): void {
    this.infos.push({ event, fields: fields ?? {} });
  }

  warn(): void {}
}
