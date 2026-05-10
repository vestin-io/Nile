import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { DesktopNotificationHistory } from "./History";
import type { DesktopNotificationIntent } from "./Types";

describe("DesktopNotificationHistory", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stores shown notifications newest first", () => {
    const now = createNow([
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T11:00:00.000Z",
    ]);
    const history = new DesktopNotificationHistory(createDatabasePath(roots), { now });

    history.recordShown(createIntent({
      id: "profile-work",
      title: "Work profile is ready",
      scope: "profile",
      kind: "profile-rule-suggestion",
      subject: { id: "profile-work", label: "Work" },
      target: { page: "profiles", profileId: "profile-work" },
    }));
    history.recordShown(createIntent({
      id: "conn-low",
      title: "Codex quota is running low",
      scope: "connection",
      kind: "usage-threshold",
      subject: { id: "codex-work", label: "Codex Work" },
      target: { page: "connections", connectionId: "codex-work" },
    }));

    expect(history.list()).toEqual([
      expect.objectContaining({
        title: "Codex quota is running low",
        subjectId: "codex-work",
        subjectLabel: "Codex Work",
        targetConnectionId: "codex-work",
        resetAt: null,
      }),
      expect.objectContaining({
        title: "Work profile is ready",
        subjectId: "profile-work",
        subjectLabel: "Work",
        targetProfileId: "profile-work",
        resetAt: null,
      }),
    ]);
  });

  it("stores resetAt when the notification includes quota reset metadata", () => {
    const history = new DesktopNotificationHistory(createDatabasePath(roots), {
      now: createNow(["2026-05-10T10:00:00.000Z"]),
    });

    history.recordShown(createIntent({
      id: "conn-renewed",
      title: "Codex quota renewed",
      kind: "usage-renewed",
      scope: "connection",
      resetAt: "2026-05-10T15:00:00.000Z",
      target: { page: "connections", connectionId: "codex-work" },
    }));

    expect(history.list()[0]).toEqual(expect.objectContaining({
      title: "Codex quota renewed",
      resetAt: "2026-05-10T15:00:00.000Z",
    }));
  });

  it("records when a notification was clicked", () => {
    const now = createNow([
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T10:05:00.000Z",
    ]);
    const history = new DesktopNotificationHistory(createDatabasePath(roots), { now });

    const eventId = history.recordShown(createIntent({
      id: "conn-low",
      title: "Codex quota is running low",
      scope: "connection",
      kind: "usage-threshold",
      target: { page: "connections", connectionId: "codex-work" },
    }));
    history.recordClicked(eventId);

    expect(history.list()[0]?.clickedAt).toBe("2026-05-10T10:05:00.000Z");
    expect(history.list()[0]?.readAt).toBe("2026-05-10T10:05:00.000Z");
  });

  it("can mark notifications as read without marking them clicked", () => {
    const now = createNow([
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T10:10:00.000Z",
    ]);
    const history = new DesktopNotificationHistory(createDatabasePath(roots), { now });

    const firstId = history.recordShown(createIntent({
      id: "first",
      title: "First",
    }));
    const secondId = history.recordShown(createIntent({
      id: "second",
      title: "Second",
    }));

    history.markRead([firstId, secondId]);

    const entries = history.list();
    expect(entries[0]?.readAt).toBe("2026-05-10T10:10:00.000Z");
    expect(entries[0]?.clickedAt).toBeNull();
    expect(entries[1]?.readAt).toBe("2026-05-10T10:10:00.000Z");
    expect(entries[1]?.clickedAt).toBeNull();
  });

  it("can mark all notifications matching a filter as read", () => {
    const now = createNow([
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T10:01:00.000Z",
      "2026-05-10T10:02:00.000Z",
      "2026-05-10T10:10:00.000Z",
    ]);
    const history = new DesktopNotificationHistory(createDatabasePath(roots), { now });

    history.recordShown(createIntent({
      id: "conn-work-threshold",
      title: "Work threshold",
      kind: "usage-threshold",
      scope: "connection",
      subject: { id: "conn-work", label: "Work" },
      target: { page: "connections", connectionId: "conn-work" },
    }));
    history.recordShown(createIntent({
      id: "conn-home-renewed",
      title: "Home renewed",
      kind: "usage-renewed",
      scope: "connection",
      subject: { id: "conn-home", label: "Home" },
      target: { page: "connections", connectionId: "conn-home" },
    }));
    history.recordShown(createIntent({
      id: "profile-work",
      title: "Profile suggestion",
      kind: "profile-rule-suggestion",
      scope: "profile",
      target: { page: "profiles", profileId: "profile-work" },
    }));

    history.markReadByFilter({
      connectionId: "conn-work",
      kind: "alerts",
    });

    expect(history.list({ limit: 10 })).toEqual([
      expect.objectContaining({ title: "Profile suggestion", readAt: null }),
      expect.objectContaining({ title: "Home renewed", readAt: null }),
      expect.objectContaining({ title: "Work threshold", readAt: "2026-05-10T10:10:00.000Z" }),
    ]);
  });

  it("reports whether unread notifications exist", () => {
    const now = createNow([
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T10:10:00.000Z",
    ]);
    const history = new DesktopNotificationHistory(createDatabasePath(roots), { now });

    const firstId = history.recordShown(createIntent({ id: "first" }));
    history.recordShown(createIntent({ id: "second" }));

    expect(history.hasUnread()).toBe(true);

    history.markRead([firstId]);
    expect(history.hasUnread()).toBe(true);

    history.markRead(history.list().map((entry) => entry.id));
    expect(history.hasUnread()).toBe(false);
  });

  it("filters history in sqlite before applying the result limit", () => {
    const now = createNow([
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T10:01:00.000Z",
      "2026-05-10T10:02:00.000Z",
    ]);
    const history = new DesktopNotificationHistory(createDatabasePath(roots), { now });

    history.recordShown(createIntent({
      id: "conn-work-old",
      title: "Older work alert",
      kind: "usage-threshold",
      scope: "connection",
      subject: { id: "conn-work", label: "Work" },
      target: { page: "connections", connectionId: "conn-work" },
    }));
    history.recordShown(createIntent({
      id: "profile-work",
      title: "Profile suggestion",
      kind: "profile-rule-suggestion",
      scope: "profile",
      subject: { id: "profile-work", label: "Work" },
      target: { page: "profiles", profileId: "profile-work" },
    }));
    history.recordShown(createIntent({
      id: "conn-home-new",
      title: "Newer home alert",
      kind: "usage-renewed",
      scope: "connection",
      subject: { id: "conn-home", label: "Home" },
      target: { page: "connections", connectionId: "conn-home" },
    }));

    expect(history.list({
      connectionId: "conn-work",
      kind: "alerts",
      limit: 1,
    })).toEqual([
      expect.objectContaining({
        title: "Older work alert",
        targetConnectionId: "conn-work",
        kind: "usage-threshold",
      }),
    ]);
  });

  it("lists distinct connection filters from notification history", () => {
    const now = createNow([
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T10:01:00.000Z",
      "2026-05-10T10:02:00.000Z",
    ]);
    const history = new DesktopNotificationHistory(createDatabasePath(roots), { now });

    history.recordShown(createIntent({
      id: "conn-zeta",
      title: "Zeta alert",
      kind: "usage-threshold",
      scope: "connection",
      subject: { id: "conn-zeta", label: "Zeta" },
      target: { page: "connections", connectionId: "conn-zeta" },
    }));
    history.recordShown(createIntent({
      id: "profile-work",
      title: "Profile suggestion",
      kind: "profile-rule-suggestion",
      scope: "profile",
      target: { page: "profiles", profileId: "profile-work" },
    }));
    history.recordShown(createIntent({
      id: "conn-alpha",
      title: "Alpha renewed",
      kind: "usage-renewed",
      scope: "connection",
      subject: { id: "conn-alpha", label: "Alpha" },
      target: { page: "connections", connectionId: "conn-alpha" },
    }));

    expect(history.listConnections({ kind: "alerts" })).toEqual([
      { connectionId: "conn-alpha", label: "Alpha" },
      { connectionId: "conn-zeta", label: "Zeta" },
    ]);
  });
});

function createDatabasePath(roots: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "nile-notification-history-"));
  roots.push(root);
  return join(root, "switcher.sqlite");
}

function createIntent(overrides: Partial<DesktopNotificationIntent>): DesktopNotificationIntent {
  return {
    id: "notification",
    title: "Notification",
    body: "Body",
    kind: "action-required",
    scope: "connection",
    ...overrides,
  };
}

function createNow(values: string[]): () => Date {
  const queue = [...values];
  return () => new Date(queue.shift() ?? values[values.length - 1]!);
}
