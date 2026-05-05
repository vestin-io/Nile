import type { AgentId } from "../../models/agent/Types";
import type {
  MutationHistoryFileRecord,
  MutationHistoryRecord,
  MutationStatus,
  MutationType,
} from "./MutationHistoryTypes";

export type MutationHistoryRow = {
  id: string;
  agent_id: string;
  type: string;
  connection_id: string;
  connection_label: string | null;
  endpoint_label: string;
  access_label: string;
  status: string;
  rollback_of_mutation_id: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
};

export type MutationHistoryFileRow = {
  mutation_id: string;
  path: string;
  before_snapshot_kind: string;
  before_snapshot_ref: string;
  existed_before: number;
  before_checksum: string | null;
  after_checksum: string | null;
};

export function mapMutationHistoryRecord(
  row: MutationHistoryRow,
  files: MutationHistoryFileRecord[],
): MutationHistoryRecord {
  return {
    id: row.id,
    agentId: row.agent_id as AgentId,
    type: row.type as MutationType,
    connectionId: row.connection_id,
    connectionLabel: row.connection_label ?? row.access_label,
    endpointLabel: row.endpoint_label,
    accessLabel: row.access_label,
    status: row.status as MutationStatus,
    rollbackOfMutationId: row.rollback_of_mutation_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    files,
  };
}

export function mapMutationHistoryFiles(rows: MutationHistoryFileRow[]): MutationHistoryFileRecord[] {
  return rows.map((row) => ({
    path: row.path,
    beforeSnapshotKind: row.before_snapshot_kind as "file" | "secure",
    beforeSnapshotRef: row.before_snapshot_ref,
    existedBefore: row.existed_before === 1,
    beforeChecksum: row.before_checksum,
    afterChecksum: row.after_checksum,
  }));
}
