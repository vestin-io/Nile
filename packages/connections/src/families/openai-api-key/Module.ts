import type { ConnectionFamilyModule } from "@nile/core/models/connection/family";

import { OPENAI_API_KEY_MANIFEST } from "./Manifest";

export const OPENAI_API_KEY_MODULE: ConnectionFamilyModule = {
  manifest: OPENAI_API_KEY_MANIFEST,
  behaviors: {},
};
