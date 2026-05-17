import type { AccessRecord, AccessRegistry, AuthMode } from "../../models/access";
import type { EndpointRecord } from "../../models/endpoint";
import { IndexedRegistry } from "../../services/IndexedRegistry";
import type { ConnectionUsageResult } from "./Result";

export interface ConnectionUsageReader {
  readonly authMode: AuthMode;
  read(
    access: AccessRecord,
    endpoint: EndpointRecord,
    accessRegistry: AccessRegistry,
  ): Promise<ConnectionUsageResult | null>;
}

export class ConnectionUsageReaderRegistry {
  private readers: readonly ConnectionUsageReader[];

  constructor(readers: readonly ConnectionUsageReader[]) {
    this.readers = readers;
  }

  register(readers: readonly ConnectionUsageReader[]): void {
    this.readers = readers;
  }

  create(extraReaders: readonly ConnectionUsageReader[] = []): ResolvedConnectionUsageReaderRegistry {
    return new ResolvedConnectionUsageReaderRegistry([...this.readers, ...extraReaders]);
  }
}

class ResolvedConnectionUsageReaderRegistry {
  private readonly registry: IndexedRegistry<AuthMode, ConnectionUsageReader>;

  constructor(readers: readonly ConnectionUsageReader[]) {
    this.registry = new IndexedRegistry(
      readers,
      (reader) => reader.authMode,
      (authMode) => `Unsupported usage auth mode: ${authMode}`,
    );
  }

  read(authMode: AuthMode): ConnectionUsageReader {
    return this.registry.read(authMode);
  }
}

export const CONNECTION_USAGE_READER_REGISTRY = new ConnectionUsageReaderRegistry([]);
