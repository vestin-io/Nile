import { useId } from "react";

import type { AgentId } from "@nile/core/models/agent";

import type { DesktopConnection } from "../../../state/Types";
import {
  hasConnectionApplyRequirement,
  readConnectionApplyRequirements,
} from "../../shared/ApplyRequirements";
import {
  useConnectionModelSelectionState,
} from "../../shared/ConnectionModels";
import type { Translator } from "../../shared/I18n";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { formatEnvBackedApiKeyRequirement } from "../../shared/AgentText";

type AgentConnectionModelDialogProps = {
  agentId: AgentId;
  agentLabel: string;
  connection: DesktopConnection | null;
  error: string | null;
  isSaving: boolean;
  modelId: string;
  mode?: "edit" | "switch";
  t: Translator;
  onClear(): Promise<void>;
  onModelIdChange(value: string): void;
  onOpenConnection?(): void;
  onOpenChange(open: boolean): void;
  onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void>;
};

const PREVIEW_MODEL_COUNT = 8;

export function AgentConnectionModelDialog({
  agentId,
  agentLabel,
  connection,
  error,
  isSaving,
  modelId,
  mode = "edit",
  t,
  onClear,
  onModelIdChange,
  onOpenConnection,
  onOpenChange,
  onSubmit,
}: AgentConnectionModelDialogProps) {
  const listId = useId();
  const {
    isLoading: isLoadingCatalog,
    selection: modelSelection,
  } = useConnectionModelSelectionState({
    connectionId: connection?.id ?? null,
    enabled: connection !== null,
    forceRefreshOnLoad: true,
    savedModelId: connection?.agentModelId,
    currentModelId: modelId,
    previewCount: PREVIEW_MODEL_COUNT,
  });
  const orderedModels = modelSelection.orderedModels;
  const pendingRequirements = connection
    ? readConnectionApplyRequirements(agentId, connection, modelId.trim() || null)
    : null;
  const requiresEnvBackedApiKey = hasConnectionApplyRequirement(pendingRequirements, "env-backed-api-key");

  return (
    <Dialog open={connection !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "switch" ? t("agents.model.switchTitle") : t("agents.model.title")}</DialogTitle>
          <DialogDescription>
            {connection
              ? t(
                mode === "switch" ? "agents.model.switchDescription" : "agents.model.description",
                { agent: agentLabel, connection: connection.label },
              )
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <Field label={t("common.selectedModel")}>
            <div className="space-y-2">
              <Input
                autoFocus
                autoComplete="off"
                list={orderedModels.length > 0 ? listId : undefined}
                placeholder={t("agents.model.placeholder")}
                value={modelId}
                onChange={(event) => onModelIdChange(event.target.value)}
              />
              {orderedModels.length > 0 ? (
                <>
                  <div className="text-xs text-muted-foreground">
                    {modelSelection.previewText}
                    {modelSelection.hasOverflowModels ? ", ..." : ""}
                  </div>
                  <datalist id={listId}>
                    {orderedModels.map((detectedModel) => (
                      <option key={detectedModel} value={detectedModel} />
                    ))}
                  </datalist>
                </>
              ) : modelSelection.message ? (
                <div className="text-xs text-muted-foreground">{modelSelection.message}</div>
              ) : isLoadingCatalog ? (
                <div className="text-xs text-muted-foreground">{t("common.loading")}</div>
              ) : null}
            </div>
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : requiresEnvBackedApiKey ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{formatEnvBackedApiKeyRequirement(agentLabel, t)}</span>
                {onOpenConnection ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenConnection();
                    }}
                  >
                    {t("common.editConnection")}
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={isSaving || !connection?.agentModelId}
              onClick={() => {
                void onClear();
              }}
            >
              {t("common.clear")}
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving || requiresEnvBackedApiKey}>
                {isSaving ? t("common.saving") : mode === "switch" ? t("agents.model.saveAndSwitch") : t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
