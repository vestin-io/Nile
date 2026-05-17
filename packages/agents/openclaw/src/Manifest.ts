import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentManifestDefinition } from "@nile/core/models/agent/registry/Types";
import { OPENCLAW_DECLARATION } from "./Declaration";

const homePath = homedir();

export const OPENCLAW_MANIFEST = {
  ...OPENCLAW_DECLARATION,
  homeCandidates: [
    {
      path: join(homePath, ".openclaw"),
      markers: ["openclaw.json"],
    },
    {
      path: join(homePath, "Library", "Application Support", "OpenClaw"),
      markers: ["openclaw.json"],
    },
  ],
} as const satisfies AgentManifestDefinition;
