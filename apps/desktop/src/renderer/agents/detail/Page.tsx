import type { AgentId } from "@nile/core/models/agent/types";

import type { DesktopAgentState, DesktopHistoryEntry } from "../../../state/Types";
import { AgentHomeSection } from "./HomeSection";
import { AgentConnectionsSection } from "./ConnectionsSection";
import { AgentHistorySection } from "./HistorySection";
import type { Translator } from "../../shared/I18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";

export type AgentDetailTab = "connections" | "history" | "home";

type AgentDetailPageProps = {
  agent: DesktopAgentState;
  activeTab: AgentDetailTab;
  agentHomePath: string;
  defaultAgentHomePath: string;
  entries: DesktopHistoryEntry[];
  t: Translator;
  onBack(): void;
  onTabChange(tab: AgentDetailTab): void;
  onAgentHomeSave(agentId: AgentId, path: string | null): Promise<void>;
  onOpenAddPage(agentId: DesktopAgentState["agentId"]): void;
  onOpenConnection(connectionId: string): void;
  onRefresh(): Promise<void>;
  onRollback(agentId: DesktopAgentState["agentId"]): Promise<void>;
  onUpdateAgentConnectionModel(agentId: DesktopAgentState["agentId"], connectionId: string, modelId: string | null): Promise<void>;
  onSwitch(agentId: DesktopAgentState["agentId"], connectionId: string): Promise<void>;
};

export function AgentDetailPage({
  agent,
  activeTab,
  agentHomePath,
  defaultAgentHomePath,
  entries,
  t,
  onBack,
  onTabChange,
  onAgentHomeSave,
  onOpenAddPage,
  onOpenConnection,
  onRefresh,
  onRollback,
  onUpdateAgentConnectionModel,
  onSwitch,
}: AgentDetailPageProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onBack();
                }}
              >
                {t("page.agents")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{agent.agentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{agent.agentLabel}</h1>
        </div>
      </div>

      <Tabs value={activeTab} className="space-y-4" onValueChange={(value) => onTabChange(value as AgentDetailTab)}>
        <TabsList>
          <TabsTrigger value="connections">
            {t("page.connections")} ({agent.connections.length})
          </TabsTrigger>
          <TabsTrigger value="history">{t("agents.openHistory")}</TabsTrigger>
          <TabsTrigger value="home">{t("agents.home.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <AgentConnectionsSection
            agent={agent}
            t={t}
            onOpenAddPage={onOpenAddPage}
            onOpenConnection={onOpenConnection}
            onRefresh={onRefresh}
            onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
            onSwitch={onSwitch}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <AgentHistorySection
            agent={agent}
            entries={entries}
            t={t}
            onRollback={onRollback}
          />
        </TabsContent>

        <TabsContent value="home" className="space-y-4">
          <AgentHomeSection
            agentId={agent.agentId}
            currentPath={agentHomePath}
            defaultPath={defaultAgentHomePath}
            liveIssues={agent.liveIssues}
            t={t}
            onSave={onAgentHomeSave}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
