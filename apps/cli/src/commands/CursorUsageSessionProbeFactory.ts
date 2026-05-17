import { homedir } from "node:os";

import {
  ChromiumCursorSessionProbe,
  CursorStateDbProbe,
  CursorUsageSessionSourceProbe,
  type CursorUsageSessionProbe,
} from "@nile/host-local";

import type { ResolvedCliOptions } from "../types";

export class CursorUsageSessionProbeFactory {
  create(options: ResolvedCliOptions): CursorUsageSessionProbe {
    const cursorHome = options.agentHomes.cursor;
    const browserHome = process.env.NILE_BROWSER_HOME?.trim() || homedir();

    return new CursorUsageSessionSourceProbe([
      new CursorStateDbProbe(CursorStateDbProbe.listDefaultSources(cursorHome)),
      new ChromiumCursorSessionProbe(ChromiumCursorSessionProbe.listDefaultSources(browserHome)),
    ]);
  }
}
