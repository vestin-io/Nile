import type { AccessRegistry } from "../../models/access";
import type {
  EndpointFamily,
  EndpointProfile,
  EndpointProtocols,
  EndpointRegistry,
} from "../../models/endpoint";
import { EndpointShape } from "../../models/endpoint";
import { AccessNotFoundError } from "../../models/access";
import type { ConnectionUsageResult } from "./Result";
import { CursorUsageBindingRegistry, CursorUsageSnapshotStore } from "./cursor";
import { ConnectionUsageReaderRegistry } from "./ReaderRegistry";

export class Usage {
  private readonly readerRegistry: ConnectionUsageReaderRegistry;

  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    cursorUsageBindingRegistry: CursorUsageBindingRegistry,
    cursorUsageSnapshotStore: CursorUsageSnapshotStore,
  ) {
    this.readerRegistry = new ConnectionUsageReaderRegistry(
      this.accessRegistry,
      cursorUsageBindingRegistry,
      cursorUsageSnapshotStore,
    );
  }

  async get(connectionId: string): Promise<ConnectionUsageResult> {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new AccessNotFoundError(connectionId);
    }

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      return {
        connectionId: access.id,
        connectionLabel: access.label,
        endpointFamily: "gateway",
        endpointLabel: access.endpointId,
        status: "error",
        source: "remote_api",
        message: "Connection metadata is incomplete",
        windows: [],
      };
    }

    const supported = await this.readerRegistry.read(access, endpoint);
    if (supported) {
      return supported;
    }

    return {
      connectionId: access.id,
      connectionLabel: access.label,
      endpointFamily: this.resolveEndpointFamily(endpoint),
      endpointLabel: endpoint.label,
      status: "unsupported",
      source: "remote_api",
      message: `Usage is unavailable for ${this.resolveEndpointFamily(endpoint)}/${access.authMode} connections. This connection can still be selected for supported agents.`,
      windows: [],
    };
  }

  private resolveEndpointFamily(endpoint: {
    profile?: EndpointProfile;
    protocols: EndpointProtocols;
  }): EndpointFamily {
    return EndpointShape.readFamily(endpoint);
  }
}
