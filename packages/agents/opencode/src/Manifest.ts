import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentManifestDefinition } from "@nile/core/models/agent/registry/Types";
import { OPENCODE_DECLARATION } from "./Declaration";

const homePath = homedir();

export const OPENCODE_MANIFEST = {
  ...OPENCODE_DECLARATION,
  homeCandidates: [
    {
      path: join(homePath, ".config", "opencode"),
      markers: ["opencode.json", "AGENTS.md"],
    },
    {
      path: join(homePath, ".opencode"),
      markers: ["config.json", "AGENTS.md"],
    },
  ],
} as const satisfies AgentManifestDefinition;
