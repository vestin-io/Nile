import { ImportDetectedSetups, ScanLocalSetups } from "../../actions/scan-local";
import { Status } from "../../actions/status/Status";
import { Usage } from "../../actions/usage/Usage";
import { CursorUsageBinder, CursorUsageBindingRegistry, CursorUsageSnapshotStore } from "../../actions/usage/cursor";
import { CursorUsageAutoBinder } from "./CursorUsageAutoBinder";
import type { CursorUsageSessionProbe } from "./CursorUsageSessionProbe";
import { AccessRegistry } from "../../models/access";
import type { AgentAdapterLookup } from "../../models/agent";
import { ConnectionCreator } from "../../models/connection/Creator";
import { SavedConnections } from "../../models/connection/SavedConnections";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import type { SharedAgentAdapterContext } from "./AgentAdapterContext";
import type { CredentialStore } from "../../services/credential/Store";
import {
  LocalCredentialSourceFactory,
  type CredentialSourceFactory,
} from "../../services/credential/Factory";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";

export type LocalAgentActions = {
  status: Status;
  scanLocal: ScanLocalSetups;
  importDetectedSetups: ImportDetectedSetups;
};

export class LocalWorkspaceState {
  private cursorUsageBindingRegistry: CursorUsageBindingRegistry | null = null;
  private cursorUsageSnapshotStore: CursorUsageSnapshotStore | null = null;

  static open(
    databasePath: string,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ): LocalWorkspaceState {
    const database = SqliteDatabase.open(databasePath);
    return LocalWorkspaceState.fromDatabase(database, credentialStore, credentialSourceFactory, databasePath);
  }

  static fromDatabase(
    database: SqliteDatabase,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
    databasePath?: string,
  ): LocalWorkspaceState {
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(database, credentialStore, credentialSourceFactory);

    return new LocalWorkspaceState(
      databasePath ?? "",
      database,
      credentialStore,
      endpointRegistry,
      accessRegistry,
      databasePath ? database : null,
    );
  }

  private constructor(
    readonly databasePath: string,
    readonly database: SqliteDatabase,
    private readonly credentialStore: CredentialStore,
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly ownedDatabase: SqliteDatabase | null,
  ) {}

  createSharedAgentAdapterContext(agentSelection: AgentSelection): SharedAgentAdapterContext {
    return {
      databasePath: this.databasePath,
      database: this.database,
      endpointRegistry: this.endpointRegistry,
      accessRegistry: this.accessRegistry,
      agentSelection,
    };
  }

  createSavedConnections(agentSelection: AgentSelection): SavedConnections {
    return new SavedConnections(
      this.database,
      this.endpointRegistry,
      this.accessRegistry,
      agentSelection,
    );
  }

  createConnectionCreator(): ConnectionCreator {
    return new ConnectionCreator(
      this.database,
      this.endpointRegistry,
      this.accessRegistry,
    );
  }

  createAgentActions(agentAdapterRegistry: AgentAdapterLookup): LocalAgentActions {
    const status = new Status(
      this.endpointRegistry,
      this.accessRegistry,
      agentAdapterRegistry,
    );
    const scanLocal = new ScanLocalSetups(
      status,
      this.accessRegistry,
      agentAdapterRegistry,
    );

    return {
      status,
      scanLocal,
      importDetectedSetups: new ImportDetectedSetups(
        scanLocal,
        agentAdapterRegistry,
      ),
    };
  }

  createUsage(): Usage {
    return new Usage(
      this.endpointRegistry,
      this.accessRegistry,
      this.getCursorUsageBindingRegistry(),
      this.getCursorUsageSnapshotStore(),
    );
  }

  createCursorUsageBinder(): CursorUsageBinder {
    return new CursorUsageBinder(
      this.endpointRegistry,
      this.accessRegistry,
      this.getCursorUsageBindingRegistry(),
    );
  }

  createCursorUsageAutoBinder(sessionProbe?: CursorUsageSessionProbe): CursorUsageAutoBinder {
    return new CursorUsageAutoBinder(
      this.endpointRegistry,
      this.accessRegistry,
      this.getCursorUsageBindingRegistry(),
      sessionProbe,
    );
  }

  clearCursorUsageArtifacts(connectionId: string): void {
    this.getCursorUsageBindingRegistry().clear(connectionId);
    this.getCursorUsageSnapshotStore().remove(connectionId);
  }

  private getCursorUsageBindingRegistry(): CursorUsageBindingRegistry {
    return (this.cursorUsageBindingRegistry ??= CursorUsageBindingRegistry.fromDatabase(
      this.database,
      this.credentialStore,
    ));
  }

  private getCursorUsageSnapshotStore(): CursorUsageSnapshotStore {
    return (this.cursorUsageSnapshotStore ??= CursorUsageSnapshotStore.fromDatabase(this.database));
  }

  close(): void {
    this.ownedDatabase?.close();
  }
}
