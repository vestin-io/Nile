import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentManifestDefinition } from "@nile/core/models/agent/registry/Types";
import { CODEX_DECLARATION } from "./Declaration";

const homePath = homedir();

export const CODEX_MANIFEST = {
  ...CODEX_DECLARATION,
  homeCandidates: [
    {
      path: join(homePath, ".codex"),
      markers: ["auth.json", "config.toml"],
    },
    {
      path: join(homePath, "Library", "Application Support", "Codex"),
      markers: ["auth.json", "config.toml"],
    },
  ],
} as const satisfies AgentManifestDefinition;
