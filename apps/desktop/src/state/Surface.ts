import {
  type AgentHomes,
  type AgentRuntimeCommandOverrides,
  resolveAgentHome,
  type AgentId,
} from "@nile/core/models/agent";
import { NileSession } from "@nile/builtins/runtime";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { type CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { SecureSnapshotStore } from "@nile/core/services/history";
import {
  type DesktopStatusEntryState,
  type HistoryState,
  type SettingsState,
} from "./Types";
import { DesktopConnectionListPresenter } from "./connection/List";
import { DesktopConnectionStatusPresenter } from "./connection/Status";
import { DesktopStateErrorNormalizer } from "./ErrorNormalizer";
import { DesktopHistoryStateQuery } from "./HistoryQuery";
import type { DesktopStateReadContext } from "./ReadContext";
import { DesktopSettingsStateQuery } from "./SettingsQuery";
import { DesktopStatusEntryStateQuery } from "./StatusEntryQuery";
import {
  DesktopUsageCache,
  type DesktopUsageRefreshMode,
  type DesktopUsageRefreshResult,
} from "./UsageCache";

type DesktopSurfaceOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides;
  environment?: EnvironmentSource;
  openExternalUrl?: (url: string) => Promise<void>;
  credentialStore: CredentialStore;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
};

type DesktopSettingsStateOptions = {
  allowInteractiveUnauthorizedCurrentSessionRecovery?: boolean;
  forceUsageRefresh?: boolean;
  refreshUsage?: boolean;
  usageRefreshMode?: DesktopUsageRefreshMode;
};

type DesktopRefreshStateOptions = {
  allowInteractiveUnauthorizedCurrentSessionRecovery?: boolean;
  forceSettingsUsageRefresh?: boolean;
  forceStatusEntryUsageRefresh?: boolean;
  refreshSettingsUsage?: boolean;
  refreshStatusEntryUsage?: boolean;
  usageRefreshMode?: DesktopUsageRefreshMode;
};

export type DesktopRefreshStateResult = {
  settingsState: SettingsState;
  statusEntryState: DesktopStatusEntryState;
};

export class DesktopSurface {
  private readonly logger: NileLogger;
  private readonly usage: DesktopUsageCache;
  private readonly lists = new DesktopConnectionListPresenter();
  private readonly status = new DesktopConnectionStatusPresenter();
  private readonly errors = new DesktopStateErrorNormalizer();
  private readonly history = new DesktopHistoryStateQuery();
  private readonly statusEntry: DesktopStatusEntryStateQuery;
  private readonly settings: DesktopSettingsStateQuery;
  private menubarUsageRefresh: Promise<void> | null = null;

  constructor(
    private readonly options: DesktopSurfaceOptions,
  ) {
    this.logger = options.logger ?? NileLogger.createDefault({ module: "desktop" });
    this.usage = new DesktopUsageCache(this.logger);
    this.statusEntry = new DesktopStatusEntryStateQuery(this.lists, this.status, this.usage);
    this.settings = new DesktopSettingsStateQuery({
      agentRuntimeCommandOverrides: options.agentRuntimeCommandOverrides,
      environment: options.environment ?? EnvironmentSource.empty(),
      resolveDesktopAgentHome: (agentId) => this.resolveDesktopAgentHome(agentId),
      resolveDefaultDesktopAgentHome: (agentId) => resolveAgentHome(agentId),
    }, this.lists, this.status, this.usage);
  }

  async getStatusEntryState(): Promise<DesktopStatusEntryState> {
    const state = await this.withSession("menubar-state", async (session) => await this.statusEntry.read(session));

    if (state.agents.some((agent) =>
      agent.currentConnection
      && agent.currentUsage === null
      && this.usage.canAutoRefresh(agent.currentConnection.id))) {
      void this.refreshStatusEntryUsage();
    }

    return state;
  }

  async refreshStatusEntryUsage(options?: { force?: boolean; mode?: DesktopUsageRefreshMode }): Promise<void> {
    if (this.menubarUsageRefresh) {
      return await this.menubarUsageRefresh;
    }

    this.menubarUsageRefresh = this.withSession("menubar-usage-refresh", async (session) => {
      await this.statusEntry.refreshUsage(session, options);
    }).finally(() => {
      this.menubarUsageRefresh = null;
    });

    return await this.menubarUsageRefresh;
  }

  async refreshUsageByConnectionId(
    connectionIds: Array<string | null>,
    options?: { force?: boolean; mode?: DesktopUsageRefreshMode },
  ): Promise<DesktopUsageRefreshResult> {
    return await this.withSession("usage-refresh", async (session) =>
      await this.usage.refreshByConnectionId(session, connectionIds, options));
  }

  async getSettingsState(options: DesktopSettingsStateOptions = {}): Promise<SettingsState> {
    return await this.withSession("settings-state", async (session) => await this.settings.read(session, options));
  }

  async refreshDesktopState(options: DesktopRefreshStateOptions = {}): Promise<DesktopRefreshStateResult> {
    return await this.withSession("desktop-refresh", async (session) => {
      const context = this.createReadContext(session);
      if (options.refreshStatusEntryUsage ?? true) {
        await this.statusEntry.refreshUsageFromContext(session, context, {
          ...(typeof options.forceStatusEntryUsageRefresh === "boolean"
            ? { force: options.forceStatusEntryUsageRefresh }
            : {}),
          mode: options.usageRefreshMode,
        });
      }
      const statusEntryState = this.statusEntry.readFromContext(context);
      const settingsState = await this.settings.readFromContext(session, context, {
        allowInteractiveUnauthorizedCurrentSessionRecovery:
          options.allowInteractiveUnauthorizedCurrentSessionRecovery,
        forceUsageRefresh: options.forceSettingsUsageRefresh,
        refreshUsage: options.refreshSettingsUsage,
        usageRefreshMode: options.usageRefreshMode,
      });
      return {
        statusEntryState,
        settingsState,
      };
    });
  }

  async primeStartupState(): Promise<{ statusEntryState: DesktopStatusEntryState; settingsState: SettingsState }> {
    return await this.withSession("startup-state", async (session) => {
      const context = this.createReadContext(session);
      const [statusEntryState, settingsState] = await Promise.all([
        this.statusEntry.readFromContext(context),
        this.settings.readFromContext(session, context, { refreshUsage: false }),
      ]);
      return {
        statusEntryState,
        settingsState,
      };
    });
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
      agentRuntimeCommandOverrides: this.options.agentRuntimeCommandOverrides,
      environment: this.options.environment,
      openExternalUrl: this.options.openExternalUrl,
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

  private createReadContext(session: NileSession): DesktopStateReadContext {
    return this.settings.createReadContext(session);
  }
}
