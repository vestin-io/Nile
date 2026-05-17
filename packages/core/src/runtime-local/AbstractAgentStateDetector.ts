import type { AgentLiveStateValidity, MatchedAgentConnection } from "../models/agent";
import type { LiveSetupMatcher } from "../actions/live-setup/Matcher";
import type { AgentSelectionRecord } from "../models/selection/Types";
import type { NileLogger } from "../services/NileLogger";

type OwnedContext = {
  close(): void;
};

/** Shared live-state shape for template-method reconciliation. */
export type ReconcilableDetectedState = {
  validity: AgentLiveStateValidity;
  matchedConnection: MatchedAgentConnection | null;
};

/**
 * Template method: `detect()` is agent-specific; read-only inspection and explicit reconciliation are shared.
 */
export abstract class AbstractAgentStateDetector<TState extends ReconcilableDetectedState> {
  constructor(
    protected readonly matcher: LiveSetupMatcher,
    protected readonly logger: NileLogger,
    private readonly ownedContext: OwnedContext | null = null,
  ) {}

  abstract detect(): TState;

  detectAgentSelection(): {
    detectedState: TState;
    agentSelection: AgentSelectionRecord | null;
  } {
    return {
      detectedState: this.detect(),
      agentSelection: this.matcher.getCurrentSelection(),
    };
  }

  reconcileAgentSelection(): AgentSelectionRecord | null {
    const detection = this.detectAgentSelection();

    if (
      detection.detectedState.validity !== "valid_matched" ||
      !detection.detectedState.matchedConnection
    ) {
      return detection.agentSelection;
    }

    if (
      this.matcher.matchesCurrentSelection(
        detection.agentSelection,
        detection.detectedState.matchedConnection,
      )
    ) {
      return detection.agentSelection;
    }

    return this.matcher.reconcileMatchedSelection(detection.detectedState.matchedConnection);
  }

  close(): void {
    this.ownedContext?.close();
  }
}
