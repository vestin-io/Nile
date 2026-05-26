import { describe, expect, it } from "vitest";

import { ShellPath } from "./ShellPath";

describe("ShellPath", () => {
  it("preserves whole PATH entries when merging duplicates", () => {
    if (process.platform === "win32") {
      expect(
        ShellPath.merge(
          "C:\\nvm4w\\nodejs;C:\\Windows\\System32",
          "C:\\nvm4w\\nodejs;D:\\tools",
        ),
      ).toBe("C:\\nvm4w\\nodejs;C:\\Windows\\System32;D:\\tools");
      return;
    }

    expect(
      ShellPath.merge(
        "/usr/local/bin:/usr/bin",
        "/usr/local/bin:/opt/homebrew/bin",
      ),
    ).toBe("/usr/local/bin:/usr/bin:/opt/homebrew/bin");
  });
});
