import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import type { DesktopConnection } from "../../state/Types";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import type { Translator } from "../shared/I18n";
import { formatAgentLabel } from "../shared/AgentSelection";
import {
  hasConnectionApplyRequirement,
  readConnectionApplyRequirements,
} from "../shared/ApplyRequirements";
import {
  useConnectionModelSelectionState,
} from "../shared/ConnectionModels";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type QuickSetupConnectionDialogProps = {
  agentId: AgentId | null;
  connections: DesktopConnection[];
  open: boolean;
  t: Translator;
  onAddNew(agentId: AgentId): void;
  onOpenModelSetup(agentId: AgentId): void;
  onOpenChange(open: boolean): void;
  onUpdateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): Promise<void>;
  onUseExistingConnection(agentId: AgentId, connectionId: string): Promise<void>;
};

export function QuickSetupConnectionDialog({
  agentId,
  connections,
  open,
  t,
  onAddNew,
  onOpenModelSetup,
  onOpenChange,
  onUpdateAgentConnectionModel,
  onUseExistingConnection,
}: QuickSetupConnectionDialogProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId],
  );

  if (!agentId) {
    return null;
  }

  const shouldShowModelField = Boolean(
    selectedConnection
    && (
      hasConnectionApplyRequirement(selectedConnection.applyRequirements, "selected-model")
      || selectedConnection.agentModelId?.trim()
    ),
  );
  const {
    isLoading: isLoadingModels,
    selection: modelSelection,
  } = useConnectionModelSelectionState({
    connectionId: shouldShowModelField ? selectedConnection?.id ?? null : null,
    enabled: open && shouldShowModelField,
    forceRefreshOnLoad: true,
    savedModelId: selectedConnection?.agentModelId,
    currentModelId: selectedModelId,
    previewCount: 8,
    showField: shouldShowModelField,
  });
  const modelOptions = modelSelection.modelOptions;
  const pendingRequirements = selectedConnection
    ? readConnectionApplyRequirements(agentId, selectedConnection, selectedModelId.trim() || null)
    : null;
  const needsInlineModelSelection = modelSelection.mode === "select";
  const requiresModel = hasConnectionApplyRequirement(pendingRequirements, "selected-model");
  const requiresEnvBackedApiKey = hasConnectionApplyRequirement(pendingRequirements, "env-backed-api-key");
  const canUseSelectedConnection = Boolean(
    selectedConnection
    && !pendingConnectionId
    && !isLoadingModels
    && !requiresEnvBackedApiKey
    && (!requiresModel || selectedModelId.trim()),
  );

  useEffect(() => {
    if (!open) {
      setSelectedConnectionId("");
      setSelectedModelId("");
      setActionError(null);
      return;
    }
    if (!selectedConnectionId || !connections.some((connection) => connection.id === selectedConnectionId)) {
      setSelectedConnectionId(connections[0]?.id ?? "");
    }
  }, [connections, open, selectedConnectionId]);

  useEffect(() => {
    if (!open || !selectedConnection) {
      return;
    }
    setActionError(null);
    if (!shouldShowModelField) {
      setSelectedModelId("");
      return;
    }
    setSelectedModelId(modelSelection.nextSelectedModelId);
  }, [modelSelection.nextSelectedModelId, open, selectedConnection, shouldShowModelField]);

  const agentLabel = formatAgentLabel(agentId);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPendingConnectionId(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-lg rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{t("quickSetup.connectionChoiceTitle", { agent: agentLabel })}</DialogTitle>
          <DialogDescription>{t("quickSetup.connectionChoiceDescription", { agent: agentLabel })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {actionError ? (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : requiresEnvBackedApiKey ? (
            <Alert variant="destructive">
              <AlertDescription>{t("agents.model.openclawEnvKeyRequired")}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t("quickSetup.useConnectionSection")}
            </div>
            <div className="space-y-3">
              <Select
                disabled={Boolean(pendingConnectionId)}
                value={selectedConnectionId}
                onValueChange={setSelectedConnectionId}
              >
                <SelectTrigger className="h-11 flex-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{connection.label}</span>
                        <span className="text-xs text-muted-foreground">{connection.endpointLabel}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {shouldShowModelField ? (
                <Field label={t("common.model")}>
                  {needsInlineModelSelection ? (
                    <Select
                      disabled={Boolean(pendingConnectionId) || isLoadingModels}
                      value={selectedModelId}
                      onValueChange={setSelectedModelId}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((modelId) => (
                          <SelectItem key={modelId} value={modelId}>
                            {modelId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2 rounded-xl border p-4">
                      <Input
                        autoComplete="off"
                        disabled={Boolean(pendingConnectionId) || isLoadingModels}
                        placeholder={t("agents.model.placeholder")}
                        value={selectedModelId}
                        onChange={(event) => setSelectedModelId(event.target.value)}
                      />
                      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>{isLoadingModels ? t("quickSetup.detectingModels") : (modelSelection.message ?? t("quickSetup.openclawModelUnavailable"))}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(pendingConnectionId)}
                          onClick={() => {
                            onOpenChange(false);
                            onOpenModelSetup(agentId);
                          }}
                        >
                          {t("common.setModel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </Field>
              ) : null}
            </div>

            <Button
              className="w-full rounded-xl"
              disabled={!canUseSelectedConnection}
              onClick={() => {
                if (!selectedConnection || pendingConnectionId) {
                  return;
                }
                setActionError(null);
                setPendingConnectionId(selectedConnection.id);
                void (async () => {
                if (shouldShowModelField) {
                  const nextModelId = selectedModelId.trim() || null;
                  await onUpdateAgentConnectionModel(agentId, selectedConnection.id, nextModelId);
                }
                  await onUseExistingConnection(agentId, selectedConnection.id);
                  onOpenChange(false);
                })()
                  .catch((error) => {
                    setActionError(error instanceof Error ? error.message : String(error));
                    setPendingConnectionId(null);
                  })
                  .finally(() => {
                    setPendingConnectionId(null);
                  });
              }}
            >
              {t("common.use")}
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>{t("common.or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t("common.addConnection")}
            </div>
            <Button
              className="w-full rounded-xl"
              disabled={Boolean(pendingConnectionId)}
              onClick={() => {
                onOpenChange(false);
                onAddNew(agentId);
              }}
            >
              {t("common.addConnection")}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={Boolean(pendingConnectionId)}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
