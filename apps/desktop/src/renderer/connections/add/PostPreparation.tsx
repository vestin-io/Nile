import { CircleCheckBig } from "lucide-react";

import type { AgentId } from "@nile/core/models/agent/types";

import type { Translator } from "../../shared/I18n";
import { Badge } from "../../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  ConnectionCapabilityField,
  FormField,
} from "../ConnectionFormParts";
import type { Definition } from "../../shared/Definitions";

type AddConnectionPostPreparationProps = {
  apiKey: string;
  apiKeySource: "direct" | "env_key";
  authJsonPath: string;
  configurableAgents: AgentId[];
  displayedEnabledAgents: AgentId[];
  endpointUrl: string;
  envKey: string;
  gatewayProbeError: string | null;
  isChoosingAuthJsonPath: boolean;
  isPreparedSessionFlow: boolean;
  isProbingSupport: boolean;
  isSessionStructureLocked: boolean;
  selectedDefinition: Definition | null;
  showDetectionState: boolean;
  shouldProbeEnabledAgents: boolean;
  shouldShowAuthJsonPath: boolean;
  shouldShowEnabledAgents: boolean;
  suggestedAgents: AgentId[];
  t: Translator;
  onApiKeyChange(value: string): void;
  onAuthJsonChoose(): void;
  onEnabledAgentsChange(nextAgents: AgentId[]): void;
  onEndpointUrlChange(value: string): void;
  onEnvKeyChange(value: string): void;
};

export function AddConnectionPostPreparation({
  apiKey,
  apiKeySource,
  authJsonPath,
  configurableAgents,
  displayedEnabledAgents,
  endpointUrl,
  envKey,
  gatewayProbeError,
  isChoosingAuthJsonPath,
  isPreparedSessionFlow,
  isProbingSupport,
  isSessionStructureLocked,
  selectedDefinition,
  showDetectionState,
  shouldProbeEnabledAgents,
  shouldShowAuthJsonPath,
  shouldShowEnabledAgents,
  suggestedAgents,
  t,
  onApiKeyChange,
  onAuthJsonChoose,
  onEnabledAgentsChange,
  onEndpointUrlChange,
  onEnvKeyChange,
}: AddConnectionPostPreparationProps) {
  return (
    <>
      {gatewayProbeError ? (
        <Alert>
          <AlertTitle>{t("addConnection.gatewayDetectionFailedTitle")}</AlertTitle>
          <AlertDescription>
            {t("addConnection.gatewayDetectionFailedDescription", { message: gatewayProbeError })}
          </AlertDescription>
        </Alert>
      ) : null}

      {shouldShowAuthJsonPath ? (
        <FormField label={t("addConnection.authJsonPath")}>
          <div className="flex gap-2">
            <Input
              type="text"
              readOnly
              value={authJsonPath}
              placeholder={t("addConnection.authJsonPathPlaceholder")}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={isChoosingAuthJsonPath || isSessionStructureLocked}
              onClick={onAuthJsonChoose}
            >
              {isChoosingAuthJsonPath ? t("common.loading") : t("common.chooseFile")}
            </Button>
          </div>
        </FormField>
      ) : null}

      {isPreparedSessionFlow ? (
        <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-100 via-white to-teal-50 p-5 text-emerald-950 shadow-sm ring-1 ring-emerald-200/80 dark:border-emerald-700/80 dark:from-emerald-950/70 dark:via-emerald-950/30 dark:to-teal-950/30 dark:text-emerald-50 dark:ring-emerald-800/80">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm dark:bg-emerald-500">
              <CircleCheckBig className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold tracking-tight">
                  {t("addConnection.sessionReadyTitle")}
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-white/85 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100"
                >
                  {t("addConnection.sessionReadyAction", {
                    action: t("addConnection.saveConnection"),
                  })}
                </Badge>
              </div>
              <div className="mt-2 text-sm leading-6 text-emerald-900/90 dark:text-emerald-100/90">
                {t("addConnection.sessionReadyDescription")}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {selectedDefinition?.requiresEndpointUrl ? (
          <FormField label={t("dialog.endpointUrl")}>
            <Input
              type="url"
              value={endpointUrl}
              onChange={(event) => onEndpointUrlChange(event.target.value)}
              placeholder={t("dialog.endpointUrlPlaceholder")}
            />
          </FormField>
        ) : null}

        {apiKeySource === "env_key" ? (
          <FormField label={t("dialog.envKey")}>
            <Input
              type="text"
              value={envKey}
              onChange={(event) => onEnvKeyChange(event.target.value)}
              placeholder={t("dialog.envKeyPlaceholder")}
            />
          </FormField>
        ) : (
          <FormField label={t("dialog.apiKey")}>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder={t("dialog.apiKeyPlaceholder")}
            />
          </FormField>
        )}
      </div>

      <ConnectionCapabilityField
        configurableAgents={configurableAgents}
        editable={shouldShowEnabledAgents}
        enabledAgents={displayedEnabledAgents}
        isProbingSupport={shouldProbeEnabledAgents && isProbingSupport}
        showDetectionState={showDetectionState}
        suggestedAgents={suggestedAgents}
        t={t}
        onEnabledAgentsChange={shouldShowEnabledAgents ? onEnabledAgentsChange : undefined}
      />
    </>
  );
}
