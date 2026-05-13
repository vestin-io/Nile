import { ImportDetectedSetups, ScanLocalSetups, SelectionSync, Status } from "../../actions/local-setup";
import { AgentSelection } from "../../models/selection/Selection";
import type { AccessRegistry } from "../../models/access";
import type { AgentAdapterLookup } from "../../models/agent";
import type { EndpointRegistry } from "../../models/endpoint";

export class LocalAgentWorkflows {
  readonly selectionSync: SelectionSync;
  readonly status: Status;
  readonly scanLocal: ScanLocalSetups;
  readonly importDetectedSetups: ImportDetectedSetups;

  constructor(
    endpointRegistry: EndpointRegistry,
    accessRegistry: AccessRegistry,
    agentSelection: AgentSelection,
    agentAdapterRegistry: AgentAdapterLookup,
  ) {
    this.selectionSync = new SelectionSync(
      agentSelection,
      agentAdapterRegistry,
    );
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
