import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { MutationHistory } from "./MutationHistory";
import { SecureSnapshotStore } from "./SecureSnapshotStore";
import type { AgentId } from "../../models/agent/Types";

const tempDirs: string[] = [];
const CODEX_AGENT: AgentId = "codex";

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("MutationHistory", () => {
  it("records an applied mutation and rolls it back safely", () => {
    const setup = createSetup();
    const history = MutationHistory.open(setup.dbPath, {
      secureSnapshotStore: setup.secureSnapshots,
    });

    const mutation = history.start({
      agentId: CODEX_AGENT,
      type: "apply_selection",
      connectionId: "openai-work",
      connectionLabel: "OpenAI Work",
      endpointLabel: "OpenAI",
      accessLabel: "Work Session",
      files: [
        {
          path: setup.authPath,
          content: readFileSync(setup.authPath, "utf8"),
          existedBefore: true,
          isSensitive: true,
        },
        {
          path: setup.configPath,
          content: readFileSync(setup.configPath, "utf8"),
          existedBefore: true,
        },
      ],
    });

    writeFileSync(setup.authPath, '{\n  "OPENAI_API_KEY": "next-key"\n}\n', "utf8");
    writeFileSync(setup.configPath, 'model_provider = "openai"\n', "utf8");

    history.markApplied(mutation.id, [
      { path: setup.authPath, content: readFileSync(setup.authPath, "utf8") },
      { path: setup.configPath, content: readFileSync(setup.configPath, "utf8") },
    ]);

    const rollback = history.rollbackLatest(CODEX_AGENT);

    expect(rollback.rolledBackEntry.id).toBe(mutation.id);
    expect(rollback.agentId).toBe(CODEX_AGENT);
    expect(readFileSync(setup.authPath, "utf8")).toBe('{\n  "OPENAI_API_KEY": "legacy-key"\n}\n');
    expect(readFileSync(setup.configPath, "utf8")).toBe('model_provider = "legacy"\n');

    const entries = history.list();
    expect(entries).toHaveLength(2);
    expect(entries[0].status).toBe("rolled_back");
    expect(entries[1].status).toBe("applied");
    expect(entries[1].files[0].beforeSnapshotKind).toBe("secure");
    expect(entries[1].files[1].beforeSnapshotKind).toBe("file");
    const snapshotFiles = listSnapshotFiles(setup.dbPath);
    expect(snapshotFiles).toHaveLength(2);
    expect(snapshotFiles.every((path) => path.includes("config.toml"))).toBe(true);

    history.close();
  });

  it("blocks rollback when live files drift after apply", () => {
    const setup = createSetup();
    const history = MutationHistory.open(setup.dbPath, {
      secureSnapshotStore: setup.secureSnapshots,
    });

    const mutation = history.start({
      agentId: CODEX_AGENT,
      type: "apply_selection",
      connectionId: "openai-work",
      connectionLabel: "OpenAI Work",
      endpointLabel: "OpenAI",
      accessLabel: "Work Session",
      files: [
        {
          path: setup.authPath,
          content: readFileSync(setup.authPath, "utf8"),
          existedBefore: true,
          isSensitive: true,
        },
      ],
    });

    writeFileSync(setup.authPath, '{\n  "OPENAI_API_KEY": "applied-key"\n}\n', "utf8");
    history.markApplied(mutation.id, [
      { path: setup.authPath, content: readFileSync(setup.authPath, "utf8") },
    ]);

    writeFileSync(setup.authPath, '{\n  "OPENAI_API_KEY": "externally-changed"\n}\n', "utf8");

    expect(() => history.rollbackLatest(CODEX_AGENT)).toThrow("live file drift detected");

    const entries = history.list();
    expect(entries).toHaveLength(2);
    expect(entries[0].status).toBe("failed");

    history.close();
  });

  it("does not encode sensitive file paths into secure snapshot references", () => {
    const setup = createSetup();
    const history = MutationHistory.open(setup.dbPath, {
      secureSnapshotStore: setup.secureSnapshots,
    });

    try {
      const mutation = history.start({
        agentId: CODEX_AGENT,
        type: "apply_selection",
        connectionId: "openai-work",
        connectionLabel: "OpenAI Work",
        endpointLabel: "OpenAI",
        accessLabel: "Work Session",
        files: [
          {
            path: setup.authPath,
            content: readFileSync(setup.authPath, "utf8"),
            existedBefore: true,
            isSensitive: true,
          },
        ],
      });

      expect(mutation.files[0]?.beforeSnapshotRef).not.toContain(setup.authPath);
      expect(mutation.files[0]?.beforeSnapshotRef).toContain(`${mutation.id}:secure:0`);
    } finally {
      history.close();
    }
  });
});

function createSetup(): {
  dbPath: string;
  authPath: string;
  configPath: string;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-mutation-history-"));
  tempDirs.push(dir);

  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });

  const authPath = join(codexHome, "auth.json");
  const configPath = join(codexHome, "config.toml");

  writeFileSync(authPath, '{\n  "OPENAI_API_KEY": "legacy-key"\n}\n', "utf8");
  writeFileSync(configPath, 'model_provider = "legacy"\n', "utf8");

  return {
    dbPath: join(dir, "switcher.sqlite"),
    authPath,
    configPath,
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function listSnapshotFiles(dbPath: string): string[] {
  const historyRoot = join(dirname(dbPath), "history");
  return collectFiles(historyRoot);
}

function collectFiles(root: string): string[] {
  try {
    const entries = readdirSync(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFiles(path));
        continue;
      }
      files.push(path);
    }
    return files;
  } catch {
    return [];
  }
}

class MemorySecureSnapshotStore extends SecureSnapshotStore {
  private readonly snapshots = new Map<string, string>();

  override writeBeforeSnapshot(snapshotRef: string, content: string | null) {
    this.snapshots.set(snapshotRef, content ?? "");
    return {
      snapshotRef,
      checksum: this.checksum(content),
    };
  }

  override restoreSnapshot(snapshotRef: string, targetPath: string, existedBefore: boolean): void {
    if (!existedBefore) {
      rmSync(targetPath, { force: true });
      return;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, this.snapshots.get(snapshotRef) ?? "", { encoding: "utf8", mode: 0o600 });
  }
}
