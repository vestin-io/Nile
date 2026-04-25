import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DesktopLauncher } from "./DesktopLauncher";

const root = dirname(fileURLToPath(import.meta.url));
const launcher = new DesktopLauncher(root);
const exitCode = await launcher.run("./dist/electron/main.cjs");

process.exit(exitCode ?? 0);
