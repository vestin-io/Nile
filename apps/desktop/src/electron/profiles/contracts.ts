import type { WorkspaceProfile, WorkspaceProfileAssignment } from "./Store";

export type DesktopProfileBridge = {
  listProfiles(): Promise<WorkspaceProfile[]>;
  createProfile(name: string, emoji: string | undefined, assignments: WorkspaceProfileAssignment[]): Promise<WorkspaceProfile>;
  updateProfile(
    profileId: string,
    name: string,
    emoji: string | undefined,
    assignments: WorkspaceProfileAssignment[],
  ): Promise<WorkspaceProfile>;
  deleteProfile(profileId: string): Promise<void>;
  applyProfile(profileId: string): Promise<WorkspaceProfile>;
};
