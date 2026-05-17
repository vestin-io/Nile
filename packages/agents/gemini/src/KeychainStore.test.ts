import { describe, expect, it } from "vitest";

import { GeminiKeychainCredentialStore } from "./KeychainStore";

describe("GeminiKeychainCredentialStore", () => {
  it("reads a complete keychain-backed Gemini OAuth credential", () => {
    const client = new MemoryGenericPasswordClient();
    const store = new GeminiKeychainCredentialStore(client);

    store.apply({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken: "id-token",
      expiryDate: 123,
    });

    expect(store.readCredential()).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken: "id-token",
      expiryDate: 123,
    });
  });

  it("returns null when the stored keychain payload is incomplete", () => {
    const client = new MemoryGenericPasswordClient();
    const store = new GeminiKeychainCredentialStore(client);

    client.secret = JSON.stringify({ access_token: "only-access" });

    expect(store.readCredential()).toBeNull();
  });

  it("restores a missing snapshot by removing the keychain item", () => {
    const client = new MemoryGenericPasswordClient();
    const store = new GeminiKeychainCredentialStore(client);

    store.apply({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      idToken: "id-token",
    });
    store.restore(null);

    expect(store.snapshot()).toBeNull();
  });

  it("treats invalid-parameter keychain probe errors as unavailable", () => {
    const store = new GeminiKeychainCredentialStore(new InvalidParameterClient());

    expect(store.snapshot()).toBeNull();
    expect(store.hasCredential()).toBe(false);
  });
});

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

class InvalidParameterClient {
  read() {
    return {
      exitCode: 50,
      stdout: "",
      stderr: "One or more parameters passed to a function were not valid.",
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
