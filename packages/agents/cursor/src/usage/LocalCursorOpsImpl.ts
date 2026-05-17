import type { AccessRecord, AccessRegistry } from "@nile/core/models/access";
import type { EndpointRecord, EndpointRegistry } from "@nile/core/models/endpoint";
import { EndpointShape } from "@nile/core/models/endpoint";
import type { CredentialStore } from "@nile/core/services/credential/Store";
import type { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";
import type { ConnectionUsageResult } from "@nile/core/actions/usage";
import type { AuthMode } from "@nile/core/models/access/AuthMode";
import type {
  LocalConnectionSupport,
  LocalConnectionSupportFactory,
  LocalConnectionUsageReader,
} from "@nile/core/runtime-local/LocalConnectionSupport";
import { CursorUsageBindingRegistry } from "./BindingRegistry";
import { CursorUsageSnapshotStore } from "./SnapshotStore";
import { CursorUsageBinder } from "./Binder";
import { CursorUsageAutoBinder } from "./AutoBinder";
import { CursorUsageReader } from "./Reader";

class CursorLocalConnectionSupport implements LocalConnectionSupport {
  private readonly snapshotStore: CursorUsageSnapshotStore;
  private readonly bindingRegistry: CursorUsageBindingRegistry;

  constructor(
    database: SqliteDatabase,
    credentialStore: CredentialStore,
    _endpointRegistry: EndpointRegistry,
    _accessRegistry: AccessRegistry,
  ) {
    this.bindingRegistry = CursorUsageBindingRegistry.fromDatabase(database, credentialStore);
    this.snapshotStore = CursorUsageSnapshotStore.fromDatabase(database);
  }

  clearArtifacts(connectionId: string): void {
    this.bindingRegistry.clear(connectionId);
    this.snapshotStore.remove(connectionId);
  }

  createUsageReaders(): readonly LocalConnectionUsageReader[] {
    return [new CursorConnectionUsageReader(
      new CursorUsageReader(this.bindingRegistry, this.snapshotStore),
    )];
  }
}

class CursorConnectionUsageReader implements LocalConnectionUsageReader {
  readonly authMode: AuthMode = "cursor_session";

  constructor(private readonly reader: CursorUsageReader) {}

  async read(
    access: AccessRecord,
    endpoint: EndpointRecord,
    _accessRegistry: AccessRegistry,
  ): Promise<ConnectionUsageResult | null> {
    if (!endpoint.protocols.cursor) {
      return null;
    }

    return await this.reader.read({
      connectionId: access.id,
      connectionLabel: access.label,
      endpointLabel: endpoint.label,
      access,
    });
  }
}

export class CursorLocalConnectionSupportFactory implements LocalConnectionSupportFactory {
  readonly credentialRefQuery =
    "SELECT credential_source_ref AS value FROM cursor_usage_bindings";

  create(
    database: SqliteDatabase,
    credentialStore: CredentialStore,
    endpointRegistry: EndpointRegistry,
    accessRegistry: AccessRegistry,
  ): LocalConnectionSupport {
    return new CursorLocalConnectionSupport(database, credentialStore, endpointRegistry, accessRegistry);
  }
}

export const CURSOR_LOCAL_CONNECTION_SUPPORT_FACTORY = new CursorLocalConnectionSupportFactory();
