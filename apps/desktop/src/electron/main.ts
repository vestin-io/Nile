import { homedir } from "node:os";
import { join } from "node:path";

import { registerBuiltins } from "@nile/builtins";
import { DesktopMain } from "./shell/DesktopMain";

registerBuiltins();

const desktop = new DesktopMain({
  databasePath: join(homedir(), ".nile-switcher", "switcher.sqlite"),
});

async function startDesktop(): Promise<void> {
  await desktop.start();
}

void startDesktop();
