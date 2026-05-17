import { homedir } from "node:os";

import {
  ChromiumCursorSessionProbe,
  CursorStateDbProbe,
  CursorUsageSessionSourceProbe,
  type CursorUsageSessionProbe,
} from "@nile/host-local";
import type { AgentHomes } from "@nile/core/models/agent";

export class CursorUsageSessionProbeFactory {
  create(agentHomes: AgentHomes | undefined): CursorUsageSessionProbe {
    const cursorHome = agentHomes?.cursor ?? homedir();
    const browserHome = process.env.NILE_BROWSER_HOME?.trim() || homedir();

    return new CursorUsageSessionSourceProbe([
      new CursorStateDbProbe(CursorStateDbProbe.listDefaultSources(cursorHome)),
      new ChromiumCursorSessionProbe(ChromiumCursorSessionProbe.listDefaultSources(browserHome)),
    ]);
  }
}
