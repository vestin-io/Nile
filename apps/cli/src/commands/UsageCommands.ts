import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";
import type { CursorUsageAutoBindResult } from "@nile/core/application/local";
import type { ConnectionUsageResult } from "@nile/core/actions/usage";
import type { BindCursorUsageResult } from "@nile/core/actions/usage/cursor";

import type { ResolvedCliOptions } from "../types";
import { SessionRunner } from "./SessionRunner";

export class UsageCommands {
  private static readonly USAGE_READ_CONCURRENCY = 4;
  private readonly sessions: SessionRunner;

  constructor(
    credentialStore: CredentialStore,
    logger: NileLogger,
  ) {
    this.sessions = new SessionRunner(credentialStore, logger, CursorUsageSessionSourceProbe.createDefault());
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
    return this.sessions.run(
      options,
      "bind-cursor-usage",
      (session) => session.bindCursorUsage(connectionId, sessionToken),
    );
  }

  async autoBindCursorUsage(
    options: ResolvedCliOptions,
    connectionId: string,
  ): Promise<CursorUsageAutoBindResult> {
    return this.sessions.run(
      options,
      "auto-bind-cursor-usage",
      (session) => session.autoBindCursorUsage(connectionId),
    );
  }
}
