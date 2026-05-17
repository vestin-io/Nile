import type { CursorUsageSessionCandidate, CursorUsageSessionProbe } from "./Contracts";

export type { CursorUsageSessionCandidate, CursorUsageSessionProbe };

export class EmptyCursorUsageSessionProbe implements CursorUsageSessionProbe {
  probe(): CursorUsageSessionCandidate[] {
    return [];
  }
}
