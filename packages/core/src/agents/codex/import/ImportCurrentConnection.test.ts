import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../../models/access";
import { EndpointRegistry } from "../../../models/endpoint";
import { type StoredCredential } from "../../../services/credential/Types";
import { KeychainCredentialStore } from "../../../services/credential/KeychainCredentialStore";
import { ImportCurrentConnection } from "./ImportCurrentConnection";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  delete process.env.OPENAI_API_KEY3;
});

describe("ImportCurrentConnection", () => {
  it("imports a valid unknown azure live state", () => {
    const setup = createSetup({
      configToml: [
        'model_provider = "azure"',
        "",
        "[model_providers.azure]",
        'name = "Azure"',
        'base_url = "https://example-eu-resource.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      authFile: { OPENAI_API_KEY: null },
    });
    process.env.OPENAI_API_KEY3 = "azure-secret";

    const importer = ImportCurrentConnection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = importer.importCurrent();
    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    const endpoint = endpointRegistry.get("azure");
    endpointRegistry.close();
    const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    const access = accessRegistry.get("example-eu-resource-api-key");
    accessRegistry.close();

    expect(result).toEqual({
      id: "example-eu-resource-api-key",
      label: "example-eu-resource API Key",
      endpointId: "azure",
      endpointLabel: "Azure OpenAI (example-eu-resource)",
      endpointFamily: "azure-openai",
      authMode: "api_key",
    });
    expect(endpoint?.rootUrl).toBe("https://example-eu-resource.cognitiveservices.azure.com");
    expect(endpoint?.profile).toBe("azure-openai");
    expect(access?.endpointId).toBe("azure");
    expect(access?.credentialSource.reference).toBe("access:example-eu-resource-api-key");

    importer.close();
  });

  it("reuses an already matched openai session connection", () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
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
        id: "work-example-com",
        endpointId: "openai",
        label: "work@example.com",
        authMode: "openai_session",
        identityKey: "account:acct-123",
      },
      openAiSessionCredential("work@example.com"),
    );

    const importer = ImportCurrentConnection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = importer.importCurrent();

    expect(result).toEqual({
      id: "work-example-com",
      label: "work@example.com",
      endpointId: "openai",
      endpointLabel: "OpenAI",
      endpointFamily: "openai",
      authMode: "openai_session",
      reused: true,
    });

    importer.close();
  });

  it("reuses the default saved connection when multiple connections share the same binding", () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
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
        id: "default-session",
        endpointId: "openai",
        label: "work@example.com",
        authMode: "openai_session",
        identityKey: "account:acct-123",
      },
      openAiSessionCredential("work@example.com"),
    );
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
      id: "named-session",
        endpointId: "openai",
      label: "Work Session",
      authMode: "openai_session",
        identityKey: "account:acct-123",
      },
      openAiSessionCredential("work@example.com"),
    );

    const importer = ImportCurrentConnection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = importer.importCurrent();

    expect(result).toEqual({
      id: "default-session",
      label: "work@example.com",
      endpointId: "openai",
      endpointLabel: "OpenAI",
      endpointFamily: "openai",
      authMode: "openai_session",
      reused: true,
    });

    importer.close();
  });
});

function createSetup(options?: {
  authFile?: Record<string, unknown>;
  configToml?: string;
}): {
  dbPath: string;
  codexHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-import-current-"));
  tempDirs.push(dir);

  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(
    join(codexHome, "config.toml"),
    options?.configToml ?? 'model = "gpt-5.4"\nmodel_provider = "openai"\n',
    "utf8",
  );
  writeFileSync(
    join(codexHome, "auth.json"),
    `${JSON.stringify(options?.authFile ?? { OPENAI_API_KEY: "legacy-key" }, null, 2)}\n`,
    "utf8",
  );

  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome,
    credentialStore: new StubCredentialStore(),
  };
}

function seedEndpoint(
  dbPath: string,
  input: {
    id: string;
    label: string;
    rootUrl: string;
    profile: "openai-official" | "azure-openai";
    protocols: {
      openai: {
        basePath: string;
        wireApis: Array<"responses" | "chat">;
        authSchemes: ["bearer"];
        envKeyOverride?: string;
      };
    };
  },
): void {
  const registry = EndpointRegistry.open(dbPath);
  if (!registry.get(input.id)) {
    registry.add(input);
  }
  registry.close();
}

function seedAccess(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "openai_session" | "api_key";
    identityKey?: string;
  },
  credential: StoredCredential,
): void {
  const registry = AccessRegistry.open(dbPath, credentialStore);
  registry.add(input, credential);
  registry.close();
}

function openAiAuthFile(email: string): Record<string, unknown> {
  return {
    OPENAI_API_KEY: null,
    tokens: {
      id_token: createJwt({ email }),
      access_token: "access-token",
      refresh_token: "refresh-token",
      account_id: "acct-123",
    },
    last_refresh: "2026-04-25T00:00:00.000Z",
  };
}

function openAiSessionCredential(email: string): StoredCredential {
  return {
    kind: "openai_session",
    idToken: createJwt({ email }),
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accountId: "acct-123",
    lastRefresh: "2026-04-25T00:00:00.000Z",
  };
}

function createJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
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
