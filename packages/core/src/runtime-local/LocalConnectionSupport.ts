import type { AccessRegistry } from "../models/access";
import type { ConnectionUsageReader } from "../actions/usage/Registry";
import type { CredentialStore } from "../services/credential/Store";
import type { SqliteDatabase } from "../services/database/SqliteDatabase";
import type { EndpointRegistry } from "../models/endpoint";

export interface LocalConnectionUsageReader extends ConnectionUsageReader {}

export interface LocalConnectionSupport {
  clearArtifacts(connectionId: string): void;
  createUsageReaders(): readonly LocalConnectionUsageReader[];
}

export interface LocalConnectionSupportFactory {
  readonly credentialRefQuery: string;
  create(
    database: SqliteDatabase,
    credentialStore: CredentialStore,
    endpointRegistry: EndpointRegistry,
    accessRegistry: AccessRegistry,
  ): LocalConnectionSupport;
}
