import { SchemaMigrations, SqliteDatabase } from "../../services/database";
import type {
  EndpointProfile,
  EndpointProtocols,
  EndpointRecord,
} from "./Types";

type EndpointRow = {
  id: string;
  label: string;
  root_url: string;
  profile: string | null;
  protocols: string;
  created_at: string;
  updated_at: string;
};

export class SqliteEndpointStore {
  constructor(private readonly database: SqliteDatabase) {
    this.initialize();
  }

  insert(record: EndpointRecord): void {
    this.database.run(
      `
        INSERT INTO endpoints (
          id,
          label,
          root_url,
          profile,
          protocols,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      record.id,
      record.label,
      record.rootUrl,
      record.profile ?? null,
      JSON.stringify(record.protocols),
      record.createdAt,
      record.updatedAt,
    );
  }

  update(record: EndpointRecord): void {
    this.database.run(
      `
        UPDATE endpoints
        SET label = ?,
            root_url = ?,
            profile = ?,
            protocols = ?,
            updated_at = ?
        WHERE id = ?
      `,
      record.label,
      record.rootUrl,
      record.profile ?? null,
      JSON.stringify(record.protocols),
      record.updatedAt,
      record.id,
    );
  }

  get(endpointId: string): EndpointRecord | null {
    const row = this.database
      .query<EndpointRow, [string]>(
        `
          SELECT
            id,
            label,
            root_url,
            profile,
            protocols,
            created_at,
            updated_at
          FROM endpoints
          WHERE id = ?
        `,
      )
      .get(endpointId);

    return row ? this.mapRow(row) : null;
  }

  list(): EndpointRecord[] {
    const rows = this.database
      .query<EndpointRow, []>(
        `
          SELECT
            id,
            label,
            root_url,
            profile,
            protocols,
            created_at,
            updated_at
          FROM endpoints
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all();

    return rows.map((row) => this.mapRow(row));
  }

  remove(endpointId: string): void {
    this.database.run("DELETE FROM endpoints WHERE id = ?", endpointId);
  }

  private initialize(): void {
    new SchemaMigrations(this.database).apply("models.endpoints", [
      {
        version: 1,
        statements: [
          `
            CREATE TABLE IF NOT EXISTS endpoints (
              id TEXT PRIMARY KEY,
              label TEXT NOT NULL,
              root_url TEXT NOT NULL,
              profile TEXT,
              protocols TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
          `,
        ],
      },
    ]);
  }

  private mapRow(row: EndpointRow): EndpointRecord {
    return {
      id: row.id,
      label: row.label,
      rootUrl: row.root_url,
      ...(row.profile ? { profile: row.profile as EndpointProfile } : {}),
      protocols: this.parseProtocols(row.protocols),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseProtocols(value: string): EndpointProtocols {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Stored endpoint protocols are invalid");
    }
    return parsed as EndpointProtocols;
  }
}
