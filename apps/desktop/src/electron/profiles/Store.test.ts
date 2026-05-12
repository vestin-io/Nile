import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteDatabase } from "@nile/core/services/database";

import { WorkspaceProfileStore } from "./Store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("WorkspaceProfileStore", () => {
  it("stores sparse per-agent profile assignments", () => {
    const { databasePath } = createStorePaths();
    const store = new WorkspaceProfileStore(databasePath);

    const profile = store.create({
      name: " Work ",
      emoji: "💼",
      assignments: [
        { agentId: "codex", connectionId: "openai-work", homePath: null },
        { agentId: "claude", homePath: "/tmp/claude-work" },
      ],
    });

    expect(profile.name).toBe("Work");
    expect(profile.emoji).toBe("💼");
    expect(store.list()).toEqual([profile]);
    const database = SqliteDatabase.open(databasePath);
    try {
      expect(database.query<{ id: string; name: string; emoji: string | null }>("SELECT id, name, emoji FROM desktop_workspace_profiles").all()).toEqual([
        { id: profile.id, name: "Work", emoji: "💼" },
      ]);
    } finally {
      database.close();
    }
  });

  it("updates and deletes a profile without touching other profiles", () => {
    const { databasePath } = createStorePaths();
    const store = new WorkspaceProfileStore(databasePath);
    const work = store.create({ name: "Work", assignments: [{ agentId: "codex", connectionId: "work" }] });
    const personal = store.create({ name: "Personal", assignments: [{ agentId: "codex", connectionId: "home" }] });

    expect(store.update(work.id, {
      name: "Company",
      emoji: "🚀",
      assignments: [{ agentId: "codex", connectionId: "company", homePath: null }],
    })).toEqual({
      ...work,
      assignments: [{ agentId: "codex", connectionId: "company", homePath: null }],
      name: "Company",
      emoji: "🚀",
    });
    store.delete(personal.id);

    expect(store.list()).toEqual([
      { ...work, assignments: [{ agentId: "codex", connectionId: "company", homePath: null }], name: "Company", emoji: "🚀" },
    ]);
  });

  it("rejects duplicate profile names during create and rename", () => {
    const { databasePath } = createStorePaths();
    const store = new WorkspaceProfileStore(databasePath);
    const work = store.create({ name: "Work", assignments: [{ agentId: "codex", connectionId: "work" }] });
    const personal = store.create({ name: "Personal", assignments: [{ agentId: "claude", connectionId: "home" }] });

    expect(() => store.create({
      name: " work ",
      assignments: [{ agentId: "cursor", connectionId: "another-work" }],
    })).toThrowError("Workspace profile name already exists: work");

    expect(() => store.update(personal.id, {
      name: "WORK",
      assignments: personal.assignments,
    })).toThrowError("Workspace profile name already exists: WORK");

    expect(store.update(work.id, {
      name: " work ",
      assignments: work.assignments,
    })).toEqual({
      ...work,
      name: "work",
    });
  });

  it("updates profile assignments without changing other profiles", () => {
    const { databasePath } = createStorePaths();
    const store = new WorkspaceProfileStore(databasePath);
    const work = store.create({ name: "Work", assignments: [{ agentId: "codex", connectionId: "work" }] });
    const personal = store.create({ name: "Personal", assignments: [{ agentId: "claude", connectionId: "home" }] });

    const updated = store.update(work.id, {
      name: work.name,
      assignments: [
        { agentId: "codex", connectionId: "company", homePath: null },
        { agentId: "claude", homePath: "/tmp/claude-company" },
      ],
    });

    expect(updated).toEqual({
      ...work,
      assignments: [
        { agentId: "codex", connectionId: "company", homePath: null },
        { agentId: "claude", homePath: "/tmp/claude-company" },
      ],
    });
    expect(store.list()).toEqual([
      updated,
      personal,
    ]);
  });

  it("upgrades early sqlite assignment rows that predate home_path_kind", () => {
    const { databasePath } = createStorePaths();
    const database = SqliteDatabase.open(databasePath);
    try {
      database.exec(`
        CREATE TABLE desktop_workspace_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          emoji TEXT
        );

        CREATE TABLE desktop_workspace_profile_assignments (
          profile_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          connection_id TEXT,
          home_path TEXT
        );
      `);
      database.run(
        "INSERT INTO desktop_workspace_profiles (id, name, emoji) VALUES (?, ?, ?)",
        "profile-1",
        "Work",
        null,
      );
      database.run(
        `
          INSERT INTO desktop_workspace_profile_assignments (profile_id, agent_id, connection_id, home_path)
          VALUES (?, ?, ?, ?)
        `,
        "profile-1",
        "codex",
        "work",
        null,
      );
      database.run(
        `
          INSERT INTO desktop_workspace_profile_assignments (profile_id, agent_id, connection_id, home_path)
          VALUES (?, ?, ?, ?)
        `,
        "profile-1",
        "claude",
        null,
        null,
      );
      database.run(
        `
          INSERT INTO desktop_workspace_profile_assignments (profile_id, agent_id, connection_id, home_path)
          VALUES (?, ?, ?, ?)
        `,
        "profile-1",
        "cursor",
        "cursor-work",
        "/tmp/cursor-work",
      );
    } finally {
      database.close();
    }

    const store = new WorkspaceProfileStore(databasePath);

    expect(store.list()).toEqual([{
      id: "profile-1",
      name: "Work",
      assignments: [
        { agentId: "codex", connectionId: "work" },
        { agentId: "claude", homePath: null },
        { agentId: "cursor", connectionId: "cursor-work", homePath: "/tmp/cursor-work" },
      ],
    }]);
  });
});

function createStorePaths(): { databasePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-profiles-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
  };
}
