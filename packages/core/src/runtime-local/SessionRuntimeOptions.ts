import type { CursorUsageSessionProbe } from "../application/local/CursorUsageSessionProbe";
import type { AgentHomes } from "../models/agent/Homes";
import type { CredentialStore } from "../services/credential/Store";
import { type EnvironmentSource as EnvironmentSourceType } from "../services/EnvironmentSource";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import type { NileLogger } from "../services/NileLogger";
import { SqliteDatabase } from "../services/database/SqliteDatabase";

export type SessionRuntimeOptions = {
  databasePath: string;
  database: SqliteDatabase;
  credentialStore: CredentialStore;
  agentHomes: AgentHomes;
  environment?: EnvironmentSourceType;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  cursorUsageSessionProbe?: CursorUsageSessionProbe;
};
