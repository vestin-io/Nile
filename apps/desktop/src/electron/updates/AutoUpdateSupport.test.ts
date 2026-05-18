import { describe, expect, it } from "vitest";

import {
  buildElectronUpdateFeedUrl,
  compareReleaseVersions,
  fetchElectronUpdateFeedRelease,
  isReleaseVersionNewer,
} from "./AutoUpdateSupport";

describe("AutoUpdateSupport", () => {
  it("builds the Electron public update feed URL", () => {
    expect(buildElectronUpdateFeedUrl("vestin-io/Nile", "0.16.6", "darwin", "arm64")).toBe(
      "https://update.electronjs.org/vestin-io/Nile/darwin-arm64/0.16.6",
    );
  });

  it("compares release versions numerically", () => {
    expect(compareReleaseVersions("0.16.7", "0.16.6")).toBe(1);
    expect(compareReleaseVersions("0.16.6", "0.16.7")).toBe(-1);
    expect(compareReleaseVersions("0.16.6", "0.16.6")).toBe(0);
    expect(isReleaseVersionNewer("0.16.7", "0.16.6")).toBe(true);
  });

  it("parses available releases from the update feed", async () => {
    const release = await fetchElectronUpdateFeedRelease(
      "https://example.com/feed",
      async () =>
        new Response(
          JSON.stringify({
            name: "Nile Desktop v0.16.7",
            url: "https://github.com/vestin-io/Nile/releases/download/v0.16.7/Nile-0.16.7-arm64-mac.zip",
          }),
          { status: 200 },
        ),
    );

    expect(release).toEqual({
      version: "0.16.7",
      name: "Nile Desktop v0.16.7",
      url: "https://github.com/vestin-io/Nile/releases/download/v0.16.7/Nile-0.16.7-arm64-mac.zip",
    });
  });

  it("treats empty update feed responses as up to date", async () => {
    await expect(fetchElectronUpdateFeedRelease(
      "https://example.com/feed",
      (async () => ({
        status: 204,
        ok: true,
        text: async () => "",
      })) as unknown as typeof fetch,
    )).resolves.toBeNull();
  });
});
