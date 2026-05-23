import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  buildCredentialStoreTarget,
  type CredentialStore,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  KeychainCredentialStore,
} from "../../services/credential";
import { SqliteDatabase } from "../../services/database";
import { SecureSnapshotStore } from "../../services/history";
import { AGENT_MODULE_REGISTRY } from "../../models/agent/module/Registry";

export type ResetStateResult = {
  databasePath: string;
  historyPath: string;
  databaseRemoved: boolean;
  historyRemoved: boolean;
  credentialsRemoved: boolean;
};

type ResetRefRow = {
  value: string;
};

type ResetAccessCredentialRow = {
  reference: string;
  backend: string | null;
};

export class StateReset {
  constructor(
    private readonly credentialStore: CredentialStore = new KeychainCredentialStore(),
    private readonly secureSnapshotStore: SecureSnapshotStore = new SecureSnapshotStore(),
  ) {}

  reset(databasePath: string): ResetStateResult {
    const historyPath = join(dirname(databasePath), "history");

    return {
      databasePath,
      historyPath,
      credentialsRemoved: this.removeWorkspaceCredentials(databasePath),
      databaseRemoved: this.removePath(databasePath),
      historyRemoved: this.removePath(historyPath),
    };
  }

  private removePath(path: string): boolean {
    if (!existsSync(path)) {
      return false;
    }

    rmSync(path, { recursive: true, force: true });
    return true;
  }

  private removeWorkspaceCredentials(databasePath: string): boolean {
    if (!existsSync(databasePath)) {
      return false;
    }

    let database: SqliteDatabase;
    try {
      database = SqliteDatabase.open(databasePath);
    } catch {
      return false;
    }

    try {
      const agentCredentialQueries = AGENT_MODULE_REGISTRY.list()
        .flatMap((module) =>
          module.localConnectionSupportFactory?.credentialRefQuery
            ? [module.localConnectionSupportFactory.credentialRefQuery]
            : []);

      const credentialRefs = [
        ...this.readAccessCredentialRefs(database),
        ...agentCredentialQueries.flatMap((q) => this.readRefs(database, q)).map((reference) => ({
          reference,
          backend: undefined,
        })),
      ];
      const secureSnapshotRefs = new Set(
        this.readRefs(
          database,
          "SELECT before_snapshot_ref AS value FROM mutation_history_files WHERE before_snapshot_kind = 'secure'",
        ),
      );

      for (const credentialRef of credentialRefs) {
        this.removeCredential(credentialRef.reference, credentialRef.backend);
      }
      for (const snapshotRef of secureSnapshotRefs) {
        this.secureSnapshotStore.removeSnapshot(snapshotRef);
      }

      return credentialRefs.length > 0 || secureSnapshotRefs.size > 0;
    } finally {
      database.close();
    }
  }

  private readRefs(database: SqliteDatabase, sql: string): string[] {
    try {
      return database
        .query<ResetRefRow>(sql)
        .all()
        .flatMap((row) => {
          const value = row.value.trim();
          return value ? [value] : [];
        });
    } catch {
      return [];
    }
  }

  private readAccessCredentialRefs(
    database: SqliteDatabase,
  ): Array<{ reference: string; backend: "system_secure_storage" | "encrypted_local_storage" | undefined }> {
    try {
      return database
        .query<ResetAccessCredentialRow>(
          `
            SELECT
              credential_source_ref AS reference,
              credential_storage_backend AS backend
            FROM accesses
          `,
        )
        .all()
        .flatMap((row) => {
          const reference = row.reference.trim();
          if (!reference) {
            return [];
          }
          return [{
            reference,
            backend: row.backend === "system_secure_storage" || row.backend === "encrypted_local_storage"
              ? row.backend
              : undefined,
          }];
        });
    } catch {
      return [];
    }
  }

  private removeCredential(
    reference: string,
    backend: "system_secure_storage" | "encrypted_local_storage" | undefined,
  ): void {
    try {
      this.credentialStore.remove(buildCredentialStoreTarget(reference, backend));
    } catch (error) {
      if (
        error instanceof CredentialNotFoundError
        || error instanceof CredentialStoreCommandError
      ) {
        return;
      }
      throw error;
    }
  }
}
