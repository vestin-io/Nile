import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ClaudeCredentialStore } from "../Store";
import { ClaudeSettingsStore } from "../SettingsStore";
import { LiveSetupReader } from "./Reader";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("LiveSetupReader", () => {
  it("recognizes bearer-auth gateway settings via ANTHROPIC_AUTH_TOKEN", () => {
    const claudeHome = createClaudeHome();
    const settingsStore = new ClaudeSettingsStore(claudeHome);
    settingsStore.applyApiKey(
      "secret-token",
      "https://gateway.example.test/v1",
      "ANTHROPIC_AUTH_TOKEN",
    );

    const reader = new LiveSetupReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    const result = reader.read();

    expect(result).toEqual({
      kind: "resolved",
      value: {
        endpoint: {
          id: "claude",
          label: "Gateway (gateway.example.test)",
          rootUrl: "https://gateway.example.test",
          profile: "generic-gateway",
          protocols: {
            anthropic: {
              basePath: "/v1",
              authSchemes: ["bearer"],
              envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
              versionHeader: "2023-06-01",
            },
          },
        },
        access: {
          label: "Gateway (gateway.example.test) API Key",
          authMode: "api_key",
        },
        detectedEndpoint: {
          endpointFamily: "anthropic",
          endpointIdHint: "claude",
          labelHint: "Gateway (gateway.example.test)",
          baseUrl: "https://gateway.example.test/v1",
          envKey: "ANTHROPIC_AUTH_TOKEN",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret-token",
        },
        detectedAccess: {
          authMode: "api_key",
          labelHint: "Gateway (gateway.example.test) API Key",
        },
      },
    });
  });
});

function createClaudeHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-claude-live-setup-"));
  tempDirs.push(dir);
  return join(dir, ".claude");
}
