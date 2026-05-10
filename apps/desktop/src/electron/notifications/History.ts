import { randomUUID } from "node:crypto";

import { SqliteDatabase } from "@nile/core/services/database";

import type { DesktopNotificationHistoryConnection, DesktopNotificationHistoryEntry } from "../../state/Types";
import type { DesktopNotificationIntent } from "./Types";

type NotificationHistoryRow = {
  event_id: string;
  shown_at: string;
  read_at: string | null;
  clicked_at: string | null;
  reset_at: string | null;
  title: string;
  body: string;
  kind: DesktopNotificationHistoryEntry["kind"];
  scope: DesktopNotificationHistoryEntry["scope"];
  subject_id: string | null;
  subject_label: string | null;
  target_page: DesktopNotificationHistoryEntry["targetPage"];
  target_connection_id: string | null;
  target_agent_id: string | null;
  target_profile_id: string | null;
};

type NotificationHistoryConnectionRow = {
  connection_id: string;
  label: string;
};

export type DesktopNotificationHistoryKindFilter = "all" | "alerts";

export type DesktopNotificationHistoryFilter = {
  connectionId?: string | null;
  kind?: DesktopNotificationHistoryKindFilter;
  limit?: number;
};

type NotificationHistoryQuery = {
  params: Array<string | number>;
  whereClause: string;
};

type DesktopNotificationHistoryOptions = {
  now?: () => Date;
};

export class DesktopNotificationHistory {
  private readonly now: () => Date;

