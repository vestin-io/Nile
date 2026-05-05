import { homedir } from "node:os";
import { join } from "node:path";

import {
  type AgentHomes,
  resolveAgentHome,
  type AgentId,
} from "@nile/core/models/agent";
import { NileSession } from "@nile/core/runtime-local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  type CredentialStore,
  KeychainCredentialStore,
} from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { SecureSnapshotStore } from "@nile/core/services/history";
import {
  type DesktopConnection,
  type HistoryState,
  type MenubarState,
  type SettingsState,
} from "./Types";
import { DesktopConnectionPresenter } from "./ConnectionPresenter";
import { DesktopHistoryStateQuery } from "./HistoryQuery";
import { DesktopMenubarStateQuery } from "./MenubarQuery";
import { DesktopSettingsStateQuery } from "./SettingsQuery";
import { DesktopUsageCache } from "./UsageCache";

type DesktopSurfaceOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  environment?: EnvironmentSource;
  credentialStore: CredentialStore;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
};

export class DesktopSurface {
  private readonly logger: NileLogger;
  private readonly usage: DesktopUsageCache;
  private readonly connections = new DesktopConnectionPresenter();
  private readonly history = new DesktopHistoryStateQuery(this.connections);
  private readonly menubar: DesktopMenubarStateQuery;
  private readonly settings: DesktopSettingsStateQuery;
  private menubarUsageRefresh: Promise<void> | null = null;

  constructor(
    private readonly options: DesktopSurfaceOptions,
  ) {
    this.logger = options.logger ?? NileLogger.createDefault({ module: "desktop" });
    this.usage = new DesktopUsageCache(this.logger);
    this.menubar = new DesktopMenubarStateQuery(this.connections, this.usage);
    this.settings = new DesktopSettingsStateQuery({
      resolveDesktopAgentHome: (agentId) => this.resolveDesktopAgentHome(agentId),
    }, this.connections, this.usage);
  }

  async getMenubarState(): Promise<MenubarState> {
    const state = await this.withSession("menubar-state", async (session) => await this.menubar.read(session));

    if (state.agents.some((agent) => agent.currentConnection && agent.currentUsage === null)) {
      void this.refreshMenubarUsage();
    }

    return state;
  }

  async refreshMenubarUsage(): Promise<void> {
    if (this.menubarUsageRefresh) {
      return await this.menubarUsageRefresh;
    }

    this.menubarUsageRefresh = this.withSession("menubar-usage-refresh", async (session) => {
      await this.menubar.refreshUsage(session);
    }).finally(() => {
      this.menubarUsageRefresh = null;
    });

    return await this.menubarUsageRefresh;
  }

  async getSettingsState(): Promise<SettingsState> {
    return await this.withSession("settings-state", async (session) => await this.settings.read(session));
  }

  async importDetectedSetups(scanIds: AgentId[]) {
    return await this.withSession("import-detected-setups", async (session) =>
      session.importDetectedSetups({
        selections: scanIds.map((scanId) => ({ scanId })),
      }),
    );
  }

  async getHistoryState(): Promise<HistoryState> {
    return await this.withSession("history-state", async (session) => this.history.read(session));
  }

  async rollbackLatestMutation(agentId: AgentId) {
    return await this.withSession("rollback-latest", async (session) => session.rollbackLatestMutation(agentId));
  }

  async switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection> {
    return await this.withSession("apply-selection", async (session) => {
      this.logger.info("desktop.switch.start", {
        agentId,
        connectionId,
      });

      const previousSavedConnections = session.listSavedConnections();
      const previousStatus = session.getAgentStatus(agentId);
      const previousConnectionId = this.connections.resolveEffectiveCurrentConnection(
        previousStatus,
        previousSavedConnections,
      )?.id ?? null;
      const applied = session.useConnection(agentId, connectionId);
      const savedConnections = session.listSavedConnections();
      const status = session.getAgentStatus(agentId);
      const currentConnection = this.connections.resolveCurrentConnection(
        status.currentConnection,
        savedConnections,
      );
      if (!currentConnection) {
        throw new Error(`Current connection missing after apply for ${applied.endpointId}/${applied.accessId}`);
      }
      await this.usage.refreshByConnectionId(session, [previousConnectionId, currentConnection.id], { force: true });
      return currentConnection;
    });
  }

  private resolveDesktopAgentHome(agentId: AgentId): string {
    return this.options.agentHomes?.[agentId] ?? resolveAgentHome(agentId);
  }

  private openSession(scope: string): NileSession {
    return NileSession.open({
      databasePath: this.options.databasePath,
      agentHomes: this.options.agentHomes,
      environment: this.options.environment,
      credentialStore: this.options.credentialStore,
      secureSnapshotStore: this.options.secureSnapshotStore,
      logger: this.logger.child({ scope }),
    });
  }

  private async withSession<TResult>(scope: string, work: (session: NileSession) => Promise<TResult>): Promise<TResult> {
    const session = this.openSession(scope);
    try {
      return await work(session);
    } catch (error) {
      throw this.normalizeDesktopStateError(error);
    } finally {
      session.close();
    }
  }

  private normalizeDesktopStateError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("no such column:")) {
      return new Error(
        "Local Nile state schema is stale. Reset Nile state from Settings or run `nile reset --yes`, then restart Nile.",
      );
    }
    return error instanceof Error ? error : new Error(message);
  }
}

export function createDefaultDesktopSurface(): DesktopSurface {
  return new DesktopSurface({
    databasePath: join(homedir(), ".nile-switcher", "switcher.sqlite"),
    agentHomes: {
      codex: resolveAgentHome("codex"),
    },
    credentialStore: new KeychainCredentialStore(),
  });
}
