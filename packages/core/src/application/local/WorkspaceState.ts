import { Usage } from "../../actions/usage/Usage";
import { AccessRegistry } from "../../models/access";
import { AgentConnectionSettings } from "../../models/agent-settings";
import { AGENT_MODULE_REGISTRY } from "../../models/agent/module/Registry";
import { CONNECTION_RUNTIME_REGISTRY, type ConnectionCreatorContract } from "../../models/connection/Runtime";
import { SavedConnections } from "../../models/connection/SavedConnections";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import type { CredentialStore } from "../../services/credential/Store";
import {
  LocalCredentialSourceFactory,
  type CredentialSourceFactory,
} from "../../services/credential/Factory";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import type { LocalConnectionSupport } from "../../runtime-local/LocalConnectionSupport";

export class LocalWorkspaceState {
  private localConnectionSupports: readonly LocalConnectionSupport[] | null = null;

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

  createSavedConnections(agentSelection: AgentSelection): SavedConnections {
    return new SavedConnections(
      this.database,
      this.endpointRegistry,
      this.accessRegistry,
      agentSelection,
      AgentConnectionSettings.fromDatabase(this.database),
    );
  }

  createConnectionCreator(): ConnectionCreatorContract {
    return CONNECTION_RUNTIME_REGISTRY.read().createCreator({
      endpointRegistry: this.endpointRegistry,
      accessRegistry: this.accessRegistry,
    });
  }

  createUsage(): Usage {
    return new Usage(
      this.endpointRegistry,
      this.accessRegistry,
      this.getLocalConnectionSupports().flatMap((support) => [...support.createUsageReaders()]),
    );
  }

  getEndpointRegistry(): EndpointRegistry {
    return this.endpointRegistry;
  }

  getAccessRegistry(): AccessRegistry {
    return this.accessRegistry;
  }

  clearConnectionArtifacts(connectionId: string): void {
    for (const support of this.getLocalConnectionSupports()) {
      support.clearArtifacts(connectionId);
    }
  }

  private getLocalConnectionSupports(): readonly LocalConnectionSupport[] {
    if (this.localConnectionSupports !== null) {
      return this.localConnectionSupports;
    }

    this.localConnectionSupports = AGENT_MODULE_REGISTRY.list()
      .flatMap((module) => module.localConnectionSupportFactory ? [module.localConnectionSupportFactory] : [])
      .map((factory) => factory.create(
        this.database,
        this.credentialStore,
        this.endpointRegistry,
        this.accessRegistry,
      ));
    return this.localConnectionSupports;
  }

  close(): void {
    this.ownedDatabase?.close();
  }
}
