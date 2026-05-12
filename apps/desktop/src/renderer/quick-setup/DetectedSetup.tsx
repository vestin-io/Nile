import { useEffect, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import type { DesktopOnboardingItem } from "../../state/Types";
import type { Translator } from "../shared/I18n";
import { LOCAL_SETUP_PRESENTATION } from "../shared/LocalSetup";
import { readPendingSaveMessageKey, shouldKeepPendingSave, type SavePhase } from "./SaveState";
import { DetectedSetupAction } from "./DetectedSetupAction";
import { DetectedSetupContent } from "./DetectedSetupContent";

type DetectedSetupSectionProps = {
  agentId: AgentId;
  canConfigure: boolean;
  detectedSetup: DesktopOnboardingItem | null;
  t: Translator;
  onConfigure(agentId: AgentId): void;
  onSave(agentId: AgentId): Promise<void>;
};

export function DetectedSetupSection({
  agentId,
  canConfigure,
  detectedSetup,
  t,
  onConfigure,
  onSave,
}: DetectedSetupSectionProps) {
  const [savePhase, setSavePhase] = useState<SavePhase>("idle");
  const setupContent = LOCAL_SETUP_PRESENTATION.readSectionContent(agentId, detectedSetup, t);
  const keepPendingSave = shouldKeepPendingSave({
    confirmed: setupContent.isSaved,
    hasLocalSetup: setupContent.hasLocalSetup,
    phase: savePhase,
  });

  useEffect(() => {
    if (!keepPendingSave && savePhase !== "idle") {
      setSavePhase("idle");
    }
  }, [keepPendingSave, savePhase]);

  const pendingMessageKey = keepPendingSave ? readPendingSaveMessageKey(savePhase) : null;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <DetectedSetupContent
        badgeLabel={setupContent.badgeLabel}
        primary={setupContent.primary}
        secondary={setupContent.secondary}
      />
      <DetectedSetupAction
        actionKind={setupContent.actionKind}
        agentId={agentId}
        canConfigure={canConfigure}
        isPending={keepPendingSave}
        pendingMessageKey={pendingMessageKey}
        t={t}
        onConfigure={onConfigure}
        onSave={(targetAgentId) => {
          setSavePhase("saving");
          void onSave(targetAgentId).catch(() => {
            setSavePhase("idle");
          });
        }}
      />
    </div>
  );
}
