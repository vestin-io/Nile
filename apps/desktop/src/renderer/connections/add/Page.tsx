import type { AgentId } from "@nile/core/models/agent/types";

import {
  buildConnectionMethods,
  ConnectionMethodSelector,
  FormField,
  readSelectedMethodKey,
} from "../ConnectionFormParts";
import type { Translator } from "../../shared/I18n";
import { type Definition } from "../../shared/Definitions";
import type { LanguagePreference } from "../../settings/Preferences";
import {
  useAddConnectionPageState,
} from "./usePageState";
import type {
  AddConnectionPreparedSaveInput,
  AddConnectionSubmitInput,
  PreparedConnectionDraft,
} from "./Types";
import { AddConnectionHeader } from "./Header";
import { AddConnectionGatewayPreparation } from "./GatewayPreparation";
import { AddConnectionPostPreparation } from "./PostPreparation";
import { AddConnectionPresetCard } from "./PresetCard";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";

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
  const isSessionStructureLocked = isPreparedSessionFlow;

  return (
    <div className="flex w-full flex-col gap-6">
      <AddConnectionHeader
        targetAgentId={targetAgentId}
        t={t}
        onBack={onBack}
      />

      <AddConnectionPresetCard
        definitions={definitions}
        isSessionStructureLocked={isSessionStructureLocked}
        language={language}
        selectedDefinition={selectedDefinition ?? null}
        selectedPreset={formState.preset}
        t={t}
        onPresetChange={setPreset}
      />

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
              <AddConnectionGatewayPreparation
                apiKey={formState.apiKey}
                apiKeySource={formState.apiKeySource}
                endpointUrl={formState.endpointUrl}
                gatewayTrustConfirmed={gatewayTrustConfirmed}
                selectedDefinition={selectedDefinition ?? null}
                t={t}
                onApiKeyChange={setApiKey}
                onEndpointUrlChange={setEndpointUrl}
                onEnvKeyChange={setEnvKey}
                onGatewayTrustConfirmedChange={setGatewayTrustConfirmed}
              />
            ) : null}

            {actionError ? (
              <Alert>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            {showPostPreparationFields ? (
              <AddConnectionPostPreparation
                apiKey={formState.apiKey}
                apiKeySource={formState.apiKeySource}
                authMode={formState.authMode}
                authJsonPath={formState.authJsonPath}
                configurableAgents={configurableAgents}
                displayedEnabledAgents={displayedEnabledAgents}
                endpointUrl={formState.endpointUrl}
                envKey={formState.envKey}
                gatewayProbeError={gatewayProbeError}
                isChoosingAuthJsonPath={isChoosingAuthJsonPath}
                isPreparedSessionFlow={isPreparedSessionFlow}
                isProbingSupport={isProbingSupport}
                isSessionStructureLocked={isSessionStructureLocked}
                selectedDefinition={selectedDefinition ?? null}
                showDetectionState={requiresGatewayPreparation}
                shouldProbeEnabledAgents={shouldProbeEnabledAgents}
                shouldShowAuthJsonPath={shouldShowAuthJsonPath}
                shouldShowEnabledAgents={shouldShowEnabledAgents}
                suggestedAgents={suggestedAgents}
                t={t}
                onApiKeyChange={setApiKey}
                onAuthJsonChoose={() => void chooseAuthJsonPath()}
                onEnabledAgentsChange={setEnabledAgents}
                onEndpointUrlChange={setEndpointUrl}
                onEnvKeyChange={setEnvKey}
              />
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
