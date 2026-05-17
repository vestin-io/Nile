import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import type { CredentialStore } from "@nile/core/services/credential";
import { SqliteDatabase } from "@nile/core/services/database";
import type { NileLogger } from "@nile/core/services/NileLogger";

import { CursorUsageAutoBinder } from "./AutoBinder";
import { CursorUsageBinder } from "./Binder";
import { CursorUsageBindingRegistry } from "./BindingRegistry";
import { CursorUsageConnectionFollowUp, type ConnectionChangeResult } from "./ConnectionFollowUp";
import type {
  BindCursorUsageResult,
  CursorUsageAutoBindResult,
  CursorUsageSessionProbe,
} from "./Contracts";
import { EmptyCursorUsageSessionProbe } from "./SessionProbe";
import { CursorUsageSnapshotStore } from "./SnapshotStore";

export type CursorUsageWorkspaceOptions = {
  databasePath: string;
  credentialStore: CredentialStore;
  sessionProbe?: CursorUsageSessionProbe;
  logger?: NileLogger;
};

export class CursorUsageWorkspace {
  static open(options: CursorUsageWorkspaceOptions): CursorUsageWorkspace {
    const database = SqliteDatabase.open(options.databasePath);
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(database, options.credentialStore);
    return new CursorUsageWorkspace(
      database,
      endpointRegistry,
      accessRegistry,
      CursorUsageBindingRegistry.fromDatabase(database, options.credentialStore),
      CursorUsageSnapshotStore.fromDatabase(database),
      options.sessionProbe ?? new EmptyCursorUsageSessionProbe(),
      options.logger,
      true,
    );
  }

  private readonly binder: CursorUsageBinder;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly bindingRegistry: CursorUsageBindingRegistry,
    private readonly snapshotStore: CursorUsageSnapshotStore,
    private readonly sessionProbe: CursorUsageSessionProbe,
    private readonly logger?: NileLogger,
    private readonly ownsDatabase: boolean = false,
  ) {
    this.binder = new CursorUsageBinder(this.endpointRegistry, this.accessRegistry, this.bindingRegistry);
  }

  bind(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.binder.bind(connectionId, sessionToken);
  }

  autoBind(connectionId: string): CursorUsageAutoBindResult {
    return new CursorUsageAutoBinder(
      this.endpointRegistry,
      this.accessRegistry,
      this.bindingRegistry,
      this.sessionProbe,
    ).autoBind(connectionId);
  }

  autoBindAllMissing(): CursorUsageAutoBindResult[] {
    return new CursorUsageAutoBinder(
      this.endpointRegistry,
      this.accessRegistry,
      this.bindingRegistry,
      this.sessionProbe,
    ).autoBindAllMissing();
  }

  clearArtifacts(connectionId: string): void {
    this.bindingRegistry.clear(connectionId);
    this.snapshotStore.remove(connectionId);
  }

  applyFollowUp<T extends ConnectionChangeResult>(result: T): T {
    return new CursorUsageConnectionFollowUp((connectionId) => this.autoBind(connectionId), this.logger)
      .applyAfterResolvedConnectionChange(result);
  }

  close(): void {
    this.accessRegistry.close();
    this.endpointRegistry.close();
    this.snapshotStore.close();
    if (this.ownsDatabase) {
      this.database.close();
    }
  }
}

export function runWithCursorUsageWorkspace<TResult>(
  options: CursorUsageWorkspaceOptions,
  work: (workspace: CursorUsageWorkspace) => TResult,
): TResult {
  const workspace = CursorUsageWorkspace.open(options);
  try {
    return work(workspace);
  } finally {
    workspace.close();
  }
}
