import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import {
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

      const credentialRefs = new Set([
        ...this.readRefs(database, "SELECT credential_source_ref AS value FROM accesses"),
        ...agentCredentialQueries.flatMap((q) => this.readRefs(database, q)),
      ]);
      const secureSnapshotRefs = new Set(
        this.readRefs(
          database,
          "SELECT before_snapshot_ref AS value FROM mutation_history_files WHERE before_snapshot_kind = 'secure'",
        ),
      );

      for (const credentialRef of credentialRefs) {
        this.removeCredential(credentialRef);
      }
      for (const snapshotRef of secureSnapshotRefs) {
        this.secureSnapshotStore.removeSnapshot(snapshotRef);
      }

      return credentialRefs.size > 0 || secureSnapshotRefs.size > 0;
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

  private removeCredential(reference: string): void {
    try {
      this.credentialStore.remove(reference);
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
