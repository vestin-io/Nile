import type { AgentAdapterLookup, AgentId } from "../../models/agent";
import {
  type ImportDetectedSetupsInput,
  type ImportDetectedSetupsResult,
  type ImportDetectedSetupResult,
} from "./Result";
import { ScanLocalSetups } from "./ScanLocalSetups";

export class ImportDetectedSetups {
  constructor(
    private readonly scanner: ScanLocalSetups,
    private readonly agentAdapterRegistry: AgentAdapterLookup,
  ) {}

  run(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult {
    const selections = this.uniqueSelections(input);
    const scan = this.scanner.run(selections);
    const results = selections.map((agentId) => this.importSelection(agentId, scan.items));
    return { results };
  }

  private uniqueSelections(input: ImportDetectedSetupsInput): AgentId[] {
    return Array.from(new Set(input.selections.map((selection) => selection.scanId)));
  }

  private importSelection(
    agentId: AgentId,
    items: ReturnType<ScanLocalSetups["run"]>["items"],
  ): ImportDetectedSetupResult {
    const item = items.find((candidate) => candidate.scanId === agentId);
    if (!item || !item.importable) {
      return {
        scanId: agentId,
        status: "skipped",
        message: "Local setup is no longer importable",
      };
    }

    try {
      const result = this.agentAdapterRegistry.get(agentId).importCurrentConnection();
      return {
        scanId: agentId,
        status: result.reused ? "reused" : "created",
        connectionId: result.id,
        connectionLabel: result.label,
      };
    } catch (error) {
      return {
        scanId: agentId,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
