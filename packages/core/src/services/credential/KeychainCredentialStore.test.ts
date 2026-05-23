import { describe, expect, it } from "vitest";

import {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  CredentialStoreValidationError,
  KeychainCredentialStore,
  SystemSecureCredentialStoreDeniedError,
} from "./KeychainCredentialStore";
import { type StoredCredential } from "./Types";
import { type SecurityCliResult, SecurityCli } from "./SecurityCli";
import { GenericPasswordWriter } from "./GenericPasswordWriter";

describe("KeychainCredentialStore", () => {
  it("creates credentials with the expected security command", () => {
    const writer = new StubGenericPasswordWriter([{ exitCode: 0, stdout: "", stderr: "" }]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };

    store.create("openai-work", credential);

    expect(writer.calls).toEqual([
      {
        type: "write",
        account: "openai-work",
        service: "nile.test",
        secret: "__nile_keychain_v1__:eyJraW5kIjoiYXBpX2tleSIsImFwaUtleSI6InNlY3JldC12YWx1ZSJ9",
        update: false,
      },
    ]);
  });

  it("updates existing credentials with -U", () => {
    const writer = new StubGenericPasswordWriter([
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);
    const credential: StoredCredential = { kind: "api_key", apiKey: "new-secret" };

    store.update("openai-work", credential);

    expect(writer.calls).toEqual([
      {
        type: "read",
        account: "openai-work",
        service: "nile.test",
        includeSecret: false,
      },
      {
        type: "write",
        account: "openai-work",
        service: "nile.test",
        secret: "__nile_keychain_v1__:eyJraW5kIjoiYXBpX2tleSIsImFwaUtleSI6Im5ldy1zZWNyZXQifQ==",
        update: true,
      },
    ]);
  });

  it("returns the stored secret on lookup", () => {
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };
    const writer = new StubGenericPasswordWriter([
      { exitCode: 0, stdout: JSON.stringify(credential), stderr: "" },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(store.get("openai-work")).toEqual(credential);
    expect(store.get("openai-work")).toEqual(credential);
    expect(writer.calls).toEqual([
      {
        type: "read",
        account: "openai-work",
        service: "nile.test",
        includeSecret: true,
      },
    ]);
  });

  it("returns false when has checks a missing credential", () => {
    const writer = new StubGenericPasswordWriter([
      { exitCode: 44, stdout: "", stderr: "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain." },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(store.has("missing")).toBe(false);
  });

  it("uses the in-memory cache after create", () => {
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };
    const writer = new StubGenericPasswordWriter([{ exitCode: 0, stdout: "", stderr: "" }]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    store.create("openai-work", credential);

    expect(store.has("openai-work")).toBe(true);
    expect(store.get("openai-work")).toEqual(credential);
    expect(writer.calls).toEqual([
      {
        type: "write",
        account: "openai-work",
        service: "nile.test",
        secret: "__nile_keychain_v1__:eyJraW5kIjoiYXBpX2tleSIsImFwaUtleSI6InNlY3JldC12YWx1ZSJ9",
        update: false,
      },
    ]);
  });

  it("reads legacy unencoded credential payloads", () => {
    const credential: StoredCredential = { kind: "api_key", apiKey: "legacy-secret" };
    const writer = new StubGenericPasswordWriter([
      { exitCode: 0, stdout: JSON.stringify(credential), stderr: "" },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(store.get("openai-work")).toEqual(credential);
  });

  it("maps duplicate create failures clearly", () => {
    const writer = new StubGenericPasswordWriter([
      { exitCode: 45, stdout: "", stderr: "The specified item already exists in the keychain." },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(() => store.create("openai-work", { kind: "api_key", apiKey: "secret-value" })).toThrow(
      CredentialAlreadyExistsError,
    );
  });

  it("maps missing lookup failures clearly", () => {
    const writer = new StubGenericPasswordWriter([
      { exitCode: 44, stdout: "", stderr: "The specified item could not be found in the keychain." },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(() => store.get("missing")).toThrow(CredentialNotFoundError);
  });

  it("rejects empty credential ids and secrets before calling security", () => {
    const writer = new StubGenericPasswordWriter([]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(() => store.create("", { kind: "api_key", apiKey: "secret" })).toThrow(
      CredentialStoreValidationError,
    );
    expect(() => store.create("openai-work", { kind: "api_key", apiKey: "" })).toThrow(
      CredentialStoreValidationError,
    );
    expect(
      () =>
        store.create("openai-chatgpt", {
          kind: "openai_session",
          idToken: "id",
          accessToken: "",
          refreshToken: "refresh",
        }),
    ).toThrow(CredentialStoreValidationError);
    expect(writer.calls).toHaveLength(0);
  });

  it("supports openai session credentials", () => {
    const credential: StoredCredential = {
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-123",
      lastRefresh: "2026-04-25T00:00:00.000Z",
    };
    const writer = new StubGenericPasswordWriter([
      { exitCode: 0, stdout: JSON.stringify(credential), stderr: "" },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(store.get("openai-chatgpt")).toEqual(credential);
  });

  it("supports cursor session credentials", () => {
    const credential: StoredCredential = {
      kind: "cursor_session",
      accessToken: "cursor-access-token",
      refreshToken: "cursor-refresh-token",
      authId: "auth0|user_123",
      authCacheKey: "auth:auth0|user_123",
      email: "cursor.user@example.com",
      displayName: "Cursor User",
      userId: 247015891,
    };
    const writer = new StubGenericPasswordWriter([
      { exitCode: 0, stdout: JSON.stringify(credential), stderr: "" },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(store.get("cursor-session")).toEqual(credential);
  });

  it("supports claude session credentials", () => {
    const credential: StoredCredential = {
      kind: "claude_session",
      accessToken: "claude-access-token",
      refreshToken: "claude-refresh-token",
      expiresAt: 1777427411000,
      accountUuid: "acct-claude-123",
      organizationUuid: "org-claude-456",
      email: "claude@example.com",
      displayName: "Claude User",
    };
    const writer = new StubGenericPasswordWriter([
      { exitCode: 0, stdout: JSON.stringify(credential), stderr: "" },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(store.get("claude-session")).toEqual(credential);
  });

  it("raises a command error for unexpected security failures", () => {
    const writer = new StubGenericPasswordWriter([
      { exitCode: 1, stdout: "", stderr: "unexpected failure" },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(() => store.remove("openai-work")).toThrow(CredentialStoreCommandError);
  });

  it("maps system secure storage denial clearly", () => {
    const writer = new StubGenericPasswordWriter([
      { exitCode: 128, stdout: "", stderr: "User interaction is not allowed." },
    ]);
    const store = new KeychainCredentialStore("nile.test", undefined, undefined, undefined, writer);

    expect(() => store.create("openai-work", { kind: "api_key", apiKey: "secret-value" })).toThrow(
      SystemSecureCredentialStoreDeniedError,
    );
  });
});

class StubGenericPasswordWriter extends GenericPasswordWriter {
  readonly calls: Array<
    | {
      type: "write";
      account: string;
      service: string;
      secret: string;
      update: boolean;
    }
    | {
      type: "read";
      account: string;
      service: string;
      includeSecret: boolean;
    }
    | {
      type: "remove";
      account: string;
      service: string;
    }
  > = [];

  constructor(private readonly results: SecurityCliResult[]) {
    super();
  }

  override write(input: {
    account: string;
    service: string;
    secret: string;
    update: boolean;
  }): SecurityCliResult {
    this.calls.push({ type: "write", ...input });
    return this.shiftResult([
      "write-generic-password",
      input.account,
      input.service,
      input.update ? "upsert" : "add",
    ]);
  }

  override read(input: {
    account: string;
    service: string;
    includeSecret: boolean;
  }): SecurityCliResult {
    this.calls.push({ type: "read", ...input });
    return this.shiftResult([
      "read-generic-password",
      input.account,
      input.service,
      input.includeSecret ? "secret" : "metadata",
    ]);
  }

  override remove(input: {
    account: string;
    service: string;
  }): SecurityCliResult {
    this.calls.push({ type: "remove", ...input });
    return this.shiftResult([
      "delete-generic-password",
      input.account,
      input.service,
    ]);
  }

  private shiftResult(args: string[]): SecurityCliResult {
    const result = this.results.shift();
    if (!result) {
      throw new Error(`Unexpected security invocation: ${args.join(" ")}`);
    }

    return result;
  }
}
