import { describe, expect, it } from "vitest";

import {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  CredentialStoreValidationError,
  KeychainCredentialStore,
} from "./KeychainCredentialStore";
import { type StoredCredential } from "./Types";
import { type SecurityCliResult, SecurityCli } from "./SecurityCli";

describe("KeychainCredentialStore", () => {
  it("creates credentials with the expected security command", () => {
    const cli = new StubSecurityCli([{ exitCode: 0, stdout: "", stderr: "" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };

    store.create("openai-work", credential);

    expect(cli.calls).toEqual([
      ["add-generic-password", "-a", "openai-work", "-s", "nile.test", "-w"],
    ]);
    expect(cli.secretPrompts).toEqual([
      "__nile_keychain_v1__:eyJraW5kIjoiYXBpX2tleSIsImFwaUtleSI6InNlY3JldC12YWx1ZSJ9",
    ]);
  });

  it("updates existing credentials with -U", () => {
    const cli = new StubSecurityCli([
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
    ]);
    const store = new KeychainCredentialStore(cli, "nile.test");
    const credential: StoredCredential = { kind: "api_key", apiKey: "new-secret" };

    store.update("openai-work", credential);

    expect(cli.calls).toEqual([
      ["find-generic-password", "-a", "openai-work", "-s", "nile.test"],
      ["add-generic-password", "-a", "openai-work", "-s", "nile.test", "-U", "-w"],
    ]);
    expect(cli.secretPrompts).toEqual([
      "__nile_keychain_v1__:eyJraW5kIjoiYXBpX2tleSIsImFwaUtleSI6Im5ldy1zZWNyZXQifQ==",
    ]);
  });

  it("returns the stored secret on lookup", () => {
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };
    const cli = new StubSecurityCli([{ exitCode: 0, stdout: JSON.stringify(credential), stderr: "" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(store.get("openai-work")).toEqual(credential);
    expect(store.get("openai-work")).toEqual(credential);
    expect(cli.calls).toEqual([["find-generic-password", "-a", "openai-work", "-s", "nile.test", "-w"]]);
  });

  it("returns false when has checks a missing credential", () => {
    const cli = new StubSecurityCli([
      { exitCode: 44, stdout: "", stderr: "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain." },
    ]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(store.has("missing")).toBe(false);
  });

  it("uses the in-memory cache after create", () => {
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };
    const cli = new StubSecurityCli([{ exitCode: 0, stdout: "", stderr: "" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    store.create("openai-work", credential);

    expect(store.has("openai-work")).toBe(true);
    expect(store.get("openai-work")).toEqual(credential);
    expect(cli.calls).toEqual([
      ["add-generic-password", "-a", "openai-work", "-s", "nile.test", "-w"],
    ]);
  });

  it("reads legacy unencoded credential payloads", () => {
    const credential: StoredCredential = { kind: "api_key", apiKey: "legacy-secret" };
    const cli = new StubSecurityCli([{ exitCode: 0, stdout: JSON.stringify(credential), stderr: "" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(store.get("openai-work")).toEqual(credential);
  });

  it("maps duplicate create failures clearly", () => {
    const cli = new StubSecurityCli([
      { exitCode: 45, stdout: "", stderr: "The specified item already exists in the keychain." },
    ]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(() => store.create("openai-work", { kind: "api_key", apiKey: "secret-value" })).toThrow(
      CredentialAlreadyExistsError,
    );
  });

  it("maps missing lookup failures clearly", () => {
    const cli = new StubSecurityCli([
      { exitCode: 44, stdout: "", stderr: "The specified item could not be found in the keychain." },
    ]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(() => store.get("missing")).toThrow(CredentialNotFoundError);
  });

  it("rejects empty credential ids and secrets before calling security", () => {
    const cli = new StubSecurityCli([]);
    const store = new KeychainCredentialStore(cli, "nile.test");

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
    expect(cli.calls).toHaveLength(0);
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
    const cli = new StubSecurityCli([{ exitCode: 0, stdout: JSON.stringify(credential), stderr: "" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(store.get("openai-chatgpt")).toEqual(credential);
  });

  it("supports cursor session credentials", () => {
    const credential: StoredCredential = {
      kind: "cursor_session",
      accessToken: "cursor-access-token",
      refreshToken: "cursor-refresh-token",
      authId: "auth0|user_123",
      authCacheKey: "auth:auth0|user_123",
      email: "jay@example.com",
      displayName: "Jay Ji",
      userId: 247015891,
    };
    const cli = new StubSecurityCli([{ exitCode: 0, stdout: JSON.stringify(credential), stderr: "" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");

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
    const cli = new StubSecurityCli([{ exitCode: 0, stdout: JSON.stringify(credential), stderr: "" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(store.get("claude-session")).toEqual(credential);
  });

  it("raises a command error for unexpected security failures", () => {
    const cli = new StubSecurityCli([{ exitCode: 1, stdout: "", stderr: "unexpected failure" }]);
    const store = new KeychainCredentialStore(cli, "nile.test");

    expect(() => store.remove("openai-work")).toThrow(CredentialStoreCommandError);
  });
});

class StubSecurityCli extends SecurityCli {
  readonly calls: string[][] = [];
  readonly secretPrompts: string[] = [];

  constructor(private readonly results: SecurityCliResult[]) {
    super();
  }

  override run(args: string[]): SecurityCliResult {
    this.calls.push(args);
    return this.shiftResult(args);
  }

  override runWithSecretPrompt(args: string[], secret: string): SecurityCliResult {
    this.calls.push(args);
    this.secretPrompts.push(secret);
    return this.shiftResult(args);
  }

  private shiftResult(args: string[]): SecurityCliResult {
    const result = this.results.shift();
    if (!result) {
      throw new Error(`Unexpected security invocation: ${args.join(" ")}`);
    }

    return result;
  }
}
