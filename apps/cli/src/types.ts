import type { AgentHomes } from "@nile/core/models/agent";
import type { AuthMode } from "@nile/core/models/access";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { CredentialStore } from "@nile/core/services/credential";
import type { NileLogger } from "@nile/core/services/NileLogger";
import type { SecureSnapshotStore } from "@nile/core/services/history";
import type { InteractiveSessionLoginRegistry } from "@nile/builtins/session";
import type { InteractivePrompt } from "./InteractivePrompt";

export type CliOptions = {
  databasePath: string;
  /** Per-agent install roots; omitted keys use OS defaults (`~/.codex`, etc.). */
  agentHomes?: AgentHomes;
  environment?: EnvironmentSource;
  credentialStore?: CredentialStore;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  prompt?: InteractivePrompt;
  interactiveSessionLoginRegistry?: Pick<InteractiveSessionLoginRegistry, "signInAndRead">;
};

export type ResolvedCliOptions = {
  databasePath: string;
  agentHomes: AgentHomes;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
};

export type ParsedArguments = {
  command: string[];
  options: ResolvedCliOptions;
  flags: Map<string, string | boolean>;
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr?: string;
};

export type AddConnectionResult = {
  id: string;
  label: string;
  endpointId: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily;
  authMode: AuthMode;
  reused?: boolean;
};

export type HistoryListEntry = {
  startedAt: string;
  connectionLabel: string;
  endpointLabel: string;
  status: string;
  files: Array<{ path: string }>;
};
