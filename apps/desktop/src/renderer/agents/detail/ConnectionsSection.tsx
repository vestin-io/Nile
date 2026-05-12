import type { DesktopAgentState } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { ConnectionsToolbar } from "../../connections/ConnectionsToolbar";
import { Alert, AlertDescription } from "../../ui/alert";
import { AgentConnectionModelDialog } from "./ModelEditor";
import { AgentConnectionsList } from "./ConnectionsList";
import { useAgentConnectionSwitchFlow } from "../useConnectionSwitchFlow";

type AgentConnectionsSectionProps = {
  agent: DesktopAgentState;
  t: Translator;
  onOpenAddPage(agentId: DesktopAgentState["agentId"]): void;
  onOpenConnection(connectionId: string): void;
  onRefresh(): Promise<void>;
  onUpdateAgentConnectionModel(agentId: DesktopAgentState["agentId"], connectionId: string, modelId: string | null): Promise<void>;
  onSwitch(agentId: DesktopAgentState["agentId"], connectionId: string): Promise<void>;
};

export function AgentConnectionsSection({
  agent,
  t,
  onOpenAddPage,
  onOpenConnection,
  onRefresh,
  onUpdateAgentConnectionModel,
  onSwitch,
}: AgentConnectionsSectionProps) {
  const flow = useAgentConnectionSwitchFlow({
    agent,
    t,
    highlightRecentSwitch: true,
    onSwitch,
    onUpdateAgentConnectionModel,
  });
  const editingConnection = flow.editingConnection;

  return (
    <div className="space-y-4">
      <ConnectionsToolbar
        t={t}
        showSearchAndFilter={false}
        onOpenAddPage={() => onOpenAddPage(agent.agentId)}
        onRefresh={onRefresh}
      />
      <AgentConnectionModelDialog
        agentId={agent.agentId}
        agentLabel={agent.agentLabel}
        connection={flow.editingConnection}
        error={flow.modelError}
        isSaving={flow.isSavingModel}
        modelId={flow.draftModelId}
        mode={flow.pendingSwitchAfterSaveConnectionId && flow.editingConnection?.id === flow.pendingSwitchAfterSaveConnectionId ? "switch" : "edit"}
        t={t}
        onClear={flow.clearModel}
        onModelIdChange={flow.setDraftModelId}
        onOpenConnection={editingConnection ? () => onOpenConnection(editingConnection.id) : undefined}
        onOpenChange={(open) => {
          if (!open) {
            flow.closeModelEditor();
          }
        }}
        onSubmit={flow.saveModel}
      />
      {agent.connections.length === 0 ? (
        <Alert>
          <AlertDescription>{t("agents.emptyConnections", { agent: agent.agentLabel })}</AlertDescription>
        </Alert>
      ) : (
        <AgentConnectionsList
          agent={agent}
          recentlyActivatedConnectionId={flow.recentlyActivatedConnectionId}
          switchingConnectionId={flow.switchingConnectionId}
          t={t}
          onOpenModelEditor={flow.openModelEditor}
          onOpenConnection={onOpenConnection}
          onSwitch={flow.switchConnection}
        />
      )}
    </div>
  );
}
