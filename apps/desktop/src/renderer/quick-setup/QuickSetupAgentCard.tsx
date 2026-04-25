import type { AgentId } from "@nile/core/models/agent/types";
import { Check } from "lucide-react";

import type { DesktopAgentState, DesktopOnboardingItem } from "../../DesktopTypes";
import { AgentCardHeader } from "../agents/AgentCardHeader";
import { DetectedSetupSection } from "./DetectedSetupSection";
import type { Translator } from "../shared/I18n";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type QuickSetupAgentCardProps = {
  agent: DesktopAgentState;
  canConfigure: boolean;
  detectedSetup: DesktopOnboardingItem | null;
  t: Translator;
  onConfirm(agentId: AgentId): Promise<void>;
  onConfigure(agentId: AgentId): void;
};

export function QuickSetupAgentCard({
  agent,
  canConfigure,
  detectedSetup,
  t,
  onConfirm,
  onConfigure,
}: QuickSetupAgentCardProps) {
  const confirmed = isConfirmed(agent, detectedSetup);

  return (
    <Card className="rounded-2xl">
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <AgentCardHeader agent={agent} />
        <DetectedSetupSection
          agentId={agent.agentId}
          canConfigure={canConfigure}
          confirmed={confirmed}
          detectedSetup={detectedSetup}
          t={t}
          onConfigure={onConfigure}
          onSave={onConfirm}
        />
      </div>
    </Card>
  );
}

function isConfirmed(
  agent: DesktopAgentState,
  detectedSetup: DesktopOnboardingItem | null,
): boolean {
  if (detectedSetup?.state === "already_saved") {
    return true;
  }

  return agent.currentConnectionState === "saved" && agent.syncState === "synced";
}
