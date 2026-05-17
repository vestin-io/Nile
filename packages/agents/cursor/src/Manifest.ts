import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentManifestDefinition } from "@nile/core/models/agent/registry/Types";
import { CURSOR_DECLARATION } from "./Declaration";

const homePath = homedir();

export const CURSOR_MANIFEST = {
  ...CURSOR_DECLARATION,
  homeCandidates: [
    {
      path: join(homePath, ".cursor"),
      markers: ["cli-config.json"],
    },
    {
      path: join(homePath, "Library", "Application Support", "Cursor"),
      markers: ["cli-config.json"],
    },
  ],
} as const satisfies AgentManifestDefinition;
