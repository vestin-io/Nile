import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { DesktopProfileFeatureStore } from "./ProfileFeatureStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopProfileFeatureStore", () => {
  it("defaults to enabled when no config exists", () => {
    const store = new DesktopProfileFeatureStore(createStorePath());

    expect(store.read()).toBe(true);
  });

  it("stores disabled when turning profile usage off", () => {
    const path = createStorePath();
    const store = new DesktopProfileFeatureStore(path);

    expect(store.write(false)).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ enabled: false });
    expect(store.read()).toBe(false);
  });

  it("drops the config file when restoring the default enabled state", () => {
    const path = createStorePath();
    const store = new DesktopProfileFeatureStore(path);
    store.write(false);

    expect(store.write(true)).toBe(true);
    expect(store.read()).toBe(true);
  });

  it("treats invalid config shapes as errors", () => {
    const path = createStorePath();
    writeFileSync(path, "[]\n", "utf8");
    const store = new DesktopProfileFeatureStore(path);

    expect(() => store.read()).toThrow("Desktop profile feature config must contain a JSON object");
  });
});

function createStorePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-profile-feature-"));
  tempDirs.push(dir);
  return join(dir, "profile-feature.json");
}
