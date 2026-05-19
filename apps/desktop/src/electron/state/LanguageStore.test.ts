import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { DesktopLanguageStore } from "./LanguageStore";

describe("DesktopLanguageStore", () => {
  afterEach(() => {
    for (const path of tempDirs.splice(0, tempDirs.length)) {
      rmSync(path, { force: true, recursive: true });
    }
  });

  it("defaults to english when no preference has been stored", () => {
    const store = new DesktopLanguageStore(createDatabasePath());

    expect(store.read()).toBe("en");
  });

  it("persists a supported language preference", () => {
    const store = new DesktopLanguageStore(createDatabasePath());

    expect(store.write("zh")).toBe("zh");
    expect(store.read()).toBe("zh");
  });

  it("clears the stored row when writing the english default", () => {
    const store = new DesktopLanguageStore(createDatabasePath());

    store.write("zh");
    expect(store.write("en")).toBe("en");
    expect(store.read()).toBe("en");
  });
});

const tempDirs: string[] = [];

function createDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-language-"));
  tempDirs.push(dir);
  return join(dir, "desktop.sqlite");
}
