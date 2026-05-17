import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentManifestDefinition } from "@nile/core/models/agent/registry/Types";
import { GEMINI_DECLARATION } from "./Declaration";

const homePath = homedir();

export const GEMINI_MANIFEST = {
  ...GEMINI_DECLARATION,
  homeCandidates: [
    {
      path: join(homePath, ".gemini"),
      markers: ["settings.json", "google_accounts.json", "oauth_creds.json"],
    },
    {
      path: join(homePath, "Library", "Application Support", "Gemini"),
      markers: ["settings.json", "google_accounts.json", "oauth_creds.json"],
    },
  ],
} as const satisfies AgentManifestDefinition;
