import { ClaudeAgentAdapter } from "../agents/claude/ClaudeAgentAdapter";
import { CodexAgentAdapter } from "../agents/codex/CodexAgentAdapter";
import { CursorAgentAdapter } from "../agents/cursor/CursorAgentAdapter";
import { OpenClawAgentAdapter } from "../agents/openclaw/OpenClawAgentAdapter";
import type { AgentHomes } from "../models/agent/Homes";
import { resolveAgentHome } from "../models/agent/Homes";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import { NileLogger } from "../services/NileLogger";
import type { AgentAdapter } from "../models/agent";
import type { CredentialStore } from "../services/credential/Store";
import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";

export type BuiltInAgentAdapterOptions = {
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  agentHomes?: AgentHomes;
};

export class BuiltInAgentAdapters {
  static create(
    databasePath: string,
    options: BuiltInAgentAdapterOptions,
    sharedContext?: AgentWorkspaceContext,
  ): AgentAdapter[] {
    const homes = options.agentHomes;
    return [
      new CodexAgentAdapter({
        databasePath,
        codexHome: resolveAgentHome("codex", homes),
        credentialStore: options.credentialStore,
        environment: options.environment,
        secureSnapshotStore: options.secureSnapshotStore,
        logger: options.logger?.child({ agent: "codex" }),
        sharedContext,
      }),
      new CursorAgentAdapter({
        databasePath,
        cursorHome: resolveAgentHome("cursor", homes),
        credentialStore: options.credentialStore,
        environment: options.environment,
        secureSnapshotStore: options.secureSnapshotStore,
        logger: options.logger?.child({ agent: "cursor" }),
        sharedContext,
      }),
      new ClaudeAgentAdapter({
        databasePath,
        claudeHome: resolveAgentHome("claude", homes),
        credentialStore: options.credentialStore,
        secureSnapshotStore: options.secureSnapshotStore,
        logger: options.logger?.child({ agent: "claude" }),
        sharedContext,
      }),
      new OpenClawAgentAdapter({
        databasePath,
        openclawHome: resolveAgentHome("openclaw", homes),
        codexHome: resolveAgentHome("codex", homes),
        credentialStore: options.credentialStore,
        environment: options.environment,
        secureSnapshotStore: options.secureSnapshotStore,
        logger: options.logger?.child({ agent: "openclaw" }),
        sharedContext,
      }),
    ];
  }

  static fromSharedContext(
    context: AgentWorkspaceContext,
    options: BuiltInAgentAdapterOptions,
  ): AgentAdapter[] {
    return BuiltInAgentAdapters.create(context.databasePath, options, context);
  }
}
