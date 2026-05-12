import { useMemo, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";
import { ArrowRight } from "lucide-react";

import {
  hasCompatibleConnections,
  readCompatibleConnections,
  type SettingsState,
} from "../shared/DesktopData";
import type { Translator } from "../shared/I18n";
import { nileMarkSvg } from "../shared/NileMark";
import { QuickSetupAgentCard } from "./AgentCard";
import { QuickSetupConnectionDialog } from "./ConnectionDialog";
import { QuickSetupGuide } from "./Guide";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";

type QuickSetupPageProps = {
  canConfigureAgent(agentId: AgentId): boolean;
  state: SettingsState;
  t: Translator;
  onConfigureAgent(agentId: AgentId): void;
  onConfirmAgent(agentId: AgentId): Promise<void>;
  onDone(): void;
  onOpenModelSetup(agentId: AgentId): void;
  onUpdateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): Promise<void>;
  onUseExistingConnection(agentId: AgentId, connectionId: string): Promise<void>;
};

export function QuickSetupPage({
  canConfigureAgent,
  state,
  t,
  onConfigureAgent,
  onConfirmAgent,
  onDone,
  onOpenModelSetup,
  onUpdateAgentConnectionModel,
  onUseExistingConnection,
}: QuickSetupPageProps) {
  const [configureAgentId, setConfigureAgentId] = useState<AgentId | null>(null);
  const detectedSetupsByAgent = new Map(
    state.detectedSetups.items.map((item) => [item.agentId, item]),
  );
  const existingCompatibleConnections = useMemo(
    () => {
      if (!configureAgentId) {
        return [];
      }
      return readCompatibleConnections(state, configureAgentId);
    },
    [configureAgentId, state],
  );

  return (
    <div className="space-y-6">
      <Empty className="gap-5">
        <EmptyHeader>
          <div
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center text-foreground/85 [&_svg]:h-12 [&_svg]:w-12"
            dangerouslySetInnerHTML={{ __html: nileMarkSvg }}
          />
          <EmptyTitle>{t("quickSetup.title")}</EmptyTitle>
          <EmptyDescription>{t("quickSetup.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div className="space-y-5">
        <QuickSetupGuide onboarding={state.detectedSetups} t={t} />

        <div className="space-y-4">
          {state.agents.map((agent) => (
            <QuickSetupAgentCard
              key={agent.agentId}
              agent={agent}
              canConfigure={canConfigureAgent(agent.agentId)}
              detectedSetup={detectedSetupsByAgent.get(agent.agentId) ?? null}
              t={t}
              onConfirm={onConfirmAgent}
              onConfigure={(agentId) => {
                if (!hasCompatibleConnections(state, agentId)) {
                  onConfigureAgent(agentId);
                  return;
                }
                setConfigureAgentId(agentId);
              }}
            />
          ))}
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={onDone}>
            {t("quickSetup.goToAgents")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <QuickSetupConnectionDialog
        agentId={configureAgentId}
        connections={existingCompatibleConnections}
        open={configureAgentId !== null}
        t={t}
        onAddNew={(agentId) => {
          onConfigureAgent(agentId);
        }}
        onOpenModelSetup={onOpenModelSetup}
        onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
        onOpenChange={(open) => {
          if (!open) {
            setConfigureAgentId(null);
          }
        }}
        onUseExistingConnection={onUseExistingConnection}
      />
    </div>
  );
}
