import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiCredentialBackend } from "./Backend";
import { GeminiCredentialStore } from "./CredentialStore";
import { GeminiKeychainCredentialStore } from "./KeychainStore";
import { GeminiSessionReader } from "./Reader";
import { GeminiSettingsStore } from "./SettingsStore";

const tempDirs: string[] = [];

describe("GeminiSessionReader", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("reads a coherent oauth-personal Gemini session from the file backend", () => {
    const geminiHome = createGeminiHome();
    const reader = createReader(geminiHome);
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

    expect(reader.read()).toEqual({
      kind: "resolved",
      value: {
        selectedAuthType: "oauth-personal",
        backendKind: "file",
        credential: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          idToken,
        },
        activeEmail: "gemini.primary@example.test",
        credentialEmail: "gemini.primary@example.test",
        credentialSubject: "gemini-user-1",
        identityKey: "google-sub:gemini-user-1",
        labelHint: "gemini.primary@example.test",
        issues: [],
      },
    });
  });

  it("reports a repairable mismatch when active account and id_token email disagree", () => {
    const geminiHome = createGeminiHome();
    const reader = createReader(geminiHome);
    const idToken = createIdToken({
      email: "gemini.primary@example.test",
      sub: "gemini-user-1",
    });

    new GeminiSettingsStore(geminiHome).ensureOauthPersonal();
    new GeminiAccountsStore(geminiHome).applyActive("gemini.secondary@example.test");
    new GeminiCredentialStore(geminiHome).apply({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken,
    });

    expect(reader.read()).toEqual({
      kind: "resolved",
      value: {
        selectedAuthType: "oauth-personal",
        backendKind: "file",
        credential: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          idToken,
        },
        activeEmail: "gemini.secondary@example.test",
        credentialEmail: "gemini.primary@example.test",
        credentialSubject: "gemini-user-1",
        identityKey: "google-sub:gemini-user-1",
        labelHint: "gemini.primary@example.test",
        issues: [
          "Gemini active account gemini.secondary@example.test does not match id_token email gemini.primary@example.test",
        ],
      },
    });
  });

  it("rejects sessions when Gemini is not in oauth-personal mode", () => {
    const geminiHome = createGeminiHome();
    const reader = createReader(geminiHome);

    new GeminiSettingsStore(geminiHome).applySelectedAuthType("gemini-api-key");

    expect(reader.read()).toEqual({
      kind: "invalid_semantics",
      issues: [
        "Gemini settings.json selectedType must be oauth-personal, received gemini-api-key",
      ],
    });
  });
});

function createReader(geminiHome: string): GeminiSessionReader {
  return new GeminiSessionReader(
    new GeminiCredentialBackend(
      new GeminiCredentialStore(geminiHome),
      new GeminiKeychainCredentialStore(new MemoryGenericPasswordClient()),
    ),
    new GeminiAccountsStore(geminiHome),
    new GeminiSettingsStore(geminiHome),
  );
}

function createGeminiHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-reader-"));
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

class MemoryGenericPasswordClient {
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
