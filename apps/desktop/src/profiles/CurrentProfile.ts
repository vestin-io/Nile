import type { AgentId } from "@nile/core/models/agent";

import type { WorkspaceProfile, WorkspaceProfileAssignment } from "../electron/profiles/Store";
import type { DesktopAdvancedState, DesktopAgentState } from "../state/Types";

export function readCurrentProfileIds(
  profiles: WorkspaceProfile[],
  agents: DesktopAgentState[],
  agentHomes: DesktopAdvancedState["agentHomes"],
): Set<string> {
  const defaultHomesByAgent = new Map(agentHomes.map((home) => [home.agentId, home.defaultPath]));
  const currentAssignments = buildCurrentAssignments(agents, agentHomes, defaultHomesByAgent);
  const matchedProfiles = profiles.flatMap((profile) => {
    const normalizedAssignments = normalizeSavedAssignments(profile.assignments, agents, defaultHomesByAgent);
    if (normalizedAssignments.length === 0) {
      return [];
    }
    if (!profileMatchesCurrent(normalizedAssignments, currentAssignments)) {
      return [];
    }
    return [{
      id: profile.id,
      specificity: readAssignmentSpecificity(normalizedAssignments),
    }];
  });

  if (matchedProfiles.length === 0) {
    return new Set();
  }

  const highestSpecificity = Math.max(...matchedProfiles.map((profile) => profile.specificity));
  const highestSpecificityMatches = matchedProfiles.filter((profile) => profile.specificity === highestSpecificity);
  if (highestSpecificityMatches.length !== 1) {
    return new Set();
  }

  return new Set([highestSpecificityMatches[0].id]);
}

export function readCurrentProfile(
  profiles: WorkspaceProfile[],
  agents: DesktopAgentState[],
  agentHomes: DesktopAdvancedState["agentHomes"],
): WorkspaceProfile | null {
  const currentProfileIds = readCurrentProfileIds(profiles, agents, agentHomes);
  return profiles.find((profile) => currentProfileIds.has(profile.id)) ?? null;
}

function buildCurrentAssignments(
  agents: DesktopAgentState[],
  agentHomes: DesktopAdvancedState["agentHomes"],
  defaultHomesByAgent: Map<AgentId, string>,
): WorkspaceProfileAssignment[] {
  const homesByAgent = new Map(agentHomes.map((home) => [home.agentId, home.path]));

  return agents.flatMap((agent) => {
    const assignment: WorkspaceProfileAssignment = { agentId: agent.agentId };
    if (agent.currentConnection?.id) {
      assignment.connectionId = agent.currentConnection.id;
    }

    const normalizedHome = normalizeHomeInput(
      homesByAgent.get(agent.agentId) ?? "",
      defaultHomesByAgent.get(agent.agentId) ?? "",
    );
    if (normalizedHome !== undefined) {
      assignment.homePath = normalizedHome;
    }

    if (!assignment.connectionId && assignment.homePath === undefined) {
      return [];
    }

    return [assignment];
  });
}

function normalizeSavedAssignments(
  assignments: WorkspaceProfileAssignment[],
  agents: DesktopAgentState[],
  defaultHomesByAgent: Map<AgentId, string>,
): WorkspaceProfileAssignment[] {
  const assignmentsByAgent = new Map(assignments.map((assignment) => [assignment.agentId, assignment]));

  return agents.flatMap((agent) => {
    const assignment = assignmentsByAgent.get(agent.agentId);
    if (!assignment) {
      return [];
    }

    const normalized: WorkspaceProfileAssignment = { agentId: agent.agentId };
    if (assignment.connectionId?.trim()) {
      normalized.connectionId = assignment.connectionId.trim();
    }

    const homeInput = assignment.homePath === null
      ? defaultHomesByAgent.get(agent.agentId) ?? ""
      : assignment.homePath ?? "";
    const normalizedHome = normalizeHomeInput(homeInput, defaultHomesByAgent.get(agent.agentId) ?? "");
    if (normalizedHome !== undefined) {
      normalized.homePath = normalizedHome;
    }

    if (!normalized.connectionId && normalized.homePath === undefined) {
      return [];
    }

    return [normalized];
  });
}

function profileMatchesCurrent(
  normalizedProfileAssignments: WorkspaceProfileAssignment[],
  currentAssignments: WorkspaceProfileAssignment[],
): boolean {
  const currentByAgent = new Map(currentAssignments.map((assignment) => [assignment.agentId, assignment]));
  return normalizedProfileAssignments.every((assignment) => {
    const current = currentByAgent.get(assignment.agentId);
    return (
      current?.connectionId === assignment.connectionId
      && current?.homePath === assignment.homePath
    );
  });
}

function readAssignmentSpecificity(assignments: WorkspaceProfileAssignment[]): number {
  let specificity = 0;
  for (const assignment of assignments) {
    if (assignment.connectionId) {
      specificity += 1;
    }
    if (assignment.homePath !== undefined) {
      specificity += 1;
    }
  }
  return specificity;
}

function normalizeHomeInput(input: string, defaultHomePath: string): string | null | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed === defaultHomePath.trim()) {
    return null;
  }
  return trimmed;
}
