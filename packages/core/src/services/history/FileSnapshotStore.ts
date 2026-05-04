import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export type StoredSnapshot = {
  snapshotRef: string;
  checksum: string | null;
};

export class FileSnapshotStore {
  constructor(private readonly historyRoot: string) {}

  writeBeforeSnapshot(
    mutationId: string,
    targetPath: string,
    content: string | null,
  ): StoredSnapshot {
    const snapshotPath = join(
      this.historyRoot,
      mutationId,
      "before",
      `${this.buildFileStem(targetPath)}-${randomUUID()}.snapshot`,
    );

    mkdirSync(join(this.historyRoot, mutationId, "before"), { recursive: true, mode: 0o700 });
    writeFileSync(snapshotPath, content ?? "", { encoding: "utf8", mode: 0o600 });

    return {
      snapshotRef: snapshotPath,
      checksum: this.checksum(content),
    };
  }

  readCurrentChecksum(targetPath: string): string | null {
    if (!existsSync(targetPath)) {
      return null;
    }

    return this.checksum(readFileSync(targetPath, "utf8"));
  }

  restoreSnapshot(snapshotRef: string, targetPath: string, existedBefore: boolean): void {
    if (!existedBefore) {
      rmSync(targetPath, { force: true });
      return;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(snapshotRef, targetPath);
  }

  removeSnapshot(snapshotRef: string): void {
    rmSync(snapshotRef, { force: true });
  }

  checksum(content: string | null): string | null {
    if (content === null) {
      return null;
    }

    return createHash("sha256").update(content, "utf8").digest("hex");
  }

  private buildFileStem(targetPath: string): string {
    return basename(targetPath).replace(/[^A-Za-z0-9._-]/g, "-");
  }
}
