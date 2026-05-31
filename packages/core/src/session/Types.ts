import type { ConnectionFamilyId } from "../models/connection/family/Types";
import type { CurrentSessionSourceId } from "../models/connection/SourceTypes";
import type { AgentHomes } from "../models/agent/Homes";
import type { AgentRuntimeCommandOverrides } from "../models/agent/RuntimeCommands";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import type { StoredCredential } from "../services/credential/Types";

export type CurrentSessionCredentialRequest = {
  authMode: "openai_session" | "claude_session" | "cursor_session" | "gemini_cli_session";
  source: CurrentSessionSourceId;
  authJsonPath?: string;
};

export type CurrentSessionStoredCredential = Extract<
  StoredCredential,
  | { kind: "openai_session" }
  | { kind: "claude_session" }
  | { kind: "cursor_session" }
  | { kind: "gemini_cli_session" }
>;

export type CurrentSessionResolveContext = {
  agentHomes: AgentHomes | undefined;
  agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides;
  environment: EnvironmentSource;
  openExternalUrl?: (url: string) => Promise<void>;
};

export type CurrentSessionSourceManifest = {
  id: CurrentSessionSourceId;
  familyId: ConnectionFamilyId;
  authMode: CurrentSessionCredentialRequest["authMode"];
  label: string;
  usageUnauthorizedRecovery?: "sync_current_session_and_retry";
  recoverUnauthorizedUsage?(
    context: CurrentSessionResolveContext,
    request: CurrentSessionCredentialRequest,
  ): void | Promise<void>;
  resolve(
    context: CurrentSessionResolveContext,
    request: CurrentSessionCredentialRequest,
  ): CurrentSessionStoredCredential;
};
