import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GeminiCredentialStore } from "./CredentialStore";

const tempDirs: string[] = [];

describe("GeminiCredentialStore", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("reads a complete Gemini OAuth credential file", () => {
    const geminiHome = createGeminiHome();
    const store = new GeminiCredentialStore(geminiHome);

    store.apply({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken: "id-token",
      expiryDate: 123,
      tokenType: "Bearer",
      scope: "openid email",
    });

    expect(store.readCredential()).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken: "id-token",
      expiryDate: 123,
      tokenType: "Bearer",
      scope: "openid email",
    });
  });

  it("returns null when required fields are missing", () => {
    const geminiHome = createGeminiHome();
    const store = new GeminiCredentialStore(geminiHome);

    store.restore(JSON.stringify({ access_token: "only-access" }));

    expect(store.readCredential()).toBeNull();
  });

  it("writes oauth_creds.json with owner-only permissions", () => {
    const geminiHome = createGeminiHome();
    const store = new GeminiCredentialStore(geminiHome);

    store.apply({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken: "id-token",
    });

    const fileMode = statSync(store.credentialsPath).mode & 0o777;
    expect(fileMode).toBe(0o600);
    expect(JSON.parse(readFileSync(store.credentialsPath, "utf8"))).toEqual({
      access_token: "access-token",
      refresh_token: "refresh-token",
      id_token: "id-token",
    });
  });
});

function createGeminiHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-credential-store-"));
  tempDirs.push(dir);
  return join(dir, ".gemini");
}
