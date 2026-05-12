import {
  type AgentHomes,
  resolveAgentHome,
  type AgentId,
} from "@nile/core/models/agent";
import { NileSession } from "@nile/core/runtime-local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { type CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { SecureSnapshotStore } from "@nile/core/services/history";
import {
  type HistoryState,
  type MenubarState,
  type SettingsState,
} from "./Types";
import { DesktopConnectionPresenter } from "./ConnectionPresenter";
import { DesktopStateErrorNormalizer } from "./ErrorNormalizer";
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

type DesktopSettingsStateOptions = {
  refreshUsage?: boolean;
};

export class DesktopSurface {
  private readonly logger: NileLogger;
  private readonly usage: DesktopUsageCache;
  private readonly connections = new DesktopConnectionPresenter();
  private readonly errors = new DesktopStateErrorNormalizer();
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

  async getSettingsState(options: DesktopSettingsStateOptions = {}): Promise<SettingsState> {
    return await this.withSession("settings-state", async (session) => await this.settings.read(session, options));
  }

  async getHistoryState(): Promise<HistoryState> {
    return await this.withSession("history-state", async (session) => this.history.read(session));
  }

  async rollbackLatestMutation(agentId: AgentId) {
    return await this.withSession("rollback-latest", async (session) => session.rollbackLatestMutation(agentId));
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
      throw this.errors.normalize(error);
    } finally {
      session.close();
    }
  }
}
