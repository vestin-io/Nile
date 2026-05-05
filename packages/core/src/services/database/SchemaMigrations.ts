import { SqliteDatabase } from "./SqliteDatabase";

type SchemaMigration = {
  version: number;
  statements: string[];
};

export class SchemaMigrations {
  constructor(private readonly database: SqliteDatabase) {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS nile_schema_migrations (
        scope TEXT NOT NULL,
        version INTEGER NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (scope, version)
      );
    `);
  }

  apply(scope: string, migrations: SchemaMigration[]): void {
    const ordered = [...migrations].sort((left, right) => left.version - right.version);
    let appliedVersions = new Set(this.listAppliedVersions(scope));

    for (const migration of ordered) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      this.database.transaction(() => {
        for (const statement of migration.statements) {
          this.database.exec(statement);
        }
        this.database.run(
          `
            INSERT INTO nile_schema_migrations (
              scope,
              version,
              applied_at
            ) VALUES (?, ?, ?)
          `,
          scope,
          migration.version,
          new Date().toISOString(),
        );
      });

      appliedVersions = new Set(this.listAppliedVersions(scope));
    }
  }

  private listAppliedVersions(scope: string): number[] {
    return this.database
      .query<{ version: number }>(
        `
          SELECT version
          FROM nile_schema_migrations
          WHERE scope = ?
          ORDER BY version ASC
        `,
      )
      .all(scope)
      .map((row) => row.version);
  }
}
