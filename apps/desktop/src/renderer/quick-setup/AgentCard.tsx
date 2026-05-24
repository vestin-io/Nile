import type { AgentId } from "@nile/core/models/agent/definitions";

import type { DesktopAgentState, DesktopOnboardingItem } from "../../state/Types";
import { AgentCardHeader } from "../agents/AgentCardHeader";
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
  return (
    <Card className="rounded-2xl">
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <AgentCardHeader agent={agent} />
        <DetectedSetupSection
          agentId={agent.agentId}
          canConfigure={canConfigure}
          detectedSetup={detectedSetup}
          optimisticallySaved={optimisticallySaved}
          t={t}
          onConfigure={onConfigure}
          onSave={onConfirm}
        />
      </div>
    </Card>
  );
}
