import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

import { isAgentId, type AgentId } from "@nile/core/models/agent";

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

type WorkspaceProfileFile = {
  profiles?: unknown;
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
  constructor(private readonly filePath: string) {}

  list(): WorkspaceProfile[] {
    return this.readProfiles();
  }

  create(input: CreateWorkspaceProfileInput): WorkspaceProfile {
    const normalizedName = this.normalizeName(input.name);
    const profiles = this.readProfiles();
    this.assertNameAvailable(profiles, normalizedName);
    const profile: WorkspaceProfile = {
      id: randomUUID(),
      name: normalizedName,
      ...(this.normalizeEmoji(input.emoji) ? { emoji: this.normalizeEmoji(input.emoji) } : {}),
      assignments: this.normalizeAssignments(input.assignments),
    };
    const nextProfiles = [...profiles, profile];
    this.writeProfiles(nextProfiles);
    return profile;
  }

  update(profileId: string, input: UpdateWorkspaceProfileInput): WorkspaceProfile {
    const profiles = this.readProfiles();
    const index = profiles.findIndex((profile) => profile.id === profileId);
    if (index < 0) {
      throw new Error(`Workspace profile not found: ${profileId}`);
    }

    const normalizedName = this.normalizeName(input.name);
    this.assertNameAvailable(profiles, normalizedName, profiles[index].id);
    const normalizedEmoji = this.normalizeEmoji(input.emoji);
    const updated = {
      ...profiles[index],
      assignments: this.normalizeAssignments(input.assignments),
      name: normalizedName,
      ...(normalizedEmoji ? { emoji: normalizedEmoji } : {}),
    };
    if (!normalizedEmoji) {
      delete updated.emoji;
    }
    profiles[index] = updated;
    this.writeProfiles(profiles);
    return updated;
  }

  delete(profileId: string): void {
    const profiles = this.readProfiles();
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    if (nextProfiles.length === profiles.length) {
      throw new Error(`Workspace profile not found: ${profileId}`);
    }
    this.writeProfiles(nextProfiles);
  }

  read(profileId: string): WorkspaceProfile {
    const profile = this.readProfiles().find((entry) => entry.id === profileId);
    if (!profile) {
      throw new Error(`Workspace profile not found: ${profileId}`);
    }
    return profile;
  }

  private readProfiles(): WorkspaceProfile[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    const raw = readFileSync(this.filePath, "utf8");
    if (!raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw) as WorkspaceProfileFile;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Desktop workspace profiles config must contain a JSON object");
    }
    if (!Array.isArray(parsed.profiles)) {
      return [];
    }

    return parsed.profiles.flatMap((entry) => this.readProfile(entry));
  }

  private readProfile(entry: unknown): WorkspaceProfile[] {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) {
      return [];
    }
    if (typeof record.name !== "string" || !record.name.trim()) {
      return [];
    }
    if (!Array.isArray(record.assignments)) {
      return [];
    }

    return [{
      id: record.id.trim(),
      name: record.name.trim(),
      ...(typeof record.emoji === "string" && record.emoji.trim() ? { emoji: record.emoji.trim() } : {}),
      assignments: this.normalizeAssignments(record.assignments.flatMap((assignment) => this.readAssignment(assignment))),
    }];
  }

  private readAssignment(entry: unknown): WorkspaceProfileAssignment[] {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.agentId !== "string" || !isAgentId(record.agentId)) {
      return [];
    }

    const assignment: WorkspaceProfileAssignment = { agentId: record.agentId };
    if (typeof record.connectionId === "string" && record.connectionId.trim()) {
      assignment.connectionId = record.connectionId.trim();
    }
    if (typeof record.homePath === "string" && record.homePath.trim()) {
      assignment.homePath = record.homePath.trim();
    } else if (record.homePath === null) {
      assignment.homePath = null;
    }
    return [assignment];
  }

  private writeProfiles(profiles: WorkspaceProfile[]): void {
    if (profiles.length === 0) {
      rmSync(this.filePath, { force: true });
      return;
    }

    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify({ profiles }, null, 2)}\n`, "utf8");
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
