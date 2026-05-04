import { ChevronLeft, CircleCheckBig, Waypoints } from "lucide-react";
import openAiSvg from "../../../node_modules/@lobehub/icons-static-svg/icons/openai.svg";
import azureAiSvg from "../../../node_modules/@lobehub/icons-static-svg/icons/azureai-color.svg";
import claudeSvg from "../../../node_modules/@lobehub/icons-static-svg/icons/claude.svg";

import type { AgentId } from "@nile/core/models/agent/types";

import {
  buildConnectionMethods,
  ConnectionCapabilityField,
  ConnectionMethodSelector,
  FormField,
  readSelectedMethodKey,
} from "./ConnectionFormParts";
import type { Translator } from "../shared/I18n";
import type { Definition } from "../shared/Support";
import type { LanguagePreference } from "../settings/Preferences";
import { authModeLabel, formatAgentLabel, readDefinitionKeywords } from "../shared/Support";
import { ProviderSummary } from "../providers/ProviderSummary";
import {
  useAddConnectionPageState,
  type AddConnectionPreparedSaveInput,
  type AddConnectionSubmitInput,
  type PreparedConnectionDraft,
} from "./useAddConnectionPageState";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { type ComboboxItem, Combobox } from "../ui/combobox";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";

type AddConnectionPageProps = {
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  language: LanguagePreference;
  targetAgentId: AgentId | null;
  t: Translator;
  onBack(): void;
  onPrepareDraft(input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft>;
  onSavePrepared(input: AddConnectionPreparedSaveInput): Promise<void>;
  onSubmit(input: AddConnectionSubmitInput): Promise<void>;
};

export function AddConnectionPage({
  defaultOpenAiAuthJsonPath,
  definitions,
  language,
  targetAgentId,
  t,
  onBack,
  onPrepareDraft,
  onSavePrepared,
  onSubmit,
}: AddConnectionPageProps) {
  const {
    actionError,
    chooseAuthJsonPath,
    configurableAgents,
    displayedEnabledAgents,
    enabledAgentsSelectionInvalid,
    formState,
    gatewayProbeError,
    gatewayPrepared,
    gatewayTrustConfirmed,
    hasResolvedApiKeyInput,
    isChoosingAuthJsonPath,
    isPreparedSessionFlow,
    isPreparingDraft,
    isPreparingGateway,
    isProbingSupport,
    isSubmitting,
    preparedDraft,
    prepareDraft,
    prepareGateway,
    requiresGatewayPreparation,
    requiresSessionPreparation,
    selectedDefinition,
    setApiKey,
    setApiKeySource,
    setAuthMode,
    setEnvKey,
    setEndpointUrl,
    setEnabledAgents,
    setGatewayTrustConfirmed,
    setPreset,
    setSessionSource,
    shouldProbeEnabledAgents,
    shouldShowAuthJsonPath,
    shouldShowEnabledAgents,
    showPostPreparationFields,
    submit,
    suggestedAgents,
  } = useAddConnectionPageState({
    defaultOpenAiAuthJsonPath,
    definitions,
    onPrepareDraft,
    onSavePrepared,
    onSubmit,
  });
  const presetItems = definitions.map((definition) => ({
    value: definition.preset,
    label: definition.label,
    description: definition.supportedAuthModes.map((mode) => authModeLabel(mode, t)).join(" · "),
    icon: readPresetIcon(definition.preset),
    keywords: readDefinitionKeywords(definition),
  })) satisfies ComboboxItem<Definition["preset"]>[];

  const connectionMethods = selectedDefinition ? buildConnectionMethods(selectedDefinition, t) : [];
  const selectedMethodKey = readSelectedMethodKey(
    formState.authMode,
    formState.sessionSource,
    formState.apiKeySource,
  );

  const submitLabel = (() => {
    if (isPreparedSessionFlow) {
      return t("addConnection.saveConnection");
    }

    if (formState.authMode === "openai_session" && formState.sessionSource === "current_codex") {
      return t("addConnection.importAuthJson");
    }

    if (requiresGatewayPreparation && !gatewayPrepared) {
      if (gatewayProbeError) {
        return t("common.addConnection");
      }
      return t("addConnection.detectCapability");
    }

    if (formState.authMode === "openai_session") {
      return t("addConnection.signInWithOpenAi");
    }

    if (formState.authMode === "claude_session") {
      return preparedDraft ? t("addConnection.saveConnection") : t("addConnection.signInWithClaude");
    }

    if (formState.authMode === "cursor_session") {
      return t("addConnection.useCurrentCursorSession");
    }

    return t("common.addConnection");
  })();
  const gatewayTrustTarget = describeGatewayTrustTarget(formState.endpointUrl);
  const isSessionStructureLocked = isPreparedSessionFlow;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          {targetAgentId ? (
            <Badge variant="secondary">{t("addConnection.forAgent", { agent: formatAgentLabel(targetAgentId) })}</Badge>
          ) : null}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("page.addConnection")}</h1>
          <p className="text-sm text-muted-foreground">
            {targetAgentId
              ? t("addConnection.descriptionForAgent", { agent: formatAgentLabel(targetAgentId) })
              : t("addConnection.description")}
          </p>
        </div>
      </div>

      <Card className="rounded-2xl">
        <div className="grid gap-6 p-6">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">{t("addConnection.choosePreset")}</h2>
              <p className="text-sm text-muted-foreground">{t("addConnection.choosePresetDescription")}</p>
            </div>
            <div className="grid gap-2">
              <Combobox
                disabled={isSessionStructureLocked}
                items={presetItems}
                value={formState.preset}
                placeholder={t("addConnection.presetPlaceholder")}
                searchPlaceholder={t("addConnection.searchPresetPlaceholder")}
                emptyLabel={t("addConnection.noPresetResults")}
                onValueChange={setPreset}
              />
            </div>
          </section>

          {selectedDefinition ? (
            <>
              <Separator />
              <ProviderSummary
                language={language}
                providerKey={selectedDefinition.preset}
                t={t}
              />
            </>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {connectionMethods.length > 1 ? (
              <FormField label={t("addConnection.chooseMethod")}>
                <ConnectionMethodSelector
                  disabled={isSessionStructureLocked}
                  methods={connectionMethods}
                  selectedKey={selectedMethodKey}
                  onSelect={(method) => {
                    setAuthMode(method.authMode);
                    if (method.apiKeySource) {
                      setApiKeySource(method.apiKeySource);
                    }
                    if (method.sessionSource) {
                      setSessionSource(method.sessionSource);
                    }
                  }}
                />
              </FormField>
            ) : null}

            {requiresGatewayPreparation ? (
              <>
                <div className="grid gap-5 lg:grid-cols-2">
                  {selectedDefinition?.requiresEndpointUrl ? (
                    <FormField label={t("dialog.endpointUrl")}>
                      <Input
                        type="url"
                        value={formState.endpointUrl}
                        onChange={(event) => setEndpointUrl(event.target.value)}
                        placeholder={t("dialog.endpointUrlPlaceholder")}
                      />
                    </FormField>
                  ) : null}

                  {formState.apiKeySource === "env_key" ? (
                    <FormField label={t("dialog.envKey")}>
                      <Input
                        type="text"
                        value={formState.envKey}
                        onChange={(event) => setEnvKey(event.target.value)}
                        placeholder={t("dialog.envKeyPlaceholder")}
                      />
                    </FormField>
                  ) : (
                    <FormField label={t("dialog.apiKey")}>
                      <Input
                        type="password"
                        value={formState.apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={t("dialog.apiKeyPlaceholder")}
                      />
                    </FormField>
                  )}
                </div>

                <Alert>
                  <AlertTitle>{t("addConnection.gatewayTrustTitle")}</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <div>{t("addConnection.gatewayTrustDescription", { host: gatewayTrustTarget })}</div>
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={gatewayTrustConfirmed}
                        onCheckedChange={(checked) => setGatewayTrustConfirmed(checked === true)}
                      />
                      <span>{t("addConnection.gatewayTrustAcknowledge")}</span>
                    </label>
                  </AlertDescription>
                </Alert>
              </>
            ) : null}

            {actionError ? (
              <Alert>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            {showPostPreparationFields ? (
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
                        value={formState.authJsonPath}
                        placeholder={t("addConnection.authJsonPathPlaceholder")}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isChoosingAuthJsonPath || isSessionStructureLocked}
                        onClick={() => void chooseAuthJsonPath()}
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
                  {selectedDefinition?.requiresEndpointUrl && !requiresGatewayPreparation ? (
                    <FormField label={t("dialog.endpointUrl")}>
                      <Input
                        type="url"
                        value={formState.endpointUrl}
                        onChange={(event) => setEndpointUrl(event.target.value)}
                        placeholder={t("dialog.endpointUrlPlaceholder")}
                      />
                    </FormField>
                  ) : null}

                  {formState.authMode === "api_key" && !requiresGatewayPreparation ? (
                    formState.apiKeySource === "env_key" ? (
                      <FormField label={t("dialog.envKey")}>
                        <Input
                          type="text"
                          value={formState.envKey}
                          onChange={(event) => setEnvKey(event.target.value)}
                          placeholder={t("dialog.envKeyPlaceholder")}
                        />
                      </FormField>
                    ) : (
                      <FormField label={t("dialog.apiKey")}>
                        <Input
                          type="password"
                          value={formState.apiKey}
                          onChange={(event) => setApiKey(event.target.value)}
                          placeholder={t("dialog.apiKeyPlaceholder")}
                        />
                      </FormField>
                    )
                  ) : null}
                </div>

                <ConnectionCapabilityField
                  configurableAgents={configurableAgents}
                  editable={shouldShowEnabledAgents}
                  enabledAgents={displayedEnabledAgents}
                  isProbingSupport={shouldProbeEnabledAgents && isProbingSupport}
                  showDetectionState={requiresGatewayPreparation}
                  suggestedAgents={suggestedAgents}
                  t={t}
                  onEnabledAgentsChange={shouldShowEnabledAgents ? setEnabledAgents : undefined}
                />
              </>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" type="button" onClick={onBack}>
                {t("common.cancel")}
              </Button>
              {requiresSessionPreparation && !preparedDraft ? (
                <Button
                  type="button"
                  disabled={isPreparingDraft}
                  onClick={() => void prepareDraft()}
                >
                  {isPreparingDraft
                    ? t("addConnection.signingIn")
                    : formState.authMode === "claude_session"
                      ? t("addConnection.signInWithClaude")
                      : t("addConnection.signInWithOpenAi")}
                </Button>
              ) : requiresGatewayPreparation && !showPostPreparationFields ? (
                <>
                  <Button
                    type="button"
                    disabled={
                      isPreparingGateway
                      || !gatewayTrustConfirmed
                      || !selectedDefinition
                      || !formState.endpointUrl.trim()
                      || !hasResolvedApiKeyInput
                    }
                    onClick={() => void prepareGateway()}
                  >
                    {isPreparingGateway ? t("addConnection.detectingCapability") : t("addConnection.detectCapability")}
                  </Button>
                </>
              ) : requiresGatewayPreparation ? (
                <>
                  <Button
                    type="submit"
                    disabled={enabledAgentsSelectionInvalid || isSubmitting}
                  >
                    {isSubmitting ? t("addConnection.submitting") : submitLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      isPreparingGateway
                      || !gatewayTrustConfirmed
                      || !selectedDefinition
                      || !formState.endpointUrl.trim()
                      || !hasResolvedApiKeyInput
                    }
                    onClick={() => void prepareGateway()}
                  >
                    {isPreparingGateway ? t("addConnection.detectingCapability") : t("addConnection.redetectCapability")}
                  </Button>
                </>
              ) : (
                <Button
                  type="submit"
                  disabled={enabledAgentsSelectionInvalid || isSubmitting}
                >
                  {isSubmitting ? t("addConnection.submitting") : submitLabel}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function describeGatewayTrustTarget(endpointUrl: string): string {
  const trimmed = endpointUrl.trim();
  if (!trimmed) {
    return "this endpoint";
  }

  try {
    return new URL(trimmed).host || trimmed;
  } catch {
    return trimmed;
  }
}

function readPresetIcon(preset: Definition["preset"]) {
  if (preset === "openai") {
    return <BrandIcon svg={openAiSvg} />;
  }
  if (preset === "gateway") {
    return <Waypoints className="h-4 w-4" />;
  }
  if (preset === "azure-openai") {
    return <BrandIcon svg={azureAiSvg} />;
  }
  return <BrandIcon svg={claudeSvg} />;
}

function BrandIcon({ svg }: { svg: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
