import type { ConnectionFamilyModule } from "@nile/core/models/connection/family";

import { CURSOR_API_KEY_MANIFEST } from "./Manifest";

export const CURSOR_API_KEY_MODULE: ConnectionFamilyModule = {
  manifest: CURSOR_API_KEY_MANIFEST,
  behaviors: {},
};
