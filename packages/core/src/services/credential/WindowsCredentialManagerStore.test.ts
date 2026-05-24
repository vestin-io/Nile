import { describe, expect, it } from "vitest";

import {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  CredentialStoreValidationError,
  SystemSecureCredentialStoreDeniedError,
} from "./Store";
import { WindowsCredentialManagerStore } from "./WindowsCredentialManagerStore";
import type { StoredCredential } from "./Types";
import type { SecurityCliResult } from "./SecurityCli";

describe("WindowsCredentialManagerStore", () => {
  it("creates credentials with the expected writer command", () => {
    const writer = new StubWindowsCredentialWriter();
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    store.create("openai-work", { kind: "api_key", apiKey: "secret-value" });

    expect(writer.calls).toEqual([
      {
        type: "read",
        account: "openai-work",
        service: "nile.test",
        includeSecret: false,
      },
      {
        type: "read",
        account: "openai-work",
        service: "nile.test",
        includeSecret: true,
      },
      {
        type: "write",
        account: "openai-work",
        service: "nile.test",
        secret: JSON.stringify({ kind: "api_key", apiKey: "secret-value" }),
      },
    ]);
  });

  it("splits oversized credentials across multiple Windows Credential Manager entries", () => {
    const writer = new StubWindowsCredentialWriter();
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);
    const credential: StoredCredential = {
      kind: "api_key",
      apiKey: "x".repeat(2_000),
    };

    store.create("openai-work", credential);

    expect(writer.readStoredSecret("nile.test", "openai-work")).toContain("__nile_windows_chunks_v1__:");
    expect(writer.readStoredSecret("nile.test", "openai-work::chunk:0")).toBeDefined();
    expect(writer.readStoredSecret("nile.test", "openai-work::chunk:1")).toBeDefined();

    const reloaded = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);
    expect(reloaded.get("openai-work")).toEqual(credential);
  });

  it("removes stale chunk entries when an oversized credential is updated to a smaller payload", () => {
    const writer = new StubWindowsCredentialWriter();
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    store.create("openai-work", { kind: "api_key", apiKey: "x".repeat(2_000) });
    store.update("openai-work", { kind: "api_key", apiKey: "short-secret" });

    expect(writer.readStoredSecret("nile.test", "openai-work")).toBe(
      JSON.stringify({ kind: "api_key", apiKey: "short-secret" }),
    );
    expect(writer.readStoredSecret("nile.test", "openai-work::chunk:0")).toBeUndefined();
    expect(writer.readStoredSecret("nile.test", "openai-work::chunk:1")).toBeUndefined();
  });

  it("removes chunk entries together with the base credential", () => {
    const writer = new StubWindowsCredentialWriter();
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    store.create("openai-work", { kind: "api_key", apiKey: "x".repeat(2_000) });
    store.remove("openai-work");

    expect(writer.readStoredSecret("nile.test", "openai-work")).toBeUndefined();
    expect(writer.readStoredSecret("nile.test", "openai-work::chunk:0")).toBeUndefined();
    expect(writer.readStoredSecret("nile.test", "openai-work::chunk:1")).toBeUndefined();
  });

  it("reads and caches stored credentials", () => {
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };
    const writer = new StubWindowsCredentialWriter();
    writer.seedCredential("nile.test", "openai-work", JSON.stringify(credential));
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

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
    const writer = new StubWindowsCredentialWriter();
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    expect(store.has("missing")).toBe(false);
  });

  it("maps duplicate create failures clearly", () => {
    const writer = new StubWindowsCredentialWriter();
    writer.seedCredential("nile.test", "openai-work", JSON.stringify({ kind: "api_key", apiKey: "other" }));
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    expect(() => store.create("openai-work", { kind: "api_key", apiKey: "secret-value" })).toThrow(
      CredentialAlreadyExistsError,
    );
  });

  it("maps missing lookup failures clearly", () => {
    const writer = new StubWindowsCredentialWriter();
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    expect(() => store.get("missing")).toThrow(CredentialNotFoundError);
  });

  it("rejects empty credential ids and secrets before calling the writer", () => {
    const writer = new StubWindowsCredentialWriter();
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    expect(() => store.create("", { kind: "api_key", apiKey: "secret" })).toThrow(
      CredentialStoreValidationError,
    );
    expect(() => store.create("openai-work", { kind: "api_key", apiKey: "" })).toThrow(
      CredentialStoreValidationError,
    );
    expect(writer.calls).toHaveLength(0);
  });

  it("raises a command error for unexpected Windows Credential Manager failures", () => {
    const writer = new StubWindowsCredentialWriter();
    writer.seedCredential("nile.test", "openai-work", JSON.stringify({ kind: "api_key", apiKey: "secret-value" }));
    writer.queueRemoveResult({
      exitCode: 1,
      stdout: "",
      stderr: "Win32 1783: Credential payload exceeds the Windows Credential Manager size limit.",
    });
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    expect(() => store.remove("openai-work")).toThrow(CredentialStoreCommandError);
  });

  it("maps system secure storage denial clearly", () => {
    const writer = new StubWindowsCredentialWriter();
    writer.queueWriteResult({
      exitCode: 1,
      stdout: "",
      stderr: "Win32 5: Access is denied.",
    });
    const store = new WindowsCredentialManagerStore("nile.test", undefined, undefined, writer);

    expect(() => store.create("openai-work", { kind: "api_key", apiKey: "secret-value" })).toThrow(
      SystemSecureCredentialStoreDeniedError,
    );
  });
});

