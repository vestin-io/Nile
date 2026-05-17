import { describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { LiveSetupReader } from "./Reader";

describe("Cursor LiveSetupReader", () => {
  it("returns an invalid result when cursor keychain credentials cannot be read", () => {
    const reader = new LiveSetupReader(
      {
        readState: () => ({
          backendUrl: "https://api2.cursor.sh",
        }),
      } as never,
      {
        snapshot: () => {
          throw new Error("Failed to read Cursor keychain entry for cursor-access-token: unknown error");
        },
      } as never,
      EnvironmentSource.empty(),
    );

    expect(reader.read()).toEqual({
      kind: "invalid_semantics",
      issues: ["Failed to read Cursor keychain entry for cursor-access-token: unknown error"],
      endpoint: {
        endpointFamily: "cursor",
        endpointIdHint: "cursor",
        labelHint: "Cursor",
        baseUrl: "https://api2.cursor.sh",
        envKey: "CURSOR_API_KEY",
      },
      access: null,
    });
  });
});
