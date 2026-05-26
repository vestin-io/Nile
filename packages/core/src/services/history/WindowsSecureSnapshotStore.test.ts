import { describe, expect, it } from "vitest";

import { createPlatformSecureSnapshotStore } from "./PlatformSecureSnapshotStore";
import { SecureSnapshotStore, SecureSnapshotStoreError } from "./SecureSnapshotStore";
import { WindowsSecureSnapshotStore } from "./WindowsSecureSnapshotStore";
import { WindowsSecretAccessDeniedError, WindowsSecretNotFoundError } from "../credential/WindowsSecretStore";

describe("WindowsSecureSnapshotStore", () => {
  it("stores and reads snapshots through the Windows secret store", () => {
    const secrets = new StubWindowsSecrets();
    const store = new WindowsSecureSnapshotStore("nile.test.snapshot", undefined, secrets);

    const written = store.writeBeforeSnapshot("snapshot-1", "secret-value");

    expect(written).toEqual({
      snapshotRef: "snapshot-1",
      checksum: store.checksum("secret-value"),
    });
    expect(store.readSnapshot("snapshot-1")).toBe("secret-value");
  });

  it("ignores missing snapshots during cleanup", () => {
    const store = new WindowsSecureSnapshotStore("nile.test.snapshot", undefined, new StubWindowsSecrets());

    expect(() => store.removeSnapshot("missing")).not.toThrow();
  });

  it("wraps Windows secret store failures as snapshot errors", () => {
    const store = new WindowsSecureSnapshotStore(
      "nile.test.snapshot",
      undefined,
      new StubWindowsSecrets({ readError: new WindowsSecretAccessDeniedError("snapshot-1") }),
    );

    expect(() => store.readSnapshot("snapshot-1")).toThrow(SecureSnapshotStoreError);
  });
});

describe("createPlatformSecureSnapshotStore", () => {
  it("returns the Windows implementation for win32", () => {
    expect(createPlatformSecureSnapshotStore("win32")).toBeInstanceOf(WindowsSecureSnapshotStore);
  });

  it("returns the default implementation for non-Windows platforms", () => {
    expect(createPlatformSecureSnapshotStore("darwin")).toBeInstanceOf(SecureSnapshotStore);
  });
});

class StubWindowsSecrets {
  private readonly values = new Map<string, string>();

  constructor(
    private readonly options: {
      writeError?: Error;
      readError?: Error;
      removeError?: Error;
    } = {},
  ) {}

  write(account: string, secret: string): void {
    if (this.options.writeError) {
      throw this.options.writeError;
    }
    this.values.set(account, secret);
  }

  read(account: string): string {
    if (this.options.readError) {
      throw this.options.readError;
    }

    const value = this.values.get(account);
    if (value === undefined) {
      throw new WindowsSecretNotFoundError(account);
    }
    return value;
  }

  remove(account: string): void {
    if (this.options.removeError) {
      throw this.options.removeError;
    }
    if (!this.values.has(account)) {
      throw new WindowsSecretNotFoundError(account);
    }
    this.values.delete(account);
  }
}
