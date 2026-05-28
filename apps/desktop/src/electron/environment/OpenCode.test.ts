import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { DesktopOpenCodeEnvironmentReader } from "./OpenCode";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopOpenCodeEnvironmentReader", () => {
  it("reads managed env keys from Nile-managed providers", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-opencode-environment-"));
    tempDirs.push(dir);
    const opencodeHome = join(dir, ".config", "opencode");
    mkdirSync(opencodeHome, { recursive: true });
    writeFileSync(
      join(opencodeHome, "opencode.json"),
      `${JSON.stringify(
        {
          provider: {
            "nile-old-connection": {
              npm: "@ai-sdk/openai-compatible",
              options: {
                baseURL: "https://old.example/v1",
                apiKey: "{env:NILE_OLD_CONNECTION_API_KEY}",
              },
            },
            "nile-keep-connection": {
              npm: "@ai-sdk/anthropic",
              options: {
                apiKey: "{env:NILE_KEEP_CONNECTION_API_KEY}",
              },
            },
            "other-provider": {
              npm: "@ai-sdk/openai-compatible",
              options: {
                baseURL: "https://other.example/v1",
                apiKey: "{env:OTHER_KEY}",
              },
            },
          },
          model: "nile-keep-connection/gpt-5.5",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(new DesktopOpenCodeEnvironmentReader(opencodeHome).readManagedEnvKeys()).toEqual([
      "NILE_KEEP_CONNECTION_API_KEY",
      "NILE_OLD_CONNECTION_API_KEY",
    ]);
  });
});
