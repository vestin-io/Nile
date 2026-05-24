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

  async run(input: ImportDetectedSetupsInput): Promise<ImportDetectedSetupsResult> {
    const selections = this.uniqueSelections(input);
    const scan = this.scanner.run(selections);
    const results = await Promise.all(selections.map((agentId) => this.importSelection(agentId, input, scan.items)));
    return { results };
  }

  private uniqueSelections(input: ImportDetectedSetupsInput): AgentId[] {
    return Array.from(new Set(input.selections.map((selection) => selection.scanId)));
  }

  private async importSelection(
    agentId: AgentId,
    input: ImportDetectedSetupsInput,
    items: ReturnType<ScanLocalSetups["run"]>["items"],
  ): Promise<ImportDetectedSetupResult> {
    const item = items.find((candidate) => candidate.scanId === agentId);
    if (!item || !item.importable) {
      return {
        scanId: agentId,
        status: "skipped",
        message: "Local setup is no longer importable",
      };
    }

    try {
      const result = await this.agentAdapterRegistry.get(agentId).importCurrentConnection({
        credentialStorageBackend: input.credentialStorageBackend,
      });
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
