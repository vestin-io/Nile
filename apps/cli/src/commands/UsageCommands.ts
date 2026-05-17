import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type {
  BindCursorUsageResult,
  CursorUsageAutoBindResult,
  CursorUsageWorkspace,
} from "@nile/builtins/cursor-usage";
import { runWithCursorUsageWorkspace as runWithCursorUsageWorkspaceImpl } from "@nile/builtins/cursor-usage";
import type { ConnectionUsageResult } from "@nile/core/actions/usage";

import type { ResolvedCliOptions } from "../types";
import { CursorUsageSessionProbeFactory } from "./CursorUsageSessionProbeFactory";
import { SessionRunner } from "./SessionRunner";

export class UsageCommands {
  private static readonly USAGE_READ_CONCURRENCY = 4;
  private readonly sessions: SessionRunner;
  private readonly cursorUsageSessionProbeFactory = new CursorUsageSessionProbeFactory();

  constructor(
    private readonly credentialStore: CredentialStore,
    logger: NileLogger,
  ) {
    this.sessions = new SessionRunner(credentialStore, logger);
  }

  async getUsage(options: ResolvedCliOptions, connectionId: string): Promise<ConnectionUsageResult> {
    return this.sessions.runAsync(options, "connection-usage", (session) => session.getConnectionUsage(connectionId));
  }

  async getUsageMap(
    options: ResolvedCliOptions,
    connectionIds: string[],
  ): Promise<Map<string, ConnectionUsageResult>> {
    return this.sessions.runAsync(options, "connection-usage", async (session) => {
      const queue = [...connectionIds];
      const results = new Map<string, ConnectionUsageResult>();
      const workerCount = Math.min(UsageCommands.USAGE_READ_CONCURRENCY, queue.length);
      const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          const connectionId = queue.shift();
          if (!connectionId) {
            return;
          }
          results.set(connectionId, await session.getConnectionUsage(connectionId));
        }
      });
      await Promise.all(workers);
      return results;
    });
  }

  async bindCursorUsage(
    options: ResolvedCliOptions,
    connectionId: string,
    sessionToken: string,
  ): Promise<BindCursorUsageResult> {
    return this.runCursorUsageWorkspace(options, (workspace) => workspace.bind(connectionId, sessionToken));
  }

  async autoBindCursorUsage(
    options: ResolvedCliOptions,
    connectionId: string,
  ): Promise<CursorUsageAutoBindResult> {
    return this.runCursorUsageWorkspace(options, (workspace) => workspace.autoBind(connectionId));
  }

  private runCursorUsageWorkspace<TResult>(
    options: ResolvedCliOptions,
    work: (workspace: CursorUsageWorkspace) => TResult,
  ): TResult {
    return runWithCursorUsageWorkspaceImpl({
      databasePath: options.databasePath,
      credentialStore: this.credentialStore,
      sessionProbe: this.cursorUsageSessionProbeFactory.create(options),
    }, work);
  }
}
