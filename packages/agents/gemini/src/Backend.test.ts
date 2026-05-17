import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GeminiCredentialBackend } from "./Backend";
import { GeminiCredentialStore } from "./CredentialStore";
import { GeminiKeychainCredentialStore } from "./KeychainStore";

const tempDirs: string[] = [];

describe("GeminiCredentialBackend", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("prefers a keychain-backed credential over the file fallback", () => {
    const client = new MemoryGenericPasswordClient();
    const fileStore = new GeminiCredentialStore(createGeminiHome());
    const keychainStore = new GeminiKeychainCredentialStore(client);
    const backend = new GeminiCredentialBackend(fileStore, keychainStore);

    fileStore.apply({
      accessToken: "file-access",
      refreshToken: "file-refresh",
      idToken: "file-id",
    });
    keychainStore.apply({
      accessToken: "keychain-access",
      refreshToken: "keychain-refresh",
      idToken: "keychain-id",
    });

    expect(backend.readCurrent()).toEqual({
      kind: "resolved",
      backendKind: "keychain",
      credential: {
        accessToken: "keychain-access",
        refreshToken: "keychain-refresh",
        idToken: "keychain-id",
      },
    });
  });

  it("treats a malformed keychain credential as invalid even when the file fallback is valid", () => {
    const client = new MemoryGenericPasswordClient();
    const fileStore = new GeminiCredentialStore(createGeminiHome());
    const keychainStore = new GeminiKeychainCredentialStore(client);
    const backend = new GeminiCredentialBackend(fileStore, keychainStore);

    fileStore.apply({
      accessToken: "file-access",
      refreshToken: "file-refresh",
      idToken: "file-id",
    });
    client.secret = JSON.stringify({ access_token: "only-access" });

    expect(backend.readCurrent()).toEqual({
      kind: "invalid_semantics",
      issue: "Gemini keychain OAuth credential is incomplete",
    });
  });

  it("writes back to the file backend when no current credential exists", () => {
    const client = new MemoryGenericPasswordClient();
    const fileStore = new GeminiCredentialStore(createGeminiHome());
    const keychainStore = new GeminiKeychainCredentialStore(client);
    const backend = new GeminiCredentialBackend(fileStore, keychainStore);

    expect(backend.apply({
      kind: "gemini_cli_session",
      accessToken: "new-access",
      refreshToken: "new-refresh",
      idToken: "new-id",
    })).toBe("file-default");

    expect(fileStore.readCredential()).toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      idToken: "new-id",
    });
    expect(client.secret).toBeNull();
  });

  it("falls back to the file backend when the keychain helper is unavailable", () => {
    const fileStore = new GeminiCredentialStore(createGeminiHome());
    const keychainStore = new GeminiKeychainCredentialStore(new MissingHelperClient());
    const backend = new GeminiCredentialBackend(fileStore, keychainStore);

    fileStore.apply({
      accessToken: "file-access",
      refreshToken: "file-refresh",
      idToken: "file-id",
    });

    expect(backend.readCurrent()).toEqual({
      kind: "resolved",
      backendKind: "file",
      credential: {
        accessToken: "file-access",
        refreshToken: "file-refresh",
        idToken: "file-id",
      },
    });
  });

  it("falls back to the file backend when keychain probing reports invalid parameters", () => {
    const fileStore = new GeminiCredentialStore(createGeminiHome());
    const keychainStore = new GeminiKeychainCredentialStore(new InvalidParametersClient());
    const backend = new GeminiCredentialBackend(fileStore, keychainStore);

    fileStore.apply({
      accessToken: "file-access",
      refreshToken: "file-refresh",
      idToken: "file-id",
    });

    expect(backend.readCurrent()).toEqual({
      kind: "resolved",
      backendKind: "file",
      credential: {
        accessToken: "file-access",
        refreshToken: "file-refresh",
        idToken: "file-id",
      },
    });
  });

  it("falls back to the file backend when the keychain helper path resolution throws", () => {
    const fileStore = new GeminiCredentialStore(createGeminiHome());
    const keychainStore = new GeminiKeychainCredentialStore(new ThrowingHelperClient());
    const backend = new GeminiCredentialBackend(fileStore, keychainStore);

    fileStore.apply({
      accessToken: "file-access",
      refreshToken: "file-refresh",
      idToken: "file-id",
    });

    expect(backend.readCurrent()).toEqual({
      kind: "resolved",
      backendKind: "file",
      credential: {
        accessToken: "file-access",
        refreshToken: "file-refresh",
        idToken: "file-id",
      },
    });
  });

  it("restores both keychain and file snapshots", () => {
    const client = new MemoryGenericPasswordClient();
    const fileStore = new GeminiCredentialStore(createGeminiHome());
    const keychainStore = new GeminiKeychainCredentialStore(client);
    const backend = new GeminiCredentialBackend(fileStore, keychainStore);

    const snapshot = {
      keychain: JSON.stringify({
        access_token: "keychain-access",
        refresh_token: "keychain-refresh",
        id_token: "keychain-id",
      }),
      file: JSON.stringify({
        access_token: "file-access",
        refresh_token: "file-refresh",
        id_token: "file-id",
      }),
    } as const;

    backend.restoreSnapshot(snapshot);

    expect(keychainStore.readCredential()).toEqual({
      accessToken: "keychain-access",
      refreshToken: "keychain-refresh",
      idToken: "keychain-id",
    });
    expect(fileStore.readCredential()).toEqual({
      accessToken: "file-access",
      refreshToken: "file-refresh",
      idToken: "file-id",
    });
  });
});

function createGeminiHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-backend-"));
  tempDirs.push(dir);
  return join(dir, ".gemini");
}

class MemoryGenericPasswordClient {
  secret: string | null = null;

  read(input: { includeSecret: boolean }) {
    if (this.secret === null) {
      return {
        exitCode: 44,
        stdout: "",
        stderr: "The specified item could not be found in the keychain.",
      };
    }

    return {
      exitCode: 0,
      stdout: input.includeSecret ? this.secret : "",
      stderr: "",
    };
  }

  write(input: { secret: string }) {
    this.secret = input.secret;
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  remove() {
    this.secret = null;
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }
}

class MissingHelperClient {
  read() {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "",
      errorMessage: "Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.",
    };
  }

  write() {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "",
      errorMessage: "Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.",
    };
  }

  remove() {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "",
      errorMessage: "Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.",
    };
  }
}

class InvalidParametersClient {
  read() {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "",
      errorMessage: "One or more parameters passed to a function were not valid.",
    };
  }

  write() {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "",
      errorMessage: "One or more parameters passed to a function were not valid.",
    };
  }

  remove() {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "",
      errorMessage: "One or more parameters passed to a function were not valid.",
    };
  }
}

class ThrowingHelperClient {
  read(): never {
    throw new Error("Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.");
  }

  write(): never {
    throw new Error("Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.");
  }

  remove(): never {
    throw new Error("Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.");
  }
}
