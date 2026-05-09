import { ipcMain } from "electron";

import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "../profiles/Store";

type DesktopIpcProfileRoutesOptions = {
  applyProfile(profileId: string): Promise<WorkspaceProfile>;
  createProfile(name: string, emoji: string | undefined, assignments: WorkspaceProfileAssignment[]): WorkspaceProfile;
  deleteProfile(profileId: string): void;
  inputs: DesktopIpcInputValidator;
  listProfiles(): WorkspaceProfile[];
  refreshAll(): void;
  updateProfile(profileId: string, name: string, emoji: string | undefined, assignments: WorkspaceProfileAssignment[]): WorkspaceProfile;
};

export class DesktopIpcProfileRoutes {
  constructor(private readonly options: DesktopIpcProfileRoutesOptions) {}

  register(): void {
    const { inputs } = this.options;

    ipcMain.handle("desktop:list-workspace-profiles", () => this.options.listProfiles());
    ipcMain.handle("desktop:create-workspace-profile", (_event, name: unknown, emoji: unknown, assignments: unknown) => {
      const profile = this.options.createProfile(
        inputs.readRequiredString(name, "name"),
        inputs.readOptionalString(emoji, "emoji"),
        inputs.readWorkspaceProfileAssignments(assignments),
      );
      this.options.refreshAll();
      return profile;
    });
    ipcMain.handle("desktop:update-workspace-profile", (_event, profileId: unknown, name: unknown, emoji: unknown, assignments: unknown) => {
      const profile = this.options.updateProfile(
        inputs.readRequiredString(profileId, "profileId"),
        inputs.readRequiredString(name, "name"),
        inputs.readOptionalString(emoji, "emoji"),
        inputs.readWorkspaceProfileAssignments(assignments),
      );
      this.options.refreshAll();
      return profile;
    });
    ipcMain.handle("desktop:delete-workspace-profile", (_event, profileId: unknown) => {
      this.options.deleteProfile(inputs.readRequiredString(profileId, "profileId"));
      this.options.refreshAll();
    });
    ipcMain.handle("desktop:apply-workspace-profile", async (_event, profileId: unknown) => {
      const profile = await this.options.applyProfile(inputs.readRequiredString(profileId, "profileId"));
      this.options.refreshAll();
      return profile;
    });
  }
}
