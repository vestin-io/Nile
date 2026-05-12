import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../access";
import { EndpointRegistry } from "../endpoint";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import type { StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { AgentConnectionSettings } from "./Settings";

const tempRoots: string[] = [];

describe("AgentConnectionSettings", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it("stores agent-specific model settings independently per connection", () => {
    const dbPath = createTempDatabasePath();
    const settings = AgentConnectionSettings.open(dbPath);

    try {
      expect(settings.list()).toEqual([]);

      settings.setModelId("openclaw", "work", "gpt-5.3-codex");
      settings.setModelId("claude", "work", "claude-sonnet-4");

      expect(settings.get("openclaw", "work")).toEqual({
        agentId: "openclaw",
        connectionId: "work",
        modelId: "gpt-5.3-codex",
      });
      expect(settings.get("claude", "work")).toEqual({
        agentId: "claude",
        connectionId: "work",
        modelId: "claude-sonnet-4",
      });

      settings.clear("openclaw", "work");
      expect(settings.get("openclaw", "work")).toBeNull();
      expect(settings.get("claude", "work")?.modelId).toBe("claude-sonnet-4");

      settings.clearConnection("work");
      expect(settings.get("claude", "work")).toBeNull();
    } finally {
      settings.close();
    }
  });

  it("does not create a legacy openclaw_model_id column for new access schemas", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    const endpoints = EndpointRegistry.open(dbPath);
    endpoints.add({
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
    endpoints.close();

    const accesses = AccessRegistry.open(dbPath, credentialStore);
    try {
      accesses.add({
        id: "openai-work",
        endpointId: "openai",
        label: "OpenAI Work",
        authMode: "api_key",
      }, {
        kind: "api_key",
        apiKey: "secret",
      });
    } finally {
      accesses.close();
    }

    const database = SqliteDatabase.open(dbPath);
    try {
      AgentConnectionSettings.fromDatabase(database);
      const columns = database
        .query<{ name: string }, []>("PRAGMA table_info(accesses)")
        .all()
        .map((row) => row.name);
      expect(columns).not.toContain("openclaw_model_id");
    } finally {
      database.close();
    }
  });
});

function createTempDatabasePath(): string {
  const root = mkdtempSync(join(tmpdir(), "nile-agent-connection-settings-"));
  tempRoots.push(root);
  return join(root, "switcher.sqlite");
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
