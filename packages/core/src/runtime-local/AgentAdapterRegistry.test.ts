import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { StoredCredential } from "../services/credential/Types";
import { AgentAdapterRegistry, AgentAdapterRegistryError } from "./AgentAdapterRegistry";
import type { AgentAdapter } from "./AgentAdapterTypes";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("AgentAdapterRegistry", () => {
  it("registers codex, cursor, claude, and openclaw with the shared adapter contract", () => {
    const setup = createSetup();
    const registry = AgentAdapterRegistry.open(setup.dbPath, {
      agentHomes: {
        codex: setup.codexHome,
        cursor: setup.cursorHome,
        claude: setup.claudeHome,
        openclaw: setup.openclawHome,
      },
      credentialStore: new StubCredentialStore(),
    });

    const codexAdapter = registry.get("codex");
    const cursorAdapter = registry.get("cursor");
    const claudeAdapter = registry.get("claude");
    const openclawAdapter = registry.get("openclaw");

    expect(codexAdapter.agentId).toBe("codex");
    expect(codexAdapter.capabilities).toEqual({
      detect: "yes",
      apply: "yes",
      import: "yes",
      history: "yes",
      rollback: "yes",
      desktopSupport: "partial",
    });

    expect(cursorAdapter.agentId).toBe("cursor");
    expect(cursorAdapter.capabilities).toEqual({
      detect: "yes",
      apply: "yes",
      import: "yes",
      history: "yes",
      rollback: "yes",
      desktopSupport: "no",
    });

    expect(claudeAdapter.agentId).toBe("claude");
    expect(claudeAdapter.capabilities).toEqual({
      detect: "yes",
      apply: "yes",
      import: "yes",
      history: "yes",
      rollback: "yes",
      desktopSupport: "partial",
    });

    expect(openclawAdapter.agentId).toBe("openclaw");
    expect(openclawAdapter.capabilities).toEqual({
      detect: "yes",
      apply: "yes",
      import: "yes",
      history: "yes",
      rollback: "yes",
      desktopSupport: "partial",
    });
  });

  it("throws for an unimplemented agent", () => {
    const setup = createSetup();
    const registry = AgentAdapterRegistry.open(setup.dbPath, {
      agentHomes: {
        codex: setup.codexHome,
        cursor: setup.cursorHome,
        claude: setup.claudeHome,
        openclaw: setup.openclawHome,
      },
      credentialStore: new StubCredentialStore(),
    });

    expect(() => registry.get("unknown-agent" as "codex")).toThrow(AgentAdapterRegistryError);
  });

  it("throws when duplicate agent adapters are registered", () => {
    const adapter = {
      agentId: "codex",
      capabilities: {
        detect: "yes",
        apply: "yes",
        import: "yes",
        history: "no",
        rollback: "no",
        desktopSupport: "no",
      },
      detectCurrentState() {
        throw new Error("not used");
      },
      detectAgentSelection() {
        throw new Error("not used");
      },
      applySelection() {
        throw new Error("not used");
      },
      importCurrentConnection() {
        throw new Error("not used");
      },
      rollbackLatestMutation() {
        throw new Error("not used");
      },
    } satisfies AgentAdapter;

    expect(() => AgentAdapterRegistry.fromAdapters([adapter, adapter])).toThrow(
      "Duplicate agent adapter registered: codex",
    );
  });
});

function createSetup(): {
  dbPath: string;
  codexHome: string;
  cursorHome: string;
  claudeHome: string;
  openclawHome: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-agent-adapter-registry-"));
  tempDirs.push(dir);
  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome: join(dir, ".codex"),
    cursorHome: join(dir, ".cursor"),
    claudeHome: join(dir, ".claude"),
    openclawHome: join(dir, ".openclaw"),
  };
}

class StubCredentialStore {
  create(_credentialId: string, _credential: StoredCredential): void {}
  update(_credentialId: string, _credential: StoredCredential): void {}
  get(_credentialId: string): StoredCredential {
    throw new Error("Not implemented");
  }
  has(_credentialId: string): boolean {
    return false;
  }
  remove(_credentialId: string): void {}
}
