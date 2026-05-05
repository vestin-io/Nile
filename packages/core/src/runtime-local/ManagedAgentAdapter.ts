import type {
  AgentAdapter,
  AgentDetectionResult,
  ApplyAgentSelectionResult,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "./AgentAdapterTypes";
import type { AgentCapabilitySupport } from "./AgentAdapterTypes";
import type { AgentId } from "../models/agent/Types";

type Closable = { close(): void };

type DetectorOperation = Closable & {
  detectAgentSelection(): AgentDetectionResult;
};

type ApplyOperation = Closable & {
  apply(connectionId: string): ApplyAgentSelectionResult;
};

type ImportOperation = Closable & {
  importCurrent(): ImportCurrentConnectionResult;
};

export abstract class ManagedAgentAdapter implements AgentAdapter {
  abstract readonly agentId: AgentId;
  abstract readonly rollbackSupport: AgentCapabilitySupport;

  detectAgentSelection(): AgentDetectionResult {
    const detector = this.openDetector();
    try {
      return detector.detectAgentSelection();
    } finally {
      detector.close();
    }
  }

  applySelection(connectionId: string): ApplyAgentSelectionResult {
    const applySelection = this.openApplySelection();
    try {
      return applySelection.apply(connectionId);
    } finally {
      applySelection.close();
    }
  }

  importCurrentConnection(): ImportCurrentConnectionResult {
    const importer = this.openImporter();
    try {
      return importer.importCurrent();
    } finally {
      importer.close();
    }
  }

  abstract rollbackLatestMutation(): RollbackLatestAgentResult;

  protected abstract openDetector(): DetectorOperation;
  protected abstract openApplySelection(): ApplyOperation;
  protected abstract openImporter(): ImportOperation;
}
