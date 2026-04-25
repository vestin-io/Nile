import { homedir } from "node:os";
import { join } from "node:path";

import { DesktopMain } from "./DesktopMain";

const desktop = new DesktopMain({
  databasePath: join(homedir(), ".nile-switcher", "switcher.sqlite"),
});

async function startDesktop(): Promise<void> {
  await desktop.start();
}

void startDesktop();
