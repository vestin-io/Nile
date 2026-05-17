import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GeminiAccountsStore } from "../AccountsStore";
import { GeminiCredentialBackend } from "../Backend";
import { GeminiCredentialStore } from "../CredentialStore";
import { GeminiKeychainCredentialStore } from "../KeychainStore";
import { GeminiSessionReader } from "../Reader";
import { GeminiSettingsStore } from "../SettingsStore";
import { LiveSetupReader } from "./Reader";

const tempDirs: string[] = [];

describe("Gemini live-setup Reader", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("converts a resolved Gemini session into a shared import candidate shape", () => {
    const geminiHome = createGeminiHome();
    const idToken = createIdToken({
      email: "gemini.primary@example.test",
      sub: "gemini-user-1",
    });

    new GeminiSettingsStore(geminiHome).ensureOauthPersonal();
    new GeminiAccountsStore(geminiHome).applyActive("gemini.primary@example.test");
    new GeminiCredentialStore(geminiHome).apply({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken,
    });

    const reader = new LiveSetupReader(
      new GeminiSessionReader(
        new GeminiCredentialBackend(
          new GeminiCredentialStore(geminiHome),
          new GeminiKeychainCredentialStore(new MissingKeychainClient()),
        ),
        new GeminiAccountsStore(geminiHome),
        new GeminiSettingsStore(geminiHome),
      ),
    );

    expect(reader.read()).toEqual({
      kind: "resolved",
      value: {
        endpoint: {
          id: "gemini",
          label: "Gemini",
          rootUrl: "https://generativelanguage.googleapis.com",
          profile: "gemini-cli",
          protocols: {
            gemini: {
              authTypes: ["oauth-personal"],
            },
          },
        },
        access: {
          label: "gemini.primary@example.test",
          authMode: "gemini_cli_session",
          identityKey: "google-sub:gemini-user-1",
        },
        detectedEndpoint: {
          endpointFamily: "gemini",
          endpointIdHint: "gemini",
          labelHint: "Gemini",
          baseUrl: "https://generativelanguage.googleapis.com",
        },
        credential: {
          kind: "gemini_cli_session",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          idToken,
          tokenType: undefined,
          scope: undefined,
          expiryDate: undefined,
        },
        detectedAccess: {
          authMode: "gemini_cli_session",
          labelHint: "gemini.primary@example.test",
          identityKey: "google-sub:gemini-user-1",
        },
      },
    });
  });
});

function createGeminiHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-live-reader-"));
  tempDirs.push(dir);
  return join(dir, ".gemini");
}

function createIdToken(payload: Record<string, unknown>): string {
  return [
    encodeBase64Url(JSON.stringify({ alg: "none", typ: "JWT" })),
    encodeBase64Url(JSON.stringify(payload)),
    "",
  ].join(".");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

class MissingKeychainClient {
  read() {
    return {
      exitCode: 44,
      stdout: "",
      stderr: "The specified item could not be found in the keychain.",
    };
  }

  write() {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  remove() {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }
}