class StubWindowsCredentialWriter {
  readonly calls: Array<
    | {
      type: "write";
      account: string;
      service: string;
      secret: string;
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

  private readonly storedSecrets = new Map<string, string>();

  private readonly readResults: SecurityCliResult[] = [];

  private readonly writeResults: SecurityCliResult[] = [];

  private readonly removeResults: SecurityCliResult[] = [];

  write(input: { account: string; service: string; secret: string }): SecurityCliResult {
    this.calls.push({ type: "write", ...input });
    const scripted = this.writeResults.shift();
    if (scripted) {
      return scripted;
    }

    this.storedSecrets.set(readStoredSecretKey(input.service, input.account), input.secret);
    return { exitCode: 0, stdout: "", stderr: "" };
  }

  read(input: { account: string; service: string; includeSecret: boolean }): SecurityCliResult {
    this.calls.push({ type: "read", ...input });
    const scripted = this.readResults.shift();
    if (scripted) {
      return scripted;
    }

    const stored = this.storedSecrets.get(readStoredSecretKey(input.service, input.account));
    if (stored === undefined) {
      return { exitCode: 1, stdout: "", stderr: "Win32 1168: Element not found." };
    }

    return {
      exitCode: 0,
      stdout: input.includeSecret ? stored : input.account,
      stderr: "",
    };
  }

  remove(input: { account: string; service: string }): SecurityCliResult {
    this.calls.push({ type: "remove", ...input });
    const scripted = this.removeResults.shift();
    if (scripted) {
      return scripted;
    }

    const key = readStoredSecretKey(input.service, input.account);
    if (!this.storedSecrets.has(key)) {
      return { exitCode: 1, stdout: "", stderr: "Win32 1168: Element not found." };
    }

    this.storedSecrets.delete(key);
    return { exitCode: 0, stdout: "", stderr: "" };
  }

  seedCredential(service: string, account: string, secret: string): void {
    this.storedSecrets.set(readStoredSecretKey(service, account), secret);
  }

  readStoredSecret(service: string, account: string): string | undefined {
    return this.storedSecrets.get(readStoredSecretKey(service, account));
  }

  queueReadResult(result: SecurityCliResult): void {
    this.readResults.push(result);
  }

  queueWriteResult(result: SecurityCliResult): void {
    this.writeResults.push(result);
  }

  queueRemoveResult(result: SecurityCliResult): void {
    this.removeResults.push(result);
  }
}

function readStoredSecretKey(service: string, account: string): string {
  return `${service}/${account}`;
}
