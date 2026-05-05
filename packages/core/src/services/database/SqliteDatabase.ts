import { DatabaseSync, type StatementSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqliteBinding = string | number | bigint | Uint8Array | null;
type NonPromiseResult<T> = T extends PromiseLike<unknown> ? never : T;

class SqliteQuery<Row> {
  private statement: StatementSync | null = null;

  constructor(
    private readonly statementReader: (sql: string) => StatementSync,
    private readonly sql: string,
  ) {}

  private readStatement(): StatementSync {
    if (!this.statement) {
      this.statement = this.statementReader(this.sql);
    }
    return this.statement;
  }

  get(...bindings: SqliteBinding[]): Row | null {
    return this.readStatement().get(...bindings) as Row | null;
  }

  all(...bindings: SqliteBinding[]): Row[] {
    return this.readStatement().all(...bindings) as Row[];
  }
}

export class SqliteDatabase {
  private transactionDepth = 0;
  private readonly statements = new Map<string, StatementSync>();

  private constructor(private readonly connection: DatabaseSync) {}

  static open(databasePath: string): SqliteDatabase {
    mkdirSync(dirname(databasePath), { recursive: true });
    return new SqliteDatabase(new DatabaseSync(databasePath));
  }

  query<Row = unknown, _Params = unknown>(sql: string): SqliteQuery<Row> {
    return new SqliteQuery<Row>((candidate) => this.prepare(candidate), sql);
  }

  run(sql: string, ...bindings: SqliteBinding[]): void {
    this.prepare(sql).run(...bindings);
  }

  exec(sql: string): void {
    this.connection.exec(sql);
  }

  transaction<TResult>(work: () => TResult): NonPromiseResult<TResult> {
    this.transactionDepth += 1;
    const depth = this.transactionDepth;
    const savepoint = `nile_tx_${depth}`;

    if (depth === 1) {
      this.exec("BEGIN IMMEDIATE");
    } else {
      this.exec(`SAVEPOINT ${savepoint}`);
    }

    try {
      const result = work();
      if (this.isPromiseLike(result)) {
        throw new Error("SqliteDatabase.transaction() does not support async callbacks");
      }
      if (depth === 1) {
        this.exec("COMMIT");
      } else {
        this.exec(`RELEASE SAVEPOINT ${savepoint}`);
      }
      return result as NonPromiseResult<TResult>;
    } catch (error) {
      if (depth === 1) {
        this.exec("ROLLBACK");
      } else {
        this.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.exec(`RELEASE SAVEPOINT ${savepoint}`);
      }
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  close(): void {
    this.statements.clear();
    this.connection.close();
  }

  private prepare(sql: string): StatementSync {
    const cached = this.statements.get(sql);
    if (cached) {
      return cached;
    }

    const statement = this.connection.prepare(sql);
    this.statements.set(sql, statement);
    return statement;
  }

  private isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return typeof value === "object"
      && value !== null
      && "then" in value
      && typeof (value as { then?: unknown }).then === "function";
  }
}
