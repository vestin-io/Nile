import { NileSession, runWithSession, runWithSessionAsync } from "@nile/builtins/runtime";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";

import type { ResolvedCliOptions } from "../types";

export class SessionRunner {
  constructor(
    private readonly credentialStore: CredentialStore,
    private readonly logger: NileLogger,
  ) {}

  run<TResult>(
    options: ResolvedCliOptions,
    scope: string,
    work: (session: NileSession) => TResult,
  ): TResult {
    return runWithSession(() => this.openSession(options, scope), work);
  }

  async runAsync<TResult>(
    options: ResolvedCliOptions,
    scope: string,
    work: (session: NileSession) => Promise<TResult>,
  ): Promise<TResult> {
    return await runWithSessionAsync(() => this.openSession(options, scope), work);
  }

  private openSession(options: ResolvedCliOptions, scope: string): NileSession {
    return NileSession.open({
      databasePath: options.databasePath,
      credentialStore: this.credentialStore,
      environment: options.environment,
      secureSnapshotStore: options.secureSnapshotStore,
      logger: this.logger.child({ scope }),
      agentHomes: options.agentHomes,
    });
  }
}
