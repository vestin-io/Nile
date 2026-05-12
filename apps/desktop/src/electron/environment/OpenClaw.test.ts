import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { DesktopOpenClawEnvironmentReader } from "./OpenClaw";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopOpenClawEnvironmentReader", () => {
  it("reads managed env keys from Nile-managed providers", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-openclaw-environment-"));
    tempDirs.push(dir);
    const openclawHome = join(dir, ".openclaw");
    mkdirSync(openclawHome, { recursive: true });
    writeFileSync(
      join(openclawHome, "openclaw.json"),
      `${JSON.stringify(
        {
          agents: {
            defaults: {
              model: {
                primary: "nile-old-connection/gpt-5.3-codex",
                fallbacks: [],
              },
            },
          },
          models: {
            mode: "merge",
            providers: {
              "nile-old-connection": {
                baseUrl: "https://old.example/v1",
                apiKey: "${NILE_OLD_CONNECTION_API_KEY}",
                api: "openai-responses",
                models: [{ id: "gpt-5.3-codex", name: "gpt-5.3-codex" }],
              },
              "nile-keep-connection": {
                baseUrl: "https://keep.example/v1",
                apiKey: "${NILE_KEEP_CONNECTION_API_KEY}",
                api: "openai-responses",
                models: [{ id: "gpt-5.5", name: "gpt-5.5" }],
              },
              "other-provider": {
                baseUrl: "https://other.example/v1",
                apiKey: "${OTHER_KEY}",
                api: "openai-responses",
                models: [{ id: "gpt-5.4", name: "gpt-5.4" }],
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(new DesktopOpenClawEnvironmentReader(openclawHome).readManagedEnvKeys()).toEqual([
      "NILE_KEEP_CONNECTION_API_KEY",
      "NILE_OLD_CONNECTION_API_KEY",
    ]);
  });
});
