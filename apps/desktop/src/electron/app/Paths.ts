import { homedir } from "node:os";
import { join } from "node:path";

type DesktopStoragePathsOptions = {
  homeDir?: string;
  isMacAppStore?: boolean;
  userDataPath?: string;
};

export class DesktopStoragePaths {
  constructor(private readonly options: DesktopStoragePathsOptions = {}) {}

  readDatabasePath(): string {
    return join(this.readStateRoot(), "switcher.sqlite");
  }

  private readStateRoot(): string {
    if (!this.options.isMacAppStore) {
      return join(this.options.homeDir ?? homedir(), ".nile-switcher");
    }

    const userDataPath = this.options.userDataPath?.trim();
    if (!userDataPath) {
      throw new Error("Mac App Store builds require an Electron userData path.");
    }
    return userDataPath;
  }
}
