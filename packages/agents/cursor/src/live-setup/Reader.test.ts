import { describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { LiveSetupReader } from "./Reader";

describe("Cursor LiveSetupReader", () => {
  it("prefers CURSOR_API_KEY before reading keychain credentials", () => {
    const reader = new LiveSetupReader(
      {
        readState: () => ({
          backendUrl: "https://api2.cursor.sh",
        }),
      } as never,
      {
        snapshot: () => {
          throw new Error("Failed to read Cursor keychain entry for cursor-access-token: security cli unavailable");
        },
      } as never,
      EnvironmentSource.from({
        CURSOR_API_KEY: "cursor-secret",
      }),
    );

    expect(reader.read()).toEqual({
      kind: "resolved",
      value: expect.objectContaining({
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "cursor-secret",
        },
        access: {
          label: "Cursor API Key",
          authMode: "api_key",
        },
      }),
    });
  });

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
