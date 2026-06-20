import { app } from "electron";
import { registerBuiltins } from "@nile/builtins";
import { DesktopStoragePaths } from "./app/Paths";
import { DesktopMain } from "./shell/DesktopMain";

registerBuiltins();

const isMacAppStore = process.mas === true && process.platform === "darwin";
const storagePaths = new DesktopStoragePaths({
  isMacAppStore,
  userDataPath: isMacAppStore ? app.getPath("userData") : undefined,
});

const desktop = new DesktopMain({
  databasePath: storagePaths.readDatabasePath(),
  isMacAppStore,
});

async function startDesktop(): Promise<void> {
  await desktop.start();
}

void startDesktop();
