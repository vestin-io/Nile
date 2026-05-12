import { describe, expect, it } from "vitest";

import { readDesktopHelperPathCandidates } from "./Store";

describe("DesktopEnvironmentStore", () => {
  it("checks the workspace core helper before falling back to colocated helper paths", () => {
    const candidates = readDesktopHelperPathCandidates(
      "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment",
    );

    expect(candidates[0]).toBe(
      "/Users/jiatwork/Works/nile/packages/core/dist/services/credential/KeychainGenericPasswordHelper",
    );
    expect(candidates).toContain(
      "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment/KeychainGenericPasswordHelper",
    );
  });
});
