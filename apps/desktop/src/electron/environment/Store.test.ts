import { describe, expect, it } from "vitest";
import { join } from "node:path";

import {
  readDesktopHelperPathCandidates,
  shouldUseDesktopEnvironmentFileStore,
} from "./Store";

describe("DesktopEnvironmentStore", () => {
  it("checks the workspace core helper before falling back to colocated helper paths", () => {
    const candidates = readDesktopHelperPathCandidates(
      "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment",
    );

    expect(candidates[0]).toBe(
      join(
        "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment",
        "..",
        "..",
        "..",
        "..",
        "..",
        "packages",
        "core",
        "dist",
        "services",
        "credential",
        "KeychainGenericPasswordHelper",
      ),
    );
    expect(candidates).toContain(
      join(
        "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment",
        "KeychainGenericPasswordHelper",
      ),
    );
  });

  it("enables the file-backed environment store only on Windows", () => {
    expect(shouldUseDesktopEnvironmentFileStore("win32")).toBe(true);
    expect(shouldUseDesktopEnvironmentFileStore("darwin")).toBe(false);
    expect(shouldUseDesktopEnvironmentFileStore("linux")).toBe(false);
  });
});
