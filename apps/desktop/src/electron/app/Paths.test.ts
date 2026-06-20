import { describe, expect, it } from "vitest";

import { DesktopStoragePaths } from "./Paths";

describe("DesktopStoragePaths", () => {
  it("keeps non-App-Store builds under the historical Nile home directory", () => {
    const paths = new DesktopStoragePaths({
      homeDir: "/Users/tester",
    });

    expect(paths.readDatabasePath()).toBe("/Users/tester/.nile-switcher/switcher.sqlite");
  });

  it("moves Mac App Store builds into the sandboxed userData directory", () => {
    const paths = new DesktopStoragePaths({
      isMacAppStore: true,
      userDataPath: "/Users/tester/Library/Containers/io.vestin.nile/Data/Library/Application Support/Nile",
    });

    expect(paths.readDatabasePath()).toBe(
      "/Users/tester/Library/Containers/io.vestin.nile/Data/Library/Application Support/Nile/switcher.sqlite",
    );
  });
});
