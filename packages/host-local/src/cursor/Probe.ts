import { ChromiumCursorSessionProbe } from "./ChromiumCursorSessionProbe";
import { CursorStateDbProbe } from "./State";
import type { CursorUsageSessionCandidate, CursorUsageSessionProbe } from "./Types";

export class CursorUsageSessionSourceProbe implements CursorUsageSessionProbe {
  static createDefault(): CursorUsageSessionSourceProbe {
    return new CursorUsageSessionSourceProbe([
      CursorStateDbProbe.createDefault(),
      ChromiumCursorSessionProbe.createDefault(),
    ]);
  }

  constructor(private readonly probes: CursorUsageSessionProbe[]) {}

  probe(): CursorUsageSessionCandidate[] {
    for (const probe of this.probes) {
      const seen = new Set<string>();
      const candidates: CursorUsageSessionCandidate[] = [];
      for (const candidate of probe.probe()) {
        const key = `${candidate.workosUserId}:${candidate.sessionToken}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        candidates.push(candidate);
      }
      if (candidates.length > 0) {
        return candidates;
      }
    }
    return [];
  }
}
