import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ClaudeSettingsStore } from "./SettingsStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ClaudeSettingsStore", () => {
  it("writes ANTHROPIC_API_KEY by default", () => {
    const store = new ClaudeSettingsStore(createClaudeHome());

    store.applyApiKey("secret-key", "https://api.anthropic.com");

    expect(readSettings(store.settingsPath)).toEqual({
      env: {
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
        ANTHROPIC_API_KEY: "secret-key",
      },
    });
  });

  it("writes ANTHROPIC_AUTH_TOKEN when bearer auth is requested", () => {
    const store = new ClaudeSettingsStore(createClaudeHome());

    store.applyApiKey("secret-token", "https://gateway.example.test/v1", "ANTHROPIC_AUTH_TOKEN");

    expect(readSettings(store.settingsPath)).toEqual({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.test/v1",
        ANTHROPIC_AUTH_TOKEN: "secret-token",
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
      },
    });
  });

  it("clears sticky model settings when applying a gateway API key", () => {
    const store = new ClaudeSettingsStore(createClaudeHome());

    store.restore(
      JSON.stringify({
        env: {
          ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-5",
          KEEP_ME: "1",
        },
        model: "claude-opus-4-6",
        theme: "light",
      }),
    );

    store.applyApiKey("secret-token", "https://gateway.example.test", "ANTHROPIC_AUTH_TOKEN");

    expect(readSettings(store.settingsPath)).toEqual({
      env: {
        KEEP_ME: "1",
        ANTHROPIC_BASE_URL: "https://gateway.example.test",
        ANTHROPIC_AUTH_TOKEN: "secret-token",
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
      },
      theme: "light",
    });
  });

  it("pins a preferred exact gateway model from Claude's cache", () => {
    const claudeHome = createClaudeHome();
    writeGatewayModelsCache(claudeHome, {
      baseUrl: "https://gateway.example.test",
      models: [
        { id: "claude-haiku-3.5" },
        { id: "claude-opus-4-6" },
        { id: "claude-sonnet-4-5" },
        { id: "claude-sonnet-4-6" },
      ],
    });
    const store = new ClaudeSettingsStore(claudeHome);

    store.applyApiKey("secret-token", "https://gateway.example.test", "ANTHROPIC_AUTH_TOKEN");

    expect(readSettings(store.settingsPath)).toEqual({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.test",
        ANTHROPIC_AUTH_TOKEN: "secret-token",
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
      },
      model: "claude-sonnet-4-6",
    });
  });

  it("preserves an existing gateway model when it is still available", () => {
    const claudeHome = createClaudeHome();
    writeGatewayModelsCache(claudeHome, {
      baseUrl: "https://gateway.example.test",
      models: [
        { id: "claude-haiku-3.5" },
        { id: "claude-sonnet-4-6" },
      ],
    });
    const store = new ClaudeSettingsStore(claudeHome);

    store.restore(
      JSON.stringify({
        model: "claude-haiku-3.5",
      }),
    );

    store.applyApiKey("secret-token", "https://gateway.example.test", "ANTHROPIC_AUTH_TOKEN");

    expect(readSettings(store.settingsPath)).toEqual({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.test",
        ANTHROPIC_AUTH_TOKEN: "secret-token",
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
      },
      model: "claude-haiku-3.5",
    });
  });

  it("clears apiKeyHelper when applying an API key", () => {
    const store = new ClaudeSettingsStore(createClaudeHome());

    store.restore(
      JSON.stringify({
        apiKeyHelper: "~/.claude/anthropic_key_helper.sh",
        env: {
          ANTHROPIC_BASE_URL: "https://api.anthropic.com",
          CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
          ANTHROPIC_FOUNDRY_API_KEY: "foundry-secret",
          ANTHROPIC_FOUNDRY_RESOURCE: "foundry-resource",
          CLAUDE_CODE_USE_FOUNDRY: "1",
        },
        theme: "light",
      }),
    );

    store.applyApiKey("secret-key", "https://api.anthropic.com");

    expect(readSettings(store.settingsPath)).toEqual({
      env: {
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
        ANTHROPIC_API_KEY: "secret-key",
      },
      theme: "light",
    });
  });

  it("clears apiKeyHelper when applying a session", () => {
    const store = new ClaudeSettingsStore(createClaudeHome());

    store.restore(
      JSON.stringify({
        apiKeyHelper: "~/.claude/anthropic_key_helper.sh",
        env: {
          ANTHROPIC_AUTH_TOKEN: "stale-token",
          ANTHROPIC_FOUNDRY_API_KEY: "foundry-secret",
          ANTHROPIC_FOUNDRY_RESOURCE: "foundry-resource",
          CLAUDE_CODE_USE_FOUNDRY: "1",
        },
        theme: "light",
      }),
    );

    store.applySession({
      emailAddress: "jay@example.com",
      accountUuid: "acct-1",
      organizationUuid: "org-1",
      displayName: "Jay",
    });

    expect(readSettings(store.settingsPath)).toEqual({
      env: {},
      oauthAccount: {
        emailAddress: "jay@example.com",
        accountUuid: "acct-1",
        organizationUuid: "org-1",
        displayName: "Jay",
      },
      theme: "light",
    });
  });
});

function createClaudeHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-claude-settings-"));
  tempDirs.push(dir);
  return join(dir, ".claude");
}

function readSettings(settingsPath: string): unknown {
  return JSON.parse(readFileSync(settingsPath, "utf8"));
}

function writeGatewayModelsCache(claudeHome: string, cache: unknown): void {
  const cachePath = join(claudeHome, "cache", "gateway-models.json");
  mkdirSync(join(claudeHome, "cache"), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}
