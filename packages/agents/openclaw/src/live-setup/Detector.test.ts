import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { type StoredCredential } from "@nile/core/services/credential";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import { LiveSetupDetector } from "./Detector";
import { OPENCLAW_AGENT_ID } from "../types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenClaw LiveSetupDetector", () => {
  it("reports a missing local config file instead of a fake schema error", () => {
    const setup = createSetup();
    const detector = LiveSetupDetector.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("invalid_structure");
    expect(result.issues).toEqual([
      `OpenClaw config not found at ${join(setup.openclawHome, "openclaw.json")}`,
    ]);

    detector.close();
  });

  it("matches a saved connection when provider, credential, and model hint align", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://router.example",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-work",
        endpointId: "gateway",
        label: "Gateway gpt-4.1",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        apiKey: "router-secret",
      },
    );

    setOpenClawModel(setup.dbPath, "router-work", "gpt-4.1");

    const selection = AgentSelection.open(setup.dbPath);
    selection.setApplied(OPENCLAW_AGENT_ID, "router-work", "2026-05-03T00:00:00.000Z");
    selection.close();

    writeFileSync(
      join(setup.openclawHome, "openclaw.json"),
      JSON.stringify({
        models: {
          mode: "merge",
          providers: {
            custom: {
              baseUrl: "https://router.example/v1",
              apiKey: "router-secret",
              api: "openai-responses",
              models: [{ id: "gpt-4.1", name: "GPT 4.1" }],
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: "custom/gpt-4.1",
            },
          },
        },
      }, null, 2),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.endpoint?.endpointFamily).toBe("gateway");
    expect(result.modelId).toBe("gpt-4.1");
    expect(result.matchedConnection).toEqual({
      connectionId: "router-work",
      endpointId: "gateway",
      accessId: "router-work",
      matchesAgentSelection: true,
    });

    detector.close();
  });

  it("matches a saved OpenAI session from auth-profile state", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
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
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-session",
        endpointId: "openai",
        label: "gemini.secondary@example.test gpt-5.3-codex",
        authMode: "openclaw_openai_session",
        identityKey: "account:acct-123",
      },
      {
        kind: "openclaw_openai_session",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: 1770000000000,
        accountId: "acct-123",
        email: "gemini.secondary@example.test",
      },
    );
    setOpenClawModel(setup.dbPath, "openai-session", "gpt-5.3-codex");

    writeFileSync(
      join(setup.openclawHome, "openclaw.json"),
      JSON.stringify({
        auth: {
          profiles: {
            "openai-codex:default": {
              provider: "openai-codex",
              mode: "oauth",
            },
          },
          order: {
            "openai-codex": ["openai-codex:default"],
          },
        },
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.3-codex",
            },
          },
        },
      }, null, 2),
      "utf8",
    );
    writeFileSync(
      join(setup.openclawHome, "agents", "main", "agent", "auth-profiles.json"),
      JSON.stringify({
        version: 1,
        profiles: {
          "openai-codex:default": {
            type: "oauth",
            provider: "openai-codex",
            access: "access-token",
            refresh: "refresh-token",
            expires: 1770000000000,
            accountId: "acct-123",
            email: "gemini.secondary@example.test",
          },
        },
      }, null, 2),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.access).toEqual({
      authMode: "openclaw_openai_session",
      labelHint: "gemini.secondary@example.test",
      identityKey: "account:acct-123",
    });
    expect(result.modelId).toBe("gpt-5.3-codex");
    expect(result.matchedConnection).toEqual({
      connectionId: "openai-session",
      endpointId: "openai",
      accessId: "openai-session",
      matchesAgentSelection: false,
    });

    detector.close();
  });

  it("prefers a saved standard OpenAI session over an OpenClaw-only duplicate", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
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
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "codex-openai-session",
        endpointId: "openai",
        label: "openai.shared@example.test",
        authMode: "openai_session",
        identityKey: "account:acct-123",
      },
      {
        kind: "openai_session",
        idToken: "header.payload.signature",
        accessToken: "codex-access-token",
        refreshToken: "codex-refresh-token",
        accountId: "acct-123",
      },
    );
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openclaw-openai-session",
        endpointId: "openai",
        label: "openai.shared@example.test gpt-5.3-codex",
        authMode: "openclaw_openai_session",
        identityKey: "account:acct-123",
      },
      {
        kind: "openclaw_openai_session",
        accessToken: "openclaw-access-token",
        refreshToken: "openclaw-refresh-token",
        accountId: "acct-123",
        email: "openai.shared@example.test",
      },
    );

    writeFileSync(
      join(setup.openclawHome, "openclaw.json"),
      JSON.stringify({
        auth: {
          profiles: {
            "openai-codex:default": {
              provider: "openai-codex",
              mode: "oauth",
            },
          },
          order: {
            "openai-codex": ["openai-codex:default"],
          },
        },
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.3-codex",
            },
          },
        },
      }, null, 2),
      "utf8",
    );
    writeFileSync(
      join(setup.openclawHome, "agents", "main", "agent", "auth-profiles.json"),
      JSON.stringify({
        version: 1,
        profiles: {
          "openai-codex:default": {
            type: "oauth",
            provider: "openai-codex",
            access: "openclaw-access-token",
            refresh: "openclaw-refresh-token",
            expires: 1770000000000,
            accountId: "acct-123",
            email: "openai.shared@example.test",
          },
        },
      }, null, 2),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.matchedConnection).toEqual({
      connectionId: "codex-openai-session",
      endpointId: "openai",
      accessId: "codex-openai-session",
      matchesAgentSelection: false,
    });

    detector.close();
  });
});

