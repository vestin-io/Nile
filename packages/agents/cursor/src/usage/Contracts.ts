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

export type BindCursorUsageResult = {
  connectionId: string;
  connectionLabel: string;
  endpointFamily: string;
  endpointLabel: string;
  workosUserId: string;
  boundAt: string;
};

export type CursorUsageAutoBindResult =
  | {
      connectionId: string;
      status: "bound";
      binding: BindCursorUsageResult;
      sourceLabel: string;
      locationLabel: string;
    }
  | {
      connectionId: string;
      status: "already_bound" | "no_session_found" | "not_cursor_connection";
    };
