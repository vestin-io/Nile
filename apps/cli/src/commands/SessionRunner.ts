import { NileSession } from "@nile/core/runtime-local";
import type { CursorUsageSessionProbe } from "@nile/core/application/local";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";

import type { ResolvedCliOptions } from "../types";

export class SessionRunner {
  constructor(
    private readonly credentialStore: CredentialStore,
    private readonly logger: NileLogger,
    private readonly cursorUsageSessionProbe?: CursorUsageSessionProbe,
  ) {}

  run<TResult>(
    options: ResolvedCliOptions,
    scope: string,
    work: (session: NileSession) => TResult,
  ): TResult {
    const session = NileSession.open({
      databasePath: options.databasePath,
      credentialStore: this.credentialStore,
      environment: options.environment,
      secureSnapshotStore: options.secureSnapshotStore,
      logger: this.logger.child({ scope }),
      agentHomes: options.agentHomes,
      cursorUsageSessionProbe: this.cursorUsageSessionProbe,
    });
    try {
      return work(session);
    } finally {
      session.close();
    }
  }

  async runAsync<TResult>(
    options: ResolvedCliOptions,
    scope: string,
    work: (session: NileSession) => Promise<TResult>,
  ): Promise<TResult> {
    const session = NileSession.open({
      databasePath: options.databasePath,
      credentialStore: this.credentialStore,
      environment: options.environment,
      secureSnapshotStore: options.secureSnapshotStore,
      logger: this.logger.child({ scope }),
      agentHomes: options.agentHomes,
      cursorUsageSessionProbe: this.cursorUsageSessionProbe,
    });
    try {
      return await work(session);
    } finally {
      session.close();
    }
  }
}
