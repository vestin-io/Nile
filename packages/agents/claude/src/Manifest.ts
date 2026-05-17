import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentManifestDefinition } from "@nile/core/models/agent/registry/Types";
import { CLAUDE_DECLARATION } from "./Declaration";

const homePath = homedir();

export const CLAUDE_MANIFEST = {
  ...CLAUDE_DECLARATION,
  homeCandidates: [
    {
      path: join(homePath, ".claude"),
      markers: ["settings.json", ".credentials.json"],
    },
    {
      path: join(homePath, "Library", "Application Support", "Claude"),
      markers: ["settings.json", ".credentials.json"],
    },
  ],
} as const satisfies AgentManifestDefinition;
