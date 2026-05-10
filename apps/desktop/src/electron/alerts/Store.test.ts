import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "@nile/core/services/database";

import { ConnectionAlertStore } from "./Store";

describe("ConnectionAlertStore", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("creates, updates, and deletes connection alerts", () => {
    const store = createStore(tempDirs);

    const created = store.create({
      connectionId: "codex-work",
      metricKey: "5h",
      metricLabel: "5h",
      type: "low-percent",
      thresholdPercent: 65,
      enabled: true,
    });
    const updated = store.update({
      connectionId: "codex-work",
      alertId: created.id,
      metricKey: "5h",
      metricLabel: "5h",
      type: "low-percent",
      thresholdPercent: 45,
      enabled: false,
    });

    expect(store.list("codex-work")).toEqual([updated]);

    store.delete("codex-work", updated.id);

    expect(store.list("codex-work")).toEqual([]);
  });

  it("rejects duplicate metric thresholds for the same connection", () => {
    const store = createStore(tempDirs);
    store.create({
      connectionId: "codex-work",
      metricKey: "5h",
      metricLabel: "5h",
      type: "low-percent",
      thresholdPercent: 65,
      enabled: true,
    });

    expect(() => store.create({
      connectionId: "codex-work",
      metricKey: "5h",
      metricLabel: "5h",
      type: "low-percent",
      thresholdPercent: 65,
      enabled: true,
    })).toThrow("Connection alert already exists");
  });

  it("allows one renewed alert per metric and rejects duplicates", () => {
    const store = createStore(tempDirs);

    const renewed = store.create({
      connectionId: "codex-work",
      metricKey: "weekly",
      metricLabel: "weekly",
      type: "renewed",
      enabled: true,
    });

    expect(renewed).toMatchObject({
      type: "renewed",
      metricKey: "weekly",
      metricLabel: "weekly",
      enabled: true,
    });
    expect(() => store.create({
      connectionId: "codex-work",
      metricKey: "weekly",
      metricLabel: "weekly",
      type: "renewed",
      enabled: true,
    })).toThrow("Connection alert already exists");
  });

  it("reads legacy low-percent alerts without a stored type", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-connection-alerts-"));
    tempDirs.push(dir);
    const databasePath = join(dir, "desktop.sqlite");
    const legacyPath = join(dir, "desktop-connection-alerts.json");
    writeFileSync(legacyPath, `${JSON.stringify({
      alertsByConnectionId: {
        "codex-work": [{
          id: "legacy-alert",
          metricKey: "5h",
          thresholdPercent: 65,
          enabled: true,
        }],
      },
    }, null, 2)}\n`, "utf8");

    const store = new ConnectionAlertStore(databasePath, legacyPath);

    expect(store.list("codex-work")).toEqual([{
      id: "legacy-alert",
      type: "low-percent",
      metricKey: "5h",
      metricLabel: "5h",
      thresholdPercent: 65,
      enabled: true,
    }]);
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("persists renewed alerts with their type", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-connection-alerts-"));
    tempDirs.push(dir);
    const databasePath = join(dir, "desktop.sqlite");
    const store = new ConnectionAlertStore(databasePath);

    store.create({
      connectionId: "codex-work",
      metricKey: "weekly",
      metricLabel: "weekly",
      type: "renewed",
      enabled: false,
    });

    const database = SqliteDatabase.open(databasePath);
    try {
      expect(database.query<{
        connection_id: string;
        metric_key: string;
        metric_label: string;
        type: string;
        threshold_percent: number | null;
        enabled: number;
      }>(
        "SELECT connection_id, metric_key, metric_label, type, threshold_percent, enabled FROM desktop_connection_alerts",
      ).all()).toEqual([{
        connection_id: "codex-work",
        metric_key: "weekly",
        metric_label: "weekly",
        type: "renewed",
        threshold_percent: null,
        enabled: 0,
      }]);
    } finally {
      database.close();
    }
  });

  it("treats invalid config shapes as empty alerts", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-connection-alerts-"));
    tempDirs.push(dir);
    const databasePath = join(dir, "desktop.sqlite");
    const legacyPath = join(dir, "desktop-connection-alerts.json");
    writeFileSync(legacyPath, "[]\n", "utf8");
    const store = new ConnectionAlertStore(databasePath, legacyPath);

    expect(store.list("codex-work")).toEqual([]);
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("treats invalid json as empty alerts", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-connection-alerts-"));
    tempDirs.push(dir);
    const databasePath = join(dir, "desktop.sqlite");
    const legacyPath = join(dir, "desktop-connection-alerts.json");
    writeFileSync(legacyPath, "{ invalid }\n", "utf8");
    const store = new ConnectionAlertStore(databasePath, legacyPath);

    expect(store.list("codex-work")).toEqual([]);
    expect(existsSync(legacyPath)).toBe(false);
  });
});

function createStore(tempDirs: string[]): ConnectionAlertStore {
  const dir = mkdtempSync(join(tmpdir(), "nile-connection-alerts-"));
  tempDirs.push(dir);
  return new ConnectionAlertStore(join(dir, "desktop.sqlite"));
}
