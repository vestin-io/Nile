import type { AgentHomes } from "@nile/core/models/agent/Homes";
import type { AgentRuntimeCommandOverrides } from "@nile/core/models/agent/RuntimeCommands";
import type { CredentialStore } from "@nile/core/services/credential/Store";
import { type EnvironmentSource as EnvironmentSourceType } from "@nile/core/services/EnvironmentSource";
import type { SecureSnapshotStore } from "@nile/core/services/history/SecureSnapshotStore";
import type { NileLogger } from "@nile/core/services/NileLogger";
import { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";

export type SessionRuntimeOptions = {
  databasePath: string;
  database: SqliteDatabase;
  credentialStore: CredentialStore;
  agentHomes: AgentHomes;
  agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides;
  environment?: EnvironmentSourceType;
  openExternalUrl?: (url: string) => Promise<void>;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
};
