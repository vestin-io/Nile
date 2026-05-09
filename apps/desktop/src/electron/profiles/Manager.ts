import type { AgentId } from "@nile/core/models/agent";

import type { SettingsState } from "../../state/Types";
import type { DesktopStateStore } from "../state/DesktopStateStore";
import { WorkspaceProfileStore, type WorkspaceProfile, type WorkspaceProfileAssignment } from "./Store";

type WorkspaceProfileManagerOptions = {
  stateStore: DesktopStateStore;
  store: WorkspaceProfileStore;
  updateAgentHome(agentId: AgentId, path: string | null): void;
};

export class WorkspaceProfileManager {
  constructor(private readonly options: WorkspaceProfileManagerOptions) {}

  list(): WorkspaceProfile[] {
    return this.options.store.list();
  }

  create(name: string, emoji: string | undefined, assignments: WorkspaceProfileAssignment[]): WorkspaceProfile {
    return this.options.store.create({ name, emoji, assignments });
  }

  update(profileId: string, name: string, emoji: string | undefined, assignments: WorkspaceProfileAssignment[]): WorkspaceProfile {
    return this.options.store.update(profileId, { name, emoji, assignments });
  }

  delete(profileId: string): void {
    this.options.store.delete(profileId);
  }

  async apply(profileId: string): Promise<WorkspaceProfile> {
    const profile = this.options.store.read(profileId);
    const state = await this.options.stateStore.getSettingsState();
    this.validateProfile(profile, state);

    for (const assignment of profile.assignments) {
      if (assignment.homePath !== undefined && this.shouldApplyHome(assignment, state)) {
        this.options.updateAgentHome(assignment.agentId, assignment.homePath);
      }
    }

    for (const assignment of profile.assignments) {
      if (assignment.connectionId && this.shouldApplyConnection(assignment, state)) {
        await this.options.stateStore.switchConnection(assignment.agentId, assignment.connectionId);
      }
    }

    return profile;
  }

  private validateProfile(profile: WorkspaceProfile, state: SettingsState): void {
    const agents = new Map(state.agents.map((agent) => [agent.agentId, agent]));
    for (const assignment of profile.assignments) {
      const agent = agents.get(assignment.agentId);
      if (!agent) {
        throw new Error(`Workspace profile ${profile.name} references an unsupported agent`);
      }
      if (!assignment.connectionId) {
        continue;
      }
      const connection = agent.connections.find((entry) => entry.id === assignment.connectionId);
      if (!connection) {
        throw new Error(`Workspace profile ${profile.name} references a connection that ${agent.agentLabel} cannot use`);
      }
    }
  }

  private shouldApplyHome(assignment: WorkspaceProfileAssignment, state: SettingsState): boolean {
    const currentHome = state.advanced.agentHomes.find((home) => home.agentId === assignment.agentId);
    if (!currentHome) {
      return true;
    }
    const targetPath = assignment.homePath ?? currentHome.defaultPath;
    return currentHome.path !== targetPath;
  }

  private shouldApplyConnection(assignment: WorkspaceProfileAssignment, state: SettingsState): boolean {
    const agent = state.agents.find((entry) => entry.agentId === assignment.agentId);
    return agent?.currentConnection?.id !== assignment.connectionId;
  }
}
