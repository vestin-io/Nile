import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultAgentHomes } from "@nile/core/models/agent";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";

import { InteractivePrompt, type CliInputResult, type CliSelectResult } from "./InteractivePrompt";
import { NileCli } from "./NileCli";

describe("NileCli reset", () => {
  it("removes the configured database and sibling history directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "nile-cli-reset-"));
    try {
      const databasePath = join(root, "switcher.sqlite");
      const historyPath = join(root, "history");

      writeFileSync(databasePath, "sqlite");
      mkdirSync(join(historyPath, "mutation-1"), { recursive: true });
      writeFileSync(join(historyPath, "mutation-1", "before.json"), "{}");

      const cli = createCli(databasePath);
      const result = await cli.run(["reset", "--yes", "--confirm-reset"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        [
          "Local Nile state reset",
          `database: removed (${databasePath})`,
          `history: removed (${historyPath})`,
          "credentials: no Nile-managed credential entries or local credential files found",
          "",
        ].join("\n"),
      );
      expect(existsSync(databasePath)).toBe(false);
      expect(existsSync(historyPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports an already empty state when no files exist", async () => {
    const root = mkdtempSync(join(tmpdir(), "nile-cli-reset-empty-"));
    try {
      const databasePath = join(root, "switcher.sqlite");
      const historyPath = join(root, "history");

      const cli = createCli(databasePath);
      const result = await cli.run(["reset", "--yes", "--confirm-reset", "--json"]);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        databasePath,
        historyPath,
        databaseRemoved: false,
        historyRemoved: false,
        credentialsRemoved: false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires double confirmation in non-interactive mode", async () => {
    const root = mkdtempSync(join(tmpdir(), "nile-cli-reset-confirm-"));
    try {
      const databasePath = join(root, "switcher.sqlite");
      mkdirSync(dirname(databasePath), { recursive: true });
      writeFileSync(databasePath, "sqlite");

      const cli = createCli(databasePath);
      const result = await cli.run(["reset"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("reset requires --yes --confirm-reset when not running interactively");
      expect(existsSync(databasePath)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prompts twice before resetting in interactive mode", async () => {
    const root = mkdtempSync(join(tmpdir(), "nile-cli-reset-interactive-"));
    try {
      const databasePath = join(root, "switcher.sqlite");
      const historyPath = join(root, "history");

      writeFileSync(databasePath, "sqlite");
      mkdirSync(join(historyPath, "mutation-1"), { recursive: true });
      writeFileSync(join(historyPath, "mutation-1", "before.json"), "{}");

      const prompt = new StubInteractivePrompt(
        [{ type: "selected", value: "reset" }],
        [{ type: "value", value: "RESET" }],
      );
      const cli = createCli(databasePath, prompt);
      const result = await cli.run(["reset"]);

      expect(result.exitCode).toBe(0);
      expect(prompt.selectCalls).toEqual(["Reset local Nile state on this machine?"]);
      expect(prompt.inputCalls).toEqual(["Type RESET to confirm"]);
      expect(existsSync(databasePath)).toBe(false);
      expect(existsSync(historyPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes sibling encrypted-local credential files during reset", async () => {
    const root = mkdtempSync(join(tmpdir(), "nile-cli-reset-credentials-"));
    try {
      const databasePath = join(root, "switcher.sqlite");
      const credentialPath = join(root, "credentials", "encrypted-local.v1.json");

      mkdirSync(dirname(credentialPath), { recursive: true });
      writeFileSync(credentialPath, "{\"schemaVersion\":1}");

      const cli = createCli(databasePath);
      const result = await cli.run(["reset", "--yes", "--confirm-reset"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "credentials: removed Nile-managed credential entries or local credential files",
      );
      expect(existsSync(credentialPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function createCli(databasePath: string, prompt?: InteractivePrompt): NileCli {
  return new NileCli({
    databasePath,
    agentHomes: defaultAgentHomes(),
    environment: EnvironmentSource.from(process.env),
    logger: NileLogger.silent(),
    prompt,
  });
}

class StubInteractivePrompt extends InteractivePrompt {
  readonly selectCalls: string[] = [];
  readonly inputCalls: string[] = [];

  constructor(
    private readonly selections: CliSelectResult<string>[],
    private readonly inputs: CliInputResult[],
  ) {
    super();
  }

  override isInteractive(): boolean {
    return true;
  }

  override async select<T extends string>(message: string): Promise<CliSelectResult<T>> {
    this.selectCalls.push(message);
    const next = this.selections.shift();
    if (!next) {
      throw new Error("Missing stub selection");
    }
    return next as CliSelectResult<T>;
  }

  override async input(message: string): Promise<CliInputResult> {
    this.inputCalls.push(message);
    const next = this.inputs.shift();
    if (!next) {
      throw new Error("Missing stub input");
    }
    return next;
  }
}
