import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { SecurityCli } from "../credential/SecurityCli";
import { SecuritySecretCodec } from "../credential/SecretCodec";

export class SecureSnapshotStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecureSnapshotStoreError";
  }
}

export type StoredSecureSnapshot = {
  snapshotRef: string;
  checksum: string | null;
};

export class SecureSnapshotStore {
  constructor(
    private readonly securityCli: SecurityCli = new SecurityCli(),
    private readonly serviceName: string = "nile.switcher.history.snapshot",
    private readonly secretCodec: SecuritySecretCodec = new SecuritySecretCodec(),
  ) {}

  writeBeforeSnapshot(snapshotRef: string, content: string | null): StoredSecureSnapshot {
    const result = this.securityCli.runWithSecretData([
      "add-generic-password",
      "-a",
      snapshotRef,
      "-s",
      this.serviceName,
      "-w",
    ], this.secretCodec.encode(content ?? ""));

    if (result.exitCode !== 0) {
      throw new SecureSnapshotStoreError(
        `Failed to store a secure history snapshot for ${snapshotRef}: ${result.stderr.trim() || "unknown error"}`,
      );
    }

    return {
      snapshotRef,
      checksum: this.checksum(content),
    };
  }

  readSnapshot(snapshotRef: string): string {
    const result = this.securityCli.run([
      "find-generic-password",
      "-a",
      snapshotRef,
      "-s",
      this.serviceName,
      "-w",
    ]);

    if (result.exitCode !== 0) {
      throw new SecureSnapshotStoreError(
        `Failed to read a secure history snapshot for ${snapshotRef}: ${result.stderr.trim() || "unknown error"}`,
      );
    }

    return this.secretCodec.decode(result.stdout);
  }

  removeSnapshot(snapshotRef: string): void {
    const result = this.securityCli.run([
      "delete-generic-password",
      "-a",
      snapshotRef,
      "-s",
      this.serviceName,
    ]);

    if (result.exitCode === 0 || this.isMissingError(result.stderr)) {
      return;
    }

    throw new SecureSnapshotStoreError(
      `Failed to remove a secure history snapshot for ${snapshotRef}: ${result.stderr.trim() || "unknown error"}`,
    );
  }

  restoreSnapshot(snapshotRef: string, targetPath: string, existedBefore: boolean): void {
    if (!existedBefore) {
      rmSync(targetPath, { force: true });
      return;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, this.readSnapshot(snapshotRef), { encoding: "utf8", mode: 0o600 });
  }

  checksum(content: string | null): string | null {
    if (content === null) {
      return null;
    }

    return createHash("sha256").update(content).digest("hex");
  }

  private isMissingError(stderr: string): boolean {
    return /could not be found|item not found|errsecitemnotfound/i.test(stderr);
  }
}
