import { describe, expect, it } from "vitest";

import { DesktopStateErrorNormalizer } from "./ErrorNormalizer";

describe("DesktopStateErrorNormalizer", () => {
  it("rewrites stale schema errors into a reset hint", () => {
    const normalizer = new DesktopStateErrorNormalizer();

    expect(normalizer.normalize(new Error("SQL logic error: no such column: openclaw_model_id"))).toEqual(
      new Error(
        "Local Nile state is incompatible with this app version. Reset Nile state from Settings or run `nile reset --yes`, then restart Nile.",
      ),
    );
  });

  it("rewrites unsupported saved-connection state into a reset hint", () => {
    const normalizer = new DesktopStateErrorNormalizer();

    expect(normalizer.normalize(new Error("Unhandled connection support input: gemini_cli_session"))).toEqual(
      new Error(
        "Local Nile state is incompatible with this app version. Reset Nile state from Settings or run `nile reset --yes`, then restart Nile.",
      ),
    );
  });

  it("preserves other error messages", () => {
    const normalizer = new DesktopStateErrorNormalizer();
    const error = new Error("boom");

    expect(normalizer.normalize(error)).toBe(error);
  });
});
