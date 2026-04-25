export type CursorUsageSessionCandidate = {
  sourceId: string;
  sourceLabel: string;
  locationLabel: string;
  workosUserId: string;
  sessionToken: string;
};

export interface CursorUsageSessionProbe {
  probe(): CursorUsageSessionCandidate[];
}
