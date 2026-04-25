import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../access";
import { EndpointRegistry } from "../endpoint";
import { type StoredCredential } from "../../services/credential/Types";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import { AgentSelection, AgentSelectionValidationError } from "./Selection";

const tempDirs: string[] = [];
const CODEX_AGENT = "codex";
const CURSOR_AGENT = "cursor";

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("AgentSelection", () => {
  it("returns null when no selection has been applied", () => {
    const selection = AgentSelection.open(createTempDatabasePath());

    expect(selection.get(CODEX_AGENT)).toBeNull();

    selection.close();
  });

  it("persists the last applied connection per agent across restart", () => {
    const dbPath = createTempDatabasePath();
    seedProviderAndAccount(dbPath);

    {
      const selection = AgentSelection.open(dbPath);
      selection.setApplied(CODEX_AGENT, "openai-work-connection", "2026-04-25T10:00:00.000Z");
      selection.close();
    }

    {
      const selection = AgentSelection.open(dbPath);
      expect(selection.get(CODEX_AGENT)).toEqual({
        agentId: CODEX_AGENT,
        connectionId: "openai-work-connection",
        endpointId: "openai-official",
        accessId: "openai-work-connection",
        appliedAt: "2026-04-25T10:00:00.000Z",
      });
      selection.close();
    }
  });

  it("keeps selections independent across targets", () => {
    const dbPath = createTempDatabasePath();
    seedProviderAndAccount(dbPath);
    seedSecondAccount(dbPath);

    const selection = AgentSelection.open(dbPath);
    selection.setApplied(CODEX_AGENT, "openai-work-connection", "2026-04-25T10:00:00.000Z");
    selection.setApplied(CURSOR_AGENT, "openai-personal-connection", "2026-04-25T11:00:00.000Z");

    expect(selection.get(CODEX_AGENT)).toEqual({
      agentId: CODEX_AGENT,
      connectionId: "openai-work-connection",
      endpointId: "openai-official",
      accessId: "openai-work-connection",
      appliedAt: "2026-04-25T10:00:00.000Z",
    });
    expect(selection.get(CURSOR_AGENT)).toEqual({
      agentId: CURSOR_AGENT,
      connectionId: "openai-personal-connection",
      endpointId: "openai-official",
      accessId: "openai-personal-connection",
      appliedAt: "2026-04-25T11:00:00.000Z",
    });

    selection.close();
  });

  it("rejects missing connections", () => {
    const dbPath = createTempDatabasePath();
    seedProviderAndAccount(dbPath);
    const selection = AgentSelection.open(dbPath);

    expect(() => selection.setApplied(CODEX_AGENT, "missing-connection")).toThrow(AgentSelectionValidationError);
    expect(selection.get(CODEX_AGENT)).toBeNull();

    selection.close();
  });

  it("rejects unsupported targets", () => {
    const dbPath = createTempDatabasePath();
    seedProviderAndAccount(dbPath);
    const selection = AgentSelection.open(dbPath);

    expect(() =>
      selection.setApplied("unsupported-agent" as never, "openai-work-connection"),
    ).toThrow(AgentSelectionValidationError);

    selection.close();
  });
});

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-current-selection-"));
  tempDirs.push(dir);
  return join(dir, "switcher.sqlite");
}

function seedProviderAndAccount(dbPath: string): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "openai-official",
    label: "OpenAI Official",
    rootUrl: "https://api.openai.com",
    profile: "openai-official",
    protocols: {
      openai: {
        basePath: "/v1",
        wireApis: ["responses"],
        authSchemes: ["bearer"],
        envKeyOverride: "OPENAI_API_KEY",
      },
    },
  });
  endpointRegistry.close();

  const accessRegistry = AccessRegistry.open(dbPath, new StubCredentialStore());
  accessRegistry.add(
    {
      id: "openai-work-connection",
      endpointId: "openai-official",
      label: "OpenAI Work",
      authMode: "api_key",
    },
    { kind: "api_key", apiKey: "secret-1" },
  );
  accessRegistry.close();
}

function seedSecondAccount(dbPath: string): void {
  const accessRegistry = AccessRegistry.open(dbPath, new StubCredentialStore());
  accessRegistry.add(
    {
      id: "openai-personal-connection",
      endpointId: "openai-official",
      label: "OpenAI Personal",
      authMode: "openai_session",
    },
    {
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    },
  );
  accessRegistry.close();
}

function seedAzureProviderAndAccount(dbPath: string): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "azure-work",
    label: "Azure Work",
    rootUrl: "https://example.cognitiveservices.azure.com",
    profile: "azure-openai",
    protocols: {
      openai: {
        basePath: "/openai/v1",
        wireApis: ["responses"],
        authSchemes: ["bearer"],
        envKeyOverride: "OPENAI_API_KEY",
      },
    },
  });
  endpointRegistry.close();

  const accessRegistry = AccessRegistry.open(dbPath, new StubCredentialStore());
  accessRegistry.add(
    {
      id: "azure-work-connection",
      endpointId: "azure-work",
      label: "Azure Work Account",
      authMode: "api_key",
    },
    { kind: "api_key", apiKey: "azure-secret" },
  );
  accessRegistry.close();
}

class StubCredentialStore extends KeychainCredentialStore {
  override create(_credentialId: string, _credential: StoredCredential): void {}

  override update(_credentialId: string, _credential: StoredCredential): void {}

  override get(_credentialId: string): StoredCredential {
    return { kind: "api_key", apiKey: "secret" };
  }

  override has(): boolean {
    return true;
  }

  override remove(_credentialId: string): void {}
}
