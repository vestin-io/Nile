import type { AgentId } from "../../models/agent/Types";

export type MutationType = "apply_selection" | "rollback_latest";

export type MutationStatus = "started" | "applied" | "failed" | "rolled_back";

export type MutationTrackedFileInput = {
  path: string;
  content: string | null;
  existedBefore: boolean;
  isSensitive?: boolean;
};

export type MutationAfterFileInput = {
  path: string;
  content: string | null;
};

export type MutationHistoryFileRecord = {
  path: string;
  beforeSnapshotKind: "file" | "secure";
  beforeSnapshotRef: string;
  existedBefore: boolean;
  beforeChecksum: string | null;
  afterChecksum: string | null;
};

export type MutationHistoryRecord = {
  id: string;
  agentId: AgentId;
  type: MutationType;
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  accessLabel: string;
  status: MutationStatus;
  rollbackOfMutationId: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  files: MutationHistoryFileRecord[];
};

export type StartMutationInput = {
  agentId: AgentId;
  type: MutationType;
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  accessLabel: string;
  rollbackOfMutationId?: string;
  files: MutationTrackedFileInput[];
};

export type RollbackLatestMutationResult = {
  agentId: AgentId;
  rollbackEntry: MutationHistoryRecord;
  rolledBackEntry: MutationHistoryRecord;
};
