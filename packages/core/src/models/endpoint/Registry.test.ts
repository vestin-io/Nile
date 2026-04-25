import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  DuplicateEndpointIdError,
  EndpointRegistry,
  EndpointRegistryValidationError,
} from "./index";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("EndpointRegistry", () => {
  it("adds and normalizes endpoint records", () => {
    const registry = EndpointRegistry.open(createTempDatabasePath());

    const record = registry.add({
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test/",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1/",
          wireApis: ["responses", "chat", "responses"],
          authSchemes: ["bearer"],
        },
        anthropic: {
          basePath: "/v1/",
          authSchemes: ["bearer", "bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
        },
      },
    });

    expect(record).toEqual({
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
        },
        anthropic: {
          basePath: "/v1",
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
        },
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    expect(registry.list()).toEqual([record]);

    registry.close();
  });

  it("updates endpoint protocols and clears profile when requested", () => {
    const registry = EndpointRegistry.open(createTempDatabasePath());
    registry.add({
      id: "azure-work",
      label: "Azure Work",
      rootUrl: "https://example.cognitiveservices.azure.com",
      profile: "azure-openai",
      protocols: {
        openai: {
          basePath: "/openai/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });

    const updated = registry.update("azure-work", {
      label: "Azure Shared",
      rootUrl: "https://example.cognitiveservices.azure.com/",
      profile: null,
      protocols: {
        openai: {
          wireApis: ["chat"],
          authSchemes: ["bearer"],
        },
      },
    });

    expect(updated.label).toBe("Azure Shared");
    expect(updated.rootUrl).toBe("https://example.cognitiveservices.azure.com");
    expect(updated.profile).toBeUndefined();
    expect(updated.protocols).toEqual({
      openai: {
        wireApis: ["chat"],
        authSchemes: ["bearer"],
      },
    });

    registry.close();
  });

  it("rejects invalid protocol shapes", () => {
    const registry = EndpointRegistry.open(createTempDatabasePath());

    expect(() => registry.add({
      id: "broken",
      label: "Broken",
      rootUrl: "https://example.com",
      protocols: {},
    })).toThrow(EndpointRegistryValidationError);

    expect(() => registry.add({
      id: "broken-openai",
      label: "Broken OpenAI",
      rootUrl: "https://example.com",
      protocols: {
        openai: {
          basePath: "v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    })).toThrow("OpenAI base path must start with /");

    expect(() => registry.add({
      id: "broken-anthropic",
      label: "Broken Anthropic",
      rootUrl: "https://example.com",
      protocols: {
        anthropic: {
          authSchemes: ["oauth_bundle" as never],
        },
      },
    })).toThrow("Unsupported Anthropic auth scheme");

    registry.close();
  });

  it("rejects duplicate ids", () => {
    const registry = EndpointRegistry.open(createTempDatabasePath());
    registry.add({
      id: "openai-official",
      label: "OpenAI Official",
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

    expect(() => registry.add({
      id: "openai-official",
      label: "OpenAI Official 2",
      rootUrl: "https://api.openai.com",
      protocols: {
        openai: {
          wireApis: ["chat"],
          authSchemes: ["bearer"],
        },
      },
    })).toThrow(DuplicateEndpointIdError);

    registry.close();
  });
});

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-endpoint-registry-"));
  tempDirs.push(dir);
  return join(dir, "switcher.sqlite");
}