  constructor(
    private readonly databasePath: string,
    options: DesktopNotificationHistoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  recordShown(intent: DesktopNotificationIntent): string {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const eventId = randomUUID();
      const shownAt = this.now().toISOString();
      database.run(
        `
          INSERT INTO desktop_notification_history (
            event_id,
            shown_at,
            read_at,
            clicked_at,
            reset_at,
            title,
            body,
            kind,
            scope,
            subject_id,
            subject_label,
            target_page,
            target_connection_id,
            target_agent_id,
            target_profile_id
          ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        eventId,
        shownAt,
        intent.resetAt ?? null,
        intent.title,
        intent.body,
        intent.kind,
        intent.scope,
        intent.subject?.id ?? null,
        intent.subject?.label ?? null,
        intent.target?.page ?? null,
        intent.target?.page === "connections" || intent.target?.page === "notifications"
          ? (intent.target.connectionId ?? null)
          : null,
        intent.target?.page === "connections" || intent.target?.page === "agents" ? (intent.target.agentId ?? null) : null,
        intent.target?.page === "profiles" ? (intent.target.profileId ?? null) : null,
      );
      return eventId;
    } finally {
      database.close();
    }
  }

  recordClicked(eventId: string): void {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      database.run(
        `
          UPDATE desktop_notification_history
          SET
            clicked_at = COALESCE(clicked_at, ?),
            read_at = COALESCE(read_at, ?)
          WHERE event_id = ?
        `,
        this.now().toISOString(),
        this.now().toISOString(),
        eventId,
      );
    } finally {
      database.close();
    }
  }

  markRead(eventIds: string[]): void {
    const filteredEventIds = eventIds.filter((value) => value.trim().length > 0);
    if (filteredEventIds.length === 0) {
      return;
    }

    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const placeholders = filteredEventIds.map(() => "?").join(", ");
      database.run(
        `
          UPDATE desktop_notification_history
          SET read_at = COALESCE(read_at, ?)
          WHERE event_id IN (${placeholders})
        `,
        this.now().toISOString(),
        ...filteredEventIds,
      );
    } finally {
      database.close();
    }
  }

  markReadByFilter(filter: DesktopNotificationHistoryFilter = {}): void {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const query = this.buildQuery(filter, false);
      database.run(
        `
          UPDATE desktop_notification_history
          SET read_at = COALESCE(read_at, ?)
          ${query.whereClause}
        `,
        this.now().toISOString(),
        ...query.params,
      );
    } finally {
      database.close();
    }
  }

  hasUnread(): boolean {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const row = database.query<{ unread: number }>(
        `
          SELECT 1 AS unread
          FROM desktop_notification_history
          WHERE read_at IS NULL
          LIMIT 1
        `,
      ).get();
      return row?.unread === 1;
    } finally {
      database.close();
    }
  }

  listConnections(filter: DesktopNotificationHistoryFilter = {}): DesktopNotificationHistoryConnection[] {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const query = this.buildQuery({
        ...filter,
        limit: undefined,
      }, false);
      const rows = database.query<NotificationHistoryConnectionRow>(
        `
          SELECT
            target_connection_id AS connection_id,
            MAX(COALESCE(subject_label, target_connection_id)) AS label
          FROM desktop_notification_history
          ${query.whereClause ? `${query.whereClause} AND target_connection_id IS NOT NULL` : "WHERE target_connection_id IS NOT NULL"}
          GROUP BY target_connection_id
          ORDER BY LOWER(label) ASC, connection_id ASC
        `,
      ).all(...query.params);
      return rows
        .filter((row) => row.connection_id.trim().length > 0)
        .map((row) => ({
          connectionId: row.connection_id,
          label: row.label,
        }));
    } finally {
      database.close();
    }
  }

  list(filter: DesktopNotificationHistoryFilter = {}): DesktopNotificationHistoryEntry[] {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const query = this.buildQuery(filter);
      const rows = database.query<NotificationHistoryRow>(
        `
          SELECT
            event_id,
            shown_at,
            read_at,
            clicked_at,
            reset_at,
            title,
            body,
            kind,
            scope,
            subject_id,
            subject_label,
            target_page,
            target_connection_id,
            target_agent_id,
            target_profile_id
          FROM desktop_notification_history
          ${query.whereClause}
          ORDER BY shown_at DESC, event_id DESC
          LIMIT ?
        `,
      ).all(...query.params);
      return rows.map((row: NotificationHistoryRow) => ({
        id: row.event_id,
        shownAt: row.shown_at,
        readAt: row.read_at,
        clickedAt: row.clicked_at,
        resetAt: row.reset_at,
        title: row.title,
        body: row.body,
        kind: row.kind,
        scope: row.scope,
        subjectId: row.subject_id,
        subjectLabel: row.subject_label,
        targetPage: row.target_page,
        targetConnectionId: row.target_connection_id,
        targetAgentId: row.target_agent_id as DesktopNotificationHistoryEntry["targetAgentId"],
        targetProfileId: row.target_profile_id,
      }));
    } finally {
      database.close();
    }
  }

  private buildQuery(filter: DesktopNotificationHistoryFilter, includeLimit = true): NotificationHistoryQuery {
    const where: string[] = [];
    const params: Array<string | number> = [];
    if ((filter.kind ?? "all") === "alerts") {
      where.push("(kind = ? OR kind = ?)");
      params.push("usage-threshold", "usage-renewed");
    }
    if (filter.connectionId?.trim()) {
      where.push("target_connection_id = ?");
      params.push(filter.connectionId.trim());
    }
    if (includeLimit) {
      params.push(filter.limit ?? 200);
    }
    return {
      params,
      whereClause: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    };
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_notification_history (
        event_id TEXT PRIMARY KEY,
        shown_at TEXT NOT NULL,
        read_at TEXT,
        clicked_at TEXT,
        reset_at TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        kind TEXT NOT NULL,
        scope TEXT NOT NULL,
        subject_id TEXT,
        subject_label TEXT,
        target_page TEXT,
        target_connection_id TEXT,
        target_agent_id TEXT,
        target_profile_id TEXT
      );

      CREATE INDEX IF NOT EXISTS desktop_notification_history_shown_at_idx
      ON desktop_notification_history (shown_at DESC);

      CREATE INDEX IF NOT EXISTS desktop_notification_history_target_connection_idx
      ON desktop_notification_history (target_connection_id);
    `);
    const columns = database.query<{ name: string }>("PRAGMA table_info(desktop_notification_history)").all();
    if (!columns.some((column) => column.name === "read_at")) {
      database.exec("ALTER TABLE desktop_notification_history ADD COLUMN read_at TEXT");
    }
    if (!columns.some((column) => column.name === "reset_at")) {
      database.exec("ALTER TABLE desktop_notification_history ADD COLUMN reset_at TEXT");
    }
  }
}
