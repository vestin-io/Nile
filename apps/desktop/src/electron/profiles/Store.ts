import { randomUUID } from "node:crypto";

import { isAgentId, type AgentId } from "@nile/core/models/agent";
import { SqliteDatabase } from "@nile/core/services/database";

export type WorkspaceProfileAssignment = {
  agentId: AgentId;
  connectionId?: string;
  homePath?: string | null;
};

export type WorkspaceProfile = {
  id: string;
  name: string;
  emoji?: string;
  assignments: WorkspaceProfileAssignment[];
};

type WorkspaceProfileRow = {
  id: string;
  name: string;
  emoji: string | null;
};

type WorkspaceProfileAssignmentRow = {
  profile_id: string;
  agent_id: string;
  connection_id: string | null;
  home_path_kind: string;
  home_path: string | null;
};

type CreateWorkspaceProfileInput = {
  name: string;
  emoji?: string;
  assignments: WorkspaceProfileAssignment[];
};

type UpdateWorkspaceProfileInput = {
  assignments: WorkspaceProfileAssignment[];
  emoji?: string;
  name: string;
};

export class WorkspaceProfileStore {
  constructor(private readonly databasePath: string) {}

  list(): WorkspaceProfile[] {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      return this.readProfiles(database);
    } finally {
      database.close();
    }
  }

  create(input: CreateWorkspaceProfileInput): WorkspaceProfile {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      return database.transaction(() => {
        this.initialize(database);
        const normalizedName = this.normalizeName(input.name);
        const profiles = this.readProfiles(database);
        this.assertNameAvailable(profiles, normalizedName);
        const normalizedEmoji = this.normalizeEmoji(input.emoji);
        const profile: WorkspaceProfile = {
          id: randomUUID(),
          name: normalizedName,
          ...(normalizedEmoji ? { emoji: normalizedEmoji } : {}),
          assignments: this.normalizeAssignments(input.assignments),
        };
        this.insertProfile(database, profile);
        return profile;
      });
    } finally {
      database.close();
    }
  }

  update(profileId: string, input: UpdateWorkspaceProfileInput): WorkspaceProfile {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      return database.transaction(() => {
        this.initialize(database);
        const profiles = this.readProfiles(database);
        const current = profiles.find((profile) => profile.id === profileId);
        if (!current) {
          throw new Error(`Workspace profile not found: ${profileId}`);
        }

        const normalizedName = this.normalizeName(input.name);
        this.assertNameAvailable(profiles, normalizedName, current.id);
        const normalizedEmoji = this.normalizeEmoji(input.emoji);
        const updated: WorkspaceProfile = {
          ...current,
          assignments: this.normalizeAssignments(input.assignments),
          name: normalizedName,
          ...(normalizedEmoji ? { emoji: normalizedEmoji } : {}),
        };
        if (!normalizedEmoji) {
          delete updated.emoji;
        }

        database.run(
          `
            UPDATE desktop_workspace_profiles
            SET name = ?, emoji = ?
            WHERE id = ?
          `,
          updated.name,
          updated.emoji ?? null,
          updated.id,
        );
        database.run("DELETE FROM desktop_workspace_profile_assignments WHERE profile_id = ?", updated.id);
        this.insertAssignments(database, updated);
        return updated;
      });
    } finally {
      database.close();
    }
  }

  delete(profileId: string): void {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        const deleted = database
          .query<{ id: string }>("SELECT id FROM desktop_workspace_profiles WHERE id = ?")
          .get(profileId);
        if (!deleted) {
          throw new Error(`Workspace profile not found: ${profileId}`);
        }
        database.run("DELETE FROM desktop_workspace_profile_assignments WHERE profile_id = ?", profileId);
        database.run("DELETE FROM desktop_workspace_profiles WHERE id = ?", profileId);
      });
    } finally {
      database.close();
    }
  }

  read(profileId: string): WorkspaceProfile {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const profile = this.readProfiles(database).find((entry) => entry.id === profileId);
      if (!profile) {
        throw new Error(`Workspace profile not found: ${profileId}`);
      }
      return profile;
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_workspace_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT
      );

      CREATE TABLE IF NOT EXISTS desktop_workspace_profile_assignments (
        profile_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        connection_id TEXT,
        home_path_kind TEXT NOT NULL,
        home_path TEXT
      );

      CREATE INDEX IF NOT EXISTS desktop_workspace_profile_assignments_profile_idx
      ON desktop_workspace_profile_assignments (profile_id);
    `);
    this.upgradeAssignmentsTable(database);
  }

  private upgradeAssignmentsTable(database: SqliteDatabase): void {
    const columns = database
      .query<{ name: string }>("PRAGMA table_info(desktop_workspace_profile_assignments)")
      .all();
    if (columns.some((column) => column.name === "home_path_kind")) {
      return;
    }

    database.exec("ALTER TABLE desktop_workspace_profile_assignments ADD COLUMN home_path_kind TEXT");
    database.run(
      `
        UPDATE desktop_workspace_profile_assignments
        SET home_path_kind = CASE
          WHEN home_path IS NOT NULL THEN 'value'
          WHEN connection_id IS NOT NULL THEN 'unset'
          ELSE 'null'
        END
        WHERE home_path_kind IS NULL
      `,
    );
  }

  private readProfiles(database: SqliteDatabase): WorkspaceProfile[] {
    const profiles = database
      .query<WorkspaceProfileRow>(
        `
          SELECT id, name, emoji
          FROM desktop_workspace_profiles
          ORDER BY rowid
        `,
      )
      .all();
    const assignments = database
      .query<WorkspaceProfileAssignmentRow>(
        `
          SELECT profile_id, agent_id, connection_id, home_path
               , home_path_kind
          FROM desktop_workspace_profile_assignments
          ORDER BY rowid
        `,
      )
      .all();

    const assignmentsByProfileId = new Map<string, WorkspaceProfileAssignment[]>();
    for (const assignment of assignments) {
      const next = assignmentsByProfileId.get(assignment.profile_id) ?? [];
      if (!isAgentId(assignment.agent_id)) {
        continue;
      }
      const normalized: WorkspaceProfileAssignment = { agentId: assignment.agent_id };
      if (assignment.connection_id?.trim()) {
        normalized.connectionId = assignment.connection_id.trim();
      }
      if (assignment.home_path_kind === "null") {
        normalized.homePath = null;
      } else if (assignment.home_path_kind === "value" && assignment.home_path?.trim()) {
        normalized.homePath = assignment.home_path.trim();
      }
      next.push(normalized);
      assignmentsByProfileId.set(assignment.profile_id, next);
    }

    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.name.trim(),
      ...(profile.emoji?.trim() ? { emoji: profile.emoji.trim() } : {}),
      assignments: this.normalizeAssignments(assignmentsByProfileId.get(profile.id) ?? []),
    }));
  }

  private insertProfile(database: SqliteDatabase, profile: WorkspaceProfile): void {
    database.run(
      `
        INSERT INTO desktop_workspace_profiles (id, name, emoji)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          emoji = excluded.emoji
      `,
      profile.id,
      profile.name,
      profile.emoji ?? null,
    );
    database.run("DELETE FROM desktop_workspace_profile_assignments WHERE profile_id = ?", profile.id);
    this.insertAssignments(database, profile);
  }

  private insertAssignments(database: SqliteDatabase, profile: WorkspaceProfile): void {
    for (const assignment of profile.assignments) {
      database.run(
        `
          INSERT INTO desktop_workspace_profile_assignments (
            profile_id,
            agent_id,
            connection_id,
            home_path_kind,
            home_path
          ) VALUES (?, ?, ?, ?, ?)
        `,
        profile.id,
        assignment.agentId,
        assignment.connectionId ?? null,
        assignment.homePath === null ? "null" : assignment.homePath?.trim() ? "value" : "unset",
        assignment.homePath === null ? null : assignment.homePath ?? null,
      );
    }
  }

  private normalizeName(name: string): string {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error("Workspace profile name is required");
    }
    return normalizedName;
  }

  private assertNameAvailable(
    profiles: WorkspaceProfile[],
    name: string,
    currentProfileId?: string,
  ): void {
    const normalized = this.normalizeComparableName(name);
    const duplicate = profiles.find((profile) => {
      if (profile.id === currentProfileId) {
        return false;
      }
      return this.normalizeComparableName(profile.name) === normalized;
    });
    if (duplicate) {
      throw new Error(`Workspace profile name already exists: ${name}`);
    }
  }

  private normalizeComparableName(name: string): string {
    return name.trim().toLocaleLowerCase();
  }

  private normalizeEmoji(emoji?: string): string | undefined {
    const normalizedEmoji = emoji?.trim();
    return normalizedEmoji ? normalizedEmoji : undefined;
  }

  private normalizeAssignments(assignments: WorkspaceProfileAssignment[]): WorkspaceProfileAssignment[] {
    const byAgent = new Map<AgentId, WorkspaceProfileAssignment>();
    for (const assignment of assignments) {
      if (!isAgentId(assignment.agentId)) {
        continue;
      }

      const normalized: WorkspaceProfileAssignment = { agentId: assignment.agentId };
      if (assignment.connectionId?.trim()) {
        normalized.connectionId = assignment.connectionId.trim();
      }
      if (assignment.homePath === null) {
        normalized.homePath = null;
      } else if (assignment.homePath?.trim()) {
        normalized.homePath = assignment.homePath.trim();
      }
      if (!normalized.connectionId && normalized.homePath === undefined) {
        continue;
      }
      byAgent.set(normalized.agentId, normalized);
    }
    return [...byAgent.values()];
  }
}
