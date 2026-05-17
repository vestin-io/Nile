import type { ConnectionFamilyModule } from "@nile/core/models/connection/family";

import { ANTHROPIC_API_KEY_MANIFEST } from "./Manifest";

export const ANTHROPIC_API_KEY_MODULE: ConnectionFamilyModule = {
  manifest: ANTHROPIC_API_KEY_MANIFEST,
  behaviors: {},
};
