import type { AgentId } from "@nile/core/models/agent";

import type { DesktopAgentState, DesktopOnboardingItem } from "../../state/Types";
import { AgentCardHeader } from "../agents/AgentCardHeader";
import { LOCAL_SETUP_PRESENTATION } from "../shared/LocalSetup";
import { DetectedSetupSection } from "./DetectedSetup";
import type { Translator } from "../shared/I18n";
import { Card } from "../ui/card";

type QuickSetupAgentCardProps = {
  agent: DesktopAgentState;
  canConfigure: boolean;
  detectedSetup: DesktopOnboardingItem | null;
  optimisticallySaved?: boolean;
  t: Translator;
  onConfirm(agentId: AgentId): Promise<"requirements" | "saved">;
  onConfigure(agentId: AgentId): void;
};

export function QuickSetupAgentCard({
  agent,
  canConfigure,
  detectedSetup,
  optimisticallySaved = false,
  t,
  onConfirm,
  onConfigure,
}: QuickSetupAgentCardProps) {
  const visibleDetectedSetup = LOCAL_SETUP_PRESENTATION.shouldShowDetectedSetup(detectedSetup)
    ? detectedSetup
    : null;

  return (
    <Card className="rounded-2xl">
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <AgentCardHeader agent={agent} />
        {visibleDetectedSetup ? (
          <DetectedSetupSection
            agentId={agent.agentId}
            canConfigure={canConfigure}
            detectedSetup={visibleDetectedSetup}
            optimisticallySaved={optimisticallySaved}
            t={t}
            onConfigure={onConfigure}
            onSave={onConfirm}
          />
        ) : null}
      </div>
    </Card>
  );
}
