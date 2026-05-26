import { NileLogger } from "../NileLogger";
import {
  WindowsSecretAccessDeniedError,
  WindowsSecretNotFoundError,
  WindowsSecretStore,
  WindowsSecretStoreError,
} from "../credential/WindowsSecretStore";
import { SecureSnapshotStore, SecureSnapshotStoreError, type StoredSecureSnapshot } from "./SecureSnapshotStore";

export class WindowsSecureSnapshotStore extends SecureSnapshotStore {
  constructor(
    private readonly snapshotServiceName: string = "nile.switcher.history.snapshot",
    private readonly logger: NileLogger = NileLogger.silent().child({ module: "windows-secure-snapshot-store" }),
    private readonly secrets: Pick<WindowsSecretStore, "write" | "read" | "remove"> = new WindowsSecretStore(
      snapshotServiceName,
      logger.child({ scope: "windows-secret-store" }),
    ),
  ) {
    super();
  }

  override writeBeforeSnapshot(snapshotRef: string, content: string | null): StoredSecureSnapshot {
    try {
      this.secrets.write(snapshotRef, content ?? "");
      return {
        snapshotRef,
        checksum: this.checksum(content),
      };
    } catch (error) {
      this.throwStoreError("store", snapshotRef, error);
    }
  }

  override readSnapshot(snapshotRef: string): string {
    try {
      return this.secrets.read(snapshotRef);
    } catch (error) {
      this.throwStoreError("read", snapshotRef, error);
    }
  }

  override removeSnapshot(snapshotRef: string): void {
    try {
      this.secrets.remove(snapshotRef);
    } catch (error) {
      if (error instanceof WindowsSecretNotFoundError) {
        return;
      }
      this.throwStoreError("remove", snapshotRef, error);
    }
  }

  private throwStoreError(action: string, snapshotRef: string, error: unknown): never {
    if (error instanceof WindowsSecretAccessDeniedError) {
      throw new SecureSnapshotStoreError(
        `Failed to ${action} a secure history snapshot for ${snapshotRef}: access was denied`,
      );
    }
    if (error instanceof WindowsSecretStoreError) {
      throw new SecureSnapshotStoreError(
        `Failed to ${action} a secure history snapshot for ${snapshotRef}: ${error.message}`,
      );
    }

      this.logger.error("history.secure_snapshot.failed", error, {
        action,
        snapshotRef,
        serviceName: this.snapshotServiceName,
      });
    throw error instanceof Error ? error : new Error(String(error));
  }
}
