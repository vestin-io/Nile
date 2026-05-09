import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { WorkspaceProfileStore } from "./Store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("WorkspaceProfileStore", () => {
  it("stores sparse per-agent profile assignments", () => {
    const path = createStorePath();
    const store = new WorkspaceProfileStore(path);

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
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      profiles: [profile],
    });
  });

  it("updates and deletes a profile without touching other profiles", () => {
    const store = new WorkspaceProfileStore(createStorePath());
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
    const store = new WorkspaceProfileStore(createStorePath());
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
    const store = new WorkspaceProfileStore(createStorePath());
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

  it("drops invalid persisted assignments while preserving valid ones", () => {
    const path = createStorePath();
    writeFileSync(path, JSON.stringify({
      profiles: [
        {
          id: "profile-1",
          name: "Work",
          assignments: [
            { agentId: "codex", connectionId: "work" },
            { agentId: "unknown", connectionId: "bad" },
            { agentId: "claude", homePath: "" },
          ],
        },
      ],
    }), "utf8");

    const store = new WorkspaceProfileStore(path);

    expect(store.list()).toEqual([
      {
        id: "profile-1",
        name: "Work",
        assignments: [{ agentId: "codex", connectionId: "work" }],
      },
    ]);
  });
});

function createStorePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-profiles-"));
  tempDirs.push(dir);
  return join(dir, "profiles.json");
}
