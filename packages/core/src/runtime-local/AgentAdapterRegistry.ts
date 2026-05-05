import type { CredentialStore } from "../services/credential/Store";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import { NileLogger } from "../services/NileLogger";
import type { AgentHomes } from "../models/agent/Homes";
import { resolveAgentHome } from "../models/agent/Homes";
import type { AgentId } from "../models/agent/Types";
import type { SharedAgentAdapterContext } from "./AgentAdapterContext";
import { ClaudeAgentAdapter } from "../agents/claude/ClaudeAgentAdapter";
import { CodexAgentAdapter } from "../agents/codex/CodexAgentAdapter";
import { CursorAgentAdapter } from "../agents/cursor/CursorAgentAdapter";
import { OpenClawAgentAdapter } from "../agents/openclaw/OpenClawAgentAdapter";
import type { AgentAdapter, AgentCapabilitySupport } from "./AgentAdapterTypes";

export class AgentAdapterRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentAdapterRegistryError";
  }
}

export type SharedAdapterOptions = {
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  agentHomes?: AgentHomes;
};

export class AgentAdapterRegistry {
  static open(
    databasePath: string,
    options: SharedAdapterOptions,
  ): AgentAdapterRegistry {
    return AgentAdapterRegistry.fromAdapters(
      AgentAdapterRegistry.buildBuiltInAdapters(databasePath, options),
    );
  }

  static fromSharedContext(
    context: SharedAgentAdapterContext,
    options: SharedAdapterOptions,
  ): AgentAdapterRegistry {
    return AgentAdapterRegistry.fromAdapters(
      AgentAdapterRegistry.buildBuiltInAdapters(context.databasePath, options, context),
    );
  }

  private static buildBuiltInAdapters(
    databasePath: string,
    options: SharedAdapterOptions,
    sharedContext?: SharedAgentAdapterContext,
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
        credentialStore: options.credentialStore,
        environment: options.environment,
        secureSnapshotStore: options.secureSnapshotStore,
        logger: options.logger?.child({ agent: "openclaw" }),
        sharedContext,
      }),
    ];
  }

  static fromAdapters(adapters: AgentAdapter[]): AgentAdapterRegistry {
    const seen = new Set<AgentId>();
    for (const adapter of adapters) {
      if (seen.has(adapter.agentId)) {
        throw new AgentAdapterRegistryError(`Duplicate agent adapter registered: ${adapter.agentId}`);
      }
      seen.add(adapter.agentId);
    }
    return new AgentAdapterRegistry(
      new Map(adapters.map((a) => [a.agentId, a])),
    );
  }

  constructor(private readonly adapters: Map<AgentId, AgentAdapter>) {}

  get(agentId: AgentId): AgentAdapter {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new AgentAdapterRegistryError(`Agent adapter not implemented: ${agentId}`);
    }
    return adapter;
  }

  listRollbackSupport(): Array<{ agentId: AgentId; rollback: AgentCapabilitySupport }> {
    return Array.from(this.adapters.values()).map((adapter) => ({
      agentId: adapter.agentId,
      rollback: adapter.rollbackSupport,
    }));
  }

  listAgents(): AgentId[] {
    return Array.from(this.adapters.keys());
  }
}
