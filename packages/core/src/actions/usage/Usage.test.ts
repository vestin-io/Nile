import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CURSOR_LOCAL_CONNECTION_SUPPORT_FACTORY,
  CursorUsageBindingRegistry,
  CursorUsageSnapshotStore,
} from "@nile/agent-cursor/usage";
import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { Usage } from "./Usage";

const tempDirs: string[] = [];
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  globalThis.fetch = originalFetch;
});

const originalFetch = globalThis.fetch;

describe("Usage", () => {
  it("returns normalized usage windows for openai session connections", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedOpenAiConnection(setup.dbPath, setup.credentialStore);
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        plan_type: "prolite",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: {
            used_percent: 7,
            limit_window_seconds: 18000,
            reset_at: 1777427411,
          },
          secondary_window: {
            used_percent: 6,
            limit_window_seconds: 604800,
            reset_at: 1777963818,
          },
        },
        additional_rate_limits: [
          {
            limit_name: "GPT-5.3-Codex-Spark",
            metered_feature: "codex_bengalfox",
            rate_limit: {
              allowed: true,
              limit_reached: false,
              primary_window: {
                used_percent: 0,
                limit_window_seconds: 18000,
                reset_at: 1777433811,
              },
            },
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("work-session");

    expect(result).toEqual({
      connectionId: "work-session",
      connectionLabel: "Work Session",
      endpointFamily: "openai",
      endpointLabel: "OpenAI",
      status: "available",
      source: "remote_api",
      planLabel: "Pro Lite",
      windows: [
        expect.objectContaining({
          kind: "primary",
          label: "5h",
          usedPercent: 7,
          remainingPercent: 93,
          windowSeconds: 18000,
          allowed: true,
          limitReached: false,
        }),
        expect.objectContaining({
          kind: "secondary",
          label: "7d",
          usedPercent: 6,
          remainingPercent: 94,
          windowSeconds: 604800,
          allowed: true,
          limitReached: false,
        }),
        expect.objectContaining({
          kind: "additional",
          label: "GPT-5.3-Codex-Spark",
          usedPercent: 0,
          remainingPercent: 100,
          featureName: "codex_bengalfox",
        }),
      ],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("returns an error when openai usage fetch times out", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedOpenAiConnection(setup.dbPath, setup.credentialStore);
    globalThis.fetch = (async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      throw abortError;
    }) as unknown as typeof fetch;

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("work-session");

    expect(result.status).toBe("error");
    expect(result.message).toContain("timed out");
    expect(result.windows).toEqual([]);

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("returns unavailable for cursor connections without a bound web session", async () => {
    const setup = createSetup();
    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    endpointRegistry.add({
      id: "cursor",
      label: "Cursor",
      rootUrl: "https://api2.cursor.sh",
      profile: "cursor-backend",
      protocols: {
        cursor: {},
      },
    });
    const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    accessRegistry.add({
      id: "cursor-session",
      endpointId: "cursor",
      label: "cursor.user@example.com",
      authMode: "cursor_session",
      identityKey: "auth:auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
    }, {
      kind: "cursor_session",
      accessToken: "cursor-access-token",
      refreshToken: "cursor-refresh-token",
      authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
      email: "cursor.user@example.com",
    });
    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("cursor-session");
    expect(result).toEqual({
      connectionId: "cursor-session",
      connectionLabel: "cursor.user@example.com",
      endpointFamily: "cursor",
      endpointLabel: "Cursor",
      status: "unavailable",
      source: "remote_api",
      message: "Bind a Cursor web session for this connection to enable live usage.",
      windows: [],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("returns normalized usage windows for claude session connections", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedClaudeConnection(setup.dbPath, setup.credentialStore);
    globalThis.fetch = (async (
      input: FetchInput,
      init?: FetchInit,
    ) => {
      const url = String(input);
      if (url === "https://api.anthropic.com/api/oauth/usage") {
        return new Response(JSON.stringify({
          five_hour: {
            utilization: 0.24,
            resets_at: "2026-04-29T12:00:00.000Z",
          },
          seven_day_sonnet: {
            utilization: 76,
            resets_at: "2026-05-01T12:00:00.000Z",
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "unexpected url", url, method: init?.method ?? "GET" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("claude-session");

    expect(result).toEqual({
      connectionId: "claude-session",
      connectionLabel: "claude@example.com",
      endpointFamily: "anthropic",
      endpointLabel: "Claude",
      status: "available",
      source: "remote_api",
      planLabel: "Claude",
      windows: [
        expect.objectContaining({
          kind: "primary",
          label: "5h",
          usedPercent: 24,
          remainingPercent: 76,
          windowSeconds: 18000,
          resetsAt: "2026-04-29T12:00:00.000Z",
        }),
        expect.objectContaining({
          kind: "additional",
          label: "Seven Day Sonnet",
          usedPercent: 76,
          remainingPercent: 24,
          windowSeconds: 604800,
          resetsAt: "2026-05-01T12:00:00.000Z",
        }),
      ],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("returns deduped Gemini quota windows for gemini session connections", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedGeminiConnection(setup.dbPath, setup.credentialStore);
    globalThis.fetch = (async (
      input: FetchInput,
      init?: FetchInit,
    ) => {
      const url = String(input);
      if (url === "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist") {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer gemini-access-token");
        return new Response(JSON.stringify({
          cloudaicompanionProject: "alien-superstate-rq4hk",
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url === "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota") {
        expect(init?.body).toBe(JSON.stringify({ project: "alien-superstate-rq4hk" }));
        return new Response(JSON.stringify({
          buckets: [
            {
              modelId: "gemini-2.5-pro",
              remainingFraction: 0.42,
              resetTime: "2026-05-18T12:00:00.000Z",
            },
            {
              modelId: "gemini-3.1-pro-preview",
              remainingFraction: 0.42,
              resetTime: "2026-05-18T12:00:00.000Z",
            },
            {
              modelId: "gemini-2.5-flash",
              remainingFraction: 0.88,
              resetTime: "2026-05-18T13:00:00.000Z",
            },
            {
              modelId: "gemini-3-flash-preview",
              remainingFraction: 0.88,
              resetTime: "2026-05-18T13:00:00.000Z",
            },
            {
              modelId: "gemini-2.5-flash-lite",
              remainingFraction: 1,
              resetTime: "2026-05-18T14:00:00.000Z",
            },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "unexpected url", url, method: init?.method ?? "GET" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("gemini-session");

    expect(result).toEqual({
      connectionId: "gemini-session",
      connectionLabel: "gemini@example.com",
      endpointFamily: "gemini",
      endpointLabel: "Gemini",
      status: "available",
      source: "remote_api",
      planLabel: "Gemini",
      windows: [
        expect.objectContaining({
          kind: "primary",
          label: "Pro",
          usedPercent: 58,
          remainingPercent: 42,
          resetsAt: "2026-05-18T12:00:00.000Z",
        }),
        expect.objectContaining({
          kind: "additional",
          label: "Flash",
          usedPercent: 12,
          remainingPercent: 88,
          resetsAt: "2026-05-18T13:00:00.000Z",
        }),
        expect.objectContaining({
          kind: "additional",
          label: "Flash Lite",
          usedPercent: 0,
          remainingPercent: 100,
          resetsAt: "2026-05-18T14:00:00.000Z",
        }),
      ],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("returns unavailable when Gemini project discovery does not resolve a project", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedGeminiConnection(setup.dbPath, setup.credentialStore);
    globalThis.fetch = (async (input: FetchInput) => {
      const url = String(input);
      if (url === "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist") {
        return new Response(JSON.stringify({ currentTier: { id: "standard-tier" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("gemini-session");

    expect(result).toEqual({
      connectionId: "gemini-session",
      connectionLabel: "gemini@example.com",
      endpointFamily: "gemini",
      endpointLabel: "Gemini",
      status: "unavailable",
      source: "remote_api",
      planLabel: "Gemini",
      message: "Gemini usage project metadata is unavailable for this session.",
      windows: [],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("accepts object-shaped Gemini project metadata", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedGeminiConnection(setup.dbPath, setup.credentialStore);
    globalThis.fetch = (async (input: FetchInput, init?: FetchInit) => {
      const url = String(input);
      if (url === "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist") {
        return new Response(JSON.stringify({
          cloudaicompanionProject: { id: "alien-superstate-rq4hk" },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota") {
        expect(init?.body).toBe(JSON.stringify({ project: "alien-superstate-rq4hk" }));
        return new Response(JSON.stringify({
          buckets: [
            {
              modelId: "gemini-2.5-flash",
              remainingFraction: 0.75,
              resetTime: "2026-05-18T13:00:00.000Z",
            },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("gemini-session");

    expect(result).toEqual({
      connectionId: "gemini-session",
      connectionLabel: "gemini@example.com",
      endpointFamily: "gemini",
      endpointLabel: "Gemini",
      status: "available",
      source: "remote_api",
      planLabel: "Gemini",
      windows: [
        expect.objectContaining({
          label: "Flash",
          usedPercent: 25,
          remainingPercent: 75,
          resetsAt: "2026-05-18T13:00:00.000Z",
        }),
      ],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("returns live cursor usage when a bound web session succeeds", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedCursorConnection(setup.dbPath, setup.credentialStore);
    const bindingRegistry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    bindingRegistry.bind(
      {
        connectionId: "cursor-session",
        accountFingerprint: {
          authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
          workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
          email: "cursor.user@example.com",
        },
      },
      CURSOR_WEB_SESSION_TOKEN,
    );
    bindingRegistry.close();

    globalThis.fetch = (async (_input: FetchInput, init?: FetchInit) => {
      const cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
      expect(cookieHeader).toContain("workos_id=user_01K03K41CNGRCADY5VT0JPH69Y");
      expect(cookieHeader).toContain(`WorkosCursorSessionToken=${encodeURIComponent(CURSOR_WEB_SESSION_TOKEN)}`);
      return new Response(JSON.stringify({
        billingCycleStart: "2026-04-01T00:00:00.000Z",
        billingCycleEnd: "2026-05-01T00:00:00.000Z",
        individualUsage: {
          plan: {
            totalPercentUsed: 17,
            autoPercentUsed: 21,
            apiPercentUsed: 3,
          },
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("cursor-session");

    expect(result).toEqual({
      connectionId: "cursor-session",
      connectionLabel: "cursor.user@example.com",
      endpointFamily: "cursor",
      endpointLabel: "Cursor",
      status: "available",
      source: "remote_api",
      freshness: "live",
      lastFetchedAt: expect.any(String),
      planLabel: "Cursor",
      windows: [
        expect.objectContaining({ kind: "primary", label: "Total", usedPercent: 17, remainingPercent: 83 }),
        expect.objectContaining({ kind: "secondary", label: "Auto + Composer", usedPercent: 21, remainingPercent: 79 }),
        expect.objectContaining({ kind: "additional", label: "API", usedPercent: 3, remainingPercent: 97 }),
      ],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("returns cached cursor usage when only a snapshot is available", async () => {
    const setup = createSetup();
    const { accessRegistry, endpointRegistry } = seedCursorConnection(setup.dbPath, setup.credentialStore);
    const snapshotStore = CursorUsageSnapshotStore.open(setup.dbPath);
    snapshotStore.save({
      connectionId: "cursor-session",
      accountFingerprint: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      },
      totalPercentUsed: 42,
      autoPercentUsed: 50,
      apiPercentUsed: 7,
      billingCycleStart: "2026-04-01T00:00:00.000Z",
      billingCycleEnd: "2026-06-01T00:00:00.000Z",
      fetchedAt: "2026-05-01T08:00:00.000Z",
      freshness: "cached",
    });
    snapshotStore.close();

    const result = await createUsage(setup.dbPath, setup.credentialStore, endpointRegistry, accessRegistry).get("cursor-session");

    expect(result).toEqual({
      connectionId: "cursor-session",
      connectionLabel: "cursor.user@example.com",
      endpointFamily: "cursor",
      endpointLabel: "Cursor",
      status: "available",
      source: "local_artifact",
      freshness: "cached",
      lastFetchedAt: "2026-05-01T08:00:00.000Z",
      planLabel: "Cursor",
      message: "Bind a Cursor web session for this connection to enable live usage.",
      windows: [
        expect.objectContaining({ label: "Total", remainingPercent: 58 }),
        expect.objectContaining({ label: "Auto + Composer", remainingPercent: 50 }),
        expect.objectContaining({ label: "API", remainingPercent: 93 }),
      ],
    });

    accessRegistry.close();
    endpointRegistry.close();
  });
});

function createSetup(): {
  dbPath: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-usage-"));
  tempDirs.push(dir);
  return {
    dbPath: join(dir, "switcher.sqlite"),
    credentialStore: new StubCredentialStore(),
  };
}

function seedOpenAiConnection(dbPath: string, credentialStore: StubCredentialStore) {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "openai",
    label: "OpenAI",
    rootUrl: "https://api.openai.com",
    profile: "openai-official",
    protocols: {
      openai: {
        basePath: "/v1",
        wireApis: ["responses"],
        authSchemes: ["bearer"],
      },
    },
  });
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: "work-session",
    endpointId: "openai",
    label: "Work Session",
    authMode: "openai_session",
  }, {
    kind: "openai_session",
    idToken: "id-token",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accountId: "acct-123",
  });
  return { accessRegistry, endpointRegistry };
}

function seedClaudeConnection(dbPath: string, credentialStore: StubCredentialStore) {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "claude",
    label: "Claude",
    rootUrl: "https://api.anthropic.com",
    profile: "anthropic-official",
    protocols: {
      anthropic: {
        authSchemes: ["x_api_key"],
        envKeyOverride: "ANTHROPIC_API_KEY",
        versionHeader: "2023-06-01",
      },
    },
  });
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: "claude-session",
    endpointId: "claude",
    label: "claude@example.com",
    authMode: "claude_session",
  }, {
    kind: "claude_session",
    accessToken: "claude-access-token",
    refreshToken: "claude-refresh-token",
    accountUuid: "acct-claude-123",
    organizationUuid: "org-claude-456",
    email: "claude@example.com",
    displayName: "Claude User",
  });
  return { accessRegistry, endpointRegistry };
}

function seedCursorConnection(dbPath: string, credentialStore: StubCredentialStore) {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "cursor",
    label: "Cursor",
    rootUrl: "https://api2.cursor.sh",
    profile: "cursor-backend",
    protocols: {
      cursor: {},
    },
  });
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: "cursor-session",
    endpointId: "cursor",
    label: "cursor.user@example.com",
    authMode: "cursor_session",
    identityKey: "auth:auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
  }, {
    kind: "cursor_session",
    accessToken: "cursor-access-token",
    refreshToken: "cursor-refresh-token",
    authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
    email: "cursor.user@example.com",
  });
  return { accessRegistry, endpointRegistry };
}

function seedGeminiConnection(dbPath: string, credentialStore: StubCredentialStore) {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "gemini",
    label: "Gemini",
    rootUrl: "https://cloudcode-pa.googleapis.com",
    profile: "gemini-cli",
    protocols: {
      gemini: {
        authTypes: ["oauth-personal"],
      },
    },
  });
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: "gemini-session",
    endpointId: "gemini",
    label: "gemini@example.com",
    authMode: "gemini_cli_session",
  }, {
    kind: "gemini_cli_session",
    accessToken: "gemini-access-token",
    refreshToken: "gemini-refresh-token",
    idToken: "gemini-id-token",
    tokenType: "Bearer",
  });
  return { accessRegistry, endpointRegistry };
}

function createUsage(
  dbPath: string,
  credentialStore: StubCredentialStore,
  endpointRegistry: EndpointRegistry,
  accessRegistry: AccessRegistry,
): Usage {
  const database = SqliteDatabase.open(dbPath);
  const cursorOps = CURSOR_LOCAL_CONNECTION_SUPPORT_FACTORY.create(
    database,
    credentialStore as unknown as import("../../services/credential/Store").CredentialStore,
    endpointRegistry,
    accessRegistry,
  );
  return new Usage(endpointRegistry, accessRegistry, [...cursorOps.createUsageReaders()]);
}

const CURSOR_WEB_SESSION_JWT = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
const CURSOR_WEB_SESSION_TOKEN = `user_01K03K41CNGRCADY5VT0JPH69Y::${CURSOR_WEB_SESSION_JWT}`;

class StubCredentialStore {
  private readonly credentials = new Map<string, unknown>();

  create(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  update(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  get(id: string) {
    const credential = this.credentials.get(id);
    if (!credential) {
      throw new Error(`Missing stub credential: ${id}`);
    }
    return credential as never;
  }

  has(id: string): boolean {
    return this.credentials.has(id);
  }

  remove(id: string): void {
    this.credentials.delete(id);
  }
}
