import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ResetStateResult } from "@nile/core/application/local";

import { DesktopStateReset } from "./Reset";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopStateReset", () => {
  it("removes desktop-local state files in addition to delegating workspace reset", () => {
    const root = mkdtempSync(join(tmpdir(), "nile-desktop-reset-"));
    tempDirs.push(root);
    const homesPath = join(root, "desktop-agent-homes.json");
    const notificationMutePath = join(root, "desktop-notification-mute.json");
    const profilesPath = join(root, "desktop-profiles.json");
    const profileFeaturePath = join(root, "desktop-profile-feature.json");
    writeFileSync(homesPath, "{}\n", "utf8");
    writeFileSync(notificationMutePath, "{}\n", "utf8");
    writeFileSync(profilesPath, "{}\n", "utf8");
    writeFileSync(profileFeaturePath, "{}\n", "utf8");

    const delegate = new StubStateReset();
    let resetLocalStateCalls = 0;
    const reset = new DesktopStateReset({
      localStatePaths: [homesPath, notificationMutePath, profilesPath, profileFeaturePath],
      onResetLocalState: () => {
        resetLocalStateCalls += 1;
      },
      stateReset: delegate,
    });

    const result = reset.reset(join(root, "switcher.sqlite"));

    expect(result).toEqual(delegate.result);
    expect(delegate.databasePaths).toEqual([join(root, "switcher.sqlite")]);
    expect(existsSync(homesPath)).toBe(false);
    expect(existsSync(notificationMutePath)).toBe(false);
    expect(existsSync(profilesPath)).toBe(false);
    expect(existsSync(profileFeaturePath)).toBe(false);
    expect(resetLocalStateCalls).toBe(1);
  });
});

class StubStateReset {
  readonly databasePaths: string[] = [];
  readonly result: ResetStateResult = {
    databasePath: "/tmp/test.sqlite",
    historyPath: "/tmp/history",
    credentialsRemoved: true,
    databaseRemoved: true,
    historyRemoved: true,
  };

  reset(databasePath: string): ResetStateResult {
    this.databasePaths.push(databasePath);
    return this.result;
  }
}
