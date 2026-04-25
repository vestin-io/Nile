import type { EndpointFamily } from "../../models/endpoint";

export type ConnectionUsageStatus = "available" | "unavailable" | "unsupported" | "error";

export type ConnectionUsageSource = "remote_api" | "local_artifact";

export type ConnectionUsageFreshness = "live" | "cached" | "stale" | "expired";

export type ConnectionUsageWindow = {
  kind: "primary" | "secondary" | "additional";
  label: string;
  usedPercent: number | null;
  remainingPercent: number | null;
  windowSeconds: number | null;
  resetsAt: string | null;
  allowed?: boolean;
  limitReached?: boolean;
  featureName?: string;
};

export type ConnectionUsageResult = {
  connectionId: string;
  connectionLabel: string;
  endpointFamily: EndpointFamily;
  endpointLabel: string;
  status: ConnectionUsageStatus;
  source: ConnectionUsageSource;
  freshness?: ConnectionUsageFreshness;
  lastFetchedAt?: string;
  planLabel?: string;
  message?: string;
  windows: ConnectionUsageWindow[];
};
