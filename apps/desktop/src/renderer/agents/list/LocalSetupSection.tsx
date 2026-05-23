import type { DesktopAgentState, DesktopOnboardingItem } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { DetectedSetupSection } from "../../quick-setup/DetectedSetup";

type AgentLocalSetupSectionProps = {
  agent: DesktopAgentState;
  canConfigure: boolean;
  detectedSetup: DesktopOnboardingItem;
  t: Translator;
  onConfigure(agentId: DesktopAgentState["agentId"]): void;
  onImport(agentId: DesktopAgentState["agentId"]): Promise<void>;
};

export function AgentLocalSetupSection({
  agent,
  canConfigure,
  detectedSetup,
  t,
  onConfigure,
  onImport,
}: AgentLocalSetupSectionProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("agents.localSetup")}
        </div>
      </div>
      <DetectedSetupSection
        agentId={agent.agentId}
        canConfigure={canConfigure}
        detectedSetup={detectedSetup}
        t={t}
        onConfigure={onConfigure}
        onSave={async (agentId) => {
          await onImport(agentId);
          return "saved";
        }}
      />
    </div>
  );
}