function createSetup(): {
  dbPath: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-openclaw-detector-"));
  tempDirs.push(dir);
  const openclawHome = join(dir, ".openclaw");
  mkdirSync(openclawHome, { recursive: true });
  mkdirSync(join(openclawHome, "agents", "main", "agent"), { recursive: true });

  return {
    dbPath: join(dir, "switcher.sqlite"),
    openclawHome,
    credentialStore: new StubCredentialStore(),
  };
}

function setOpenClawModel(dbPath: string, connectionId: string, modelId: string): void {
  const settings = AgentConnectionSettings.open(dbPath);
  try {
    settings.setModelId("openclaw", connectionId, modelId);
  } finally {
    settings.close();
  }
}

function seedEndpoint(dbPath: string, input: {
  id: string;
  label: string;
  rootUrl: string;
  profile: "generic-gateway" | "openai-official";
  protocols: {
    openai: {
      basePath: string;
      wireApis: Array<"responses" | "chat">;
      authSchemes: ["bearer"];
    };
  };
}): void {
  const registry = EndpointRegistry.open(dbPath);
  registry.add(input);
  registry.close();
}

function seedAccess(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key" | "openai_session" | "openclaw_openai_session";
    identityKey?: string;
  },
  credential: StoredCredential,
): void {
  const registry = AccessRegistry.open(dbPath, credentialStore);
  registry.add(input, credential);
  registry.close();
}

function openAiSessionCredential(): StoredCredential {
  return {
    kind: "openai_session",
    idToken: "header.eyJlbWFpbCI6ImppcWlhbmc5MEBnbWFpbC5jb20ifQ.signature",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accountId: "acct-123",
  };
}

class StubCredentialStore extends KeychainCredentialStore {
  private readonly records = new Map<string, StoredCredential>();

  override create(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override update(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override get(reference: string): StoredCredential {
    const credential = this.records.get(reference);
    if (!credential) {
      throw new Error(`Credential not found: ${reference}`);
    }
    return credential;
  }

  override has(reference: string): boolean {
    return this.records.has(reference);
  }

  override remove(reference: string): void {
    this.records.delete(reference);
  }
}
