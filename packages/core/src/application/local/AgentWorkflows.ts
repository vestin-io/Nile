import { ImportDetectedSetups, ScanLocalSetups, Status } from "../../actions/local-state";
import type { AccessRegistry } from "../../models/access";
import type { AgentAdapterLookup } from "../../models/agent";
import type { EndpointRegistry } from "../../models/endpoint";

export class LocalAgentWorkflows {
  readonly status: Status;
  readonly scanLocal: ScanLocalSetups;
  readonly importDetectedSetups: ImportDetectedSetups;

  constructor(
    endpointRegistry: EndpointRegistry,
    accessRegistry: AccessRegistry,
    agentAdapterRegistry: AgentAdapterLookup,
  ) {
    this.status = new Status(
      endpointRegistry,
      accessRegistry,
      agentAdapterRegistry,
    );
    this.scanLocal = new ScanLocalSetups(
      this.status,
      accessRegistry,
      agentAdapterRegistry,
    );
    this.importDetectedSetups = new ImportDetectedSetups(
      this.scanLocal,
      agentAdapterRegistry,
    );
  }
}
