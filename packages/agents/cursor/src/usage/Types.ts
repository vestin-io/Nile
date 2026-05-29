import type { CredentialSource } from "@nile/core/services/credential/Source";
import type { CredentialStorageBackend } from "@nile/core/services/credential/Store";

export type CursorAccountFingerprint = {
  authId: string;
  workosUserId: string;
  email?: string;
};

export type CursorUsageBindingRecord = {
  connectionId: string;
  accountFingerprint: CursorAccountFingerprint;
  credentialSource: CredentialSource;
  credentialStorageBackend?: CredentialStorageBackend;
  observedAt: string;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CursorUsageBindingInput = {
  connectionId: string;
  accountFingerprint: CursorAccountFingerprint;
  credentialStorageBackend?: CredentialStorageBackend;
};

export type CursorUsageSnapshotFreshness = "live" | "cached" | "stale" | "expired";

export type CursorUsageSnapshotRecord = {
  connectionId: string;
  accountFingerprint: CursorAccountFingerprint;
  totalPercentUsed: number;
  autoPercentUsed: number;
  apiPercentUsed: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  fetchedAt: string;
  freshness: CursorUsageSnapshotFreshness;
  createdAt: string;
  updatedAt: string;
};

export type CursorUsageSnapshotInput = {
  connectionId: string;
  accountFingerprint: CursorAccountFingerprint;
  totalPercentUsed: number;
  autoPercentUsed: number;
  apiPercentUsed: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  fetchedAt: string;
  freshness: CursorUsageSnapshotFreshness;
};
