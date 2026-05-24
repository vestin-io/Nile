import { useState } from "react";

import type { AgentId } from "@nile/core/models/agent/definitions";
import type { CredentialStorageBackend } from "@nile/core/services/credential";
import { SHARED_SESSION_CONNECTION_METHODS } from "@nile/builtins/session";

import {
  buildConnectionMethods,
  ConnectionMethodSelector,
  FormField,
  readSelectedMethodKey,
  readSessionPreparationLabel,
} from "../ConnectionFormParts";
import type { Translator } from "../../shared/I18n";
import { type Definition } from "../../shared/DesktopData";
import { readEncryptedLocalUnlockErrorMessage } from "../../shared/EncryptedLocalUnlock";
import { useEncryptedLocalAccessRecovery } from "../../shared/EncryptedLocalAccess";
import type { LanguagePreference } from "../../settings/Preferences";
import { useAddConnectionPageState } from "./usePageState";
import type {
  AddConnectionPreparedSaveInput,
  AddConnectionSubmitInput,
  PreparedConnectionDraft,
} from "./Types";
import { AddConnectionHeader } from "./Header";
import { AddConnectionGatewayPreparation } from "./GatewayPreparation";
import { AddConnectionPostPreparation } from "./PostPreparation";
import { AddConnectionPresetCard } from "./PresetCard";
import { CredentialStorageDialog } from "../dialogs/CredentialStorage";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

type AddConnectionPageProps = {
  credentialStorageMode: CredentialStorageBackend | null;
  credentialStorageState: Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  isCredentialStorageModeLocked: boolean;
  isCredentialStorageModeMixed: boolean;
  language: LanguagePreference;
  targetAgentId: AgentId | null;
  t: Translator;
  onBack(): void;
  onRememberCredentialStorageMode(backend: CredentialStorageBackend): void;
  onPrepareDraft(input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft>;
  onRefreshCredentialStorageState(): Promise<Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>>;
  onSavePrepared(input: AddConnectionPreparedSaveInput): Promise<void>;
  onSubmit(input: AddConnectionSubmitInput): Promise<void>;
};

export function AddConnectionPage({
  credentialStorageMode,
  credentialStorageState,
  defaultOpenAiAuthJsonPath,
  definitions,
  isCredentialStorageModeLocked,
  isCredentialStorageModeMixed,
  language,
  targetAgentId,
  t,
  onBack,
  onRememberCredentialStorageMode,
  onPrepareDraft,
  onRefreshCredentialStorageState,
  onSavePrepared,
  onSubmit,
}: AddConnectionPageProps) {
  const { requestUnlock } = useEncryptedLocalAccessRecovery();
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
    setCredentialStorageBackend,
    setEncryptedLocalPassphrase,
    setEncryptedLocalPassphraseConfirmation,
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
    detectedAgents,
  } = useAddConnectionPageState({
    defaultOpenAiAuthJsonPath,
    credentialStorageMode,
    credentialStorageState,
    definitions,
    isCredentialStorageModeLocked,
    onRememberCredentialStorageMode,
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
  const selectedSessionMethod = SHARED_SESSION_CONNECTION_METHODS.readMethod(
    formState.authMode,
    formState.sessionSource,
  );
  const [isCredentialStorageDialogOpen, setIsCredentialStorageDialogOpen] = useState(false);
  const [credentialStorageError, setCredentialStorageError] = useState<string | null>(null);

  const submitLabel = (() => {
    if (isPreparedSessionFlow) {
      return t("addConnection.saveConnection");
    }

    if (requiresGatewayPreparation && !gatewayPrepared) {
      if (gatewayProbeError) {
        return t("common.addConnection");
      }
      return t("addConnection.detectCapability");
    }

    if (selectedSessionMethod) {
      return t(selectedSessionMethod.submitKey);
    }

    return t("common.addConnection");
  })();
  const isSessionStructureLocked = isPreparedSessionFlow;
  const activeCredentialStorageMode = credentialStorageMode ?? formState.credentialStorageBackend;

  if (isCredentialStorageModeMixed) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-10">
        <AddConnectionHeader
          targetAgentId={targetAgentId}
          t={t}
          onBack={onBack}
        />
        <Alert variant="destructive">
          <AlertDescription>{t("settings.credentialStorage.mixedDescription")}</AlertDescription>
        </Alert>
      </div>
    );
  }
  const requiresEncryptedLocalUnlock = activeCredentialStorageMode === "encrypted_local_storage"
    && credentialStorageState.encryptedLocalVaultExists
    && !credentialStorageState.encryptedLocalUnlocked;
  const requiresCredentialStorageDialog = activeCredentialStorageMode === "encrypted_local_storage"
    && !credentialStorageState.encryptedLocalVaultExists;

  const runConnectionAction = (action: "prepare-draft" | "submit") => {
    if (requiresEncryptedLocalUnlock) {
      void requestUnlock(t("dialog.encryptedLocalUnlock.reasonSaveConnection"))
        .then(async () => {
          if (action === "prepare-draft") {
            await prepareDraft();
            return;
          }
          await submit();
        })
        .catch(() => undefined);
      return;
    }
    if (requiresCredentialStorageDialog) {
      setCredentialStorageError(null);
      setIsCredentialStorageDialogOpen(true);
      return;
    }
    if (action === "prepare-draft") {
      void prepareDraft();
      return;
    }
    void submit();
  };

  const handleCredentialStorageConfirm = () => {
    void window.nileDesktop.connections.unlockEncryptedLocalStorage(formState.encryptedLocalPassphrase).then(async (result) => {
      if (!result.ok) {
        setCredentialStorageError(readEncryptedLocalUnlockErrorMessage(result, t));
        return;
      }
      setCredentialStorageError(null);
      setIsCredentialStorageDialogOpen(false);
      await onRefreshCredentialStorageState();
      if (requiresSessionPreparation && !preparedDraft) {
        await prepareDraft();
        return;
      }
      await submit();
    }).catch(() => {
      setCredentialStorageError(t("dialog.encryptedLocalUnlock.errorUnknown"));
    });
  };

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
              runConnectionAction("submit");
            }}
          >
            {connectionMethods.length > 0 ? (
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

            <FormField label={t("addConnection.storage.title")}>
              <div className="grid gap-3">
                {isCredentialStorageModeLocked ? (
                  <div className="rounded-xl border px-4 py-3 text-sm text-foreground">
                    {activeCredentialStorageMode === "encrypted_local_storage"
                      ? t("addConnection.storage.encrypted.title")
                      : t("addConnection.storage.system.title")}
                  </div>
                ) : (
                  <Select
                    value={formState.credentialStorageBackend}
                    onValueChange={(value) => setCredentialStorageBackend(value as CredentialStorageBackend)}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system_secure_storage">
                        {t("addConnection.storage.system.title")}
                      </SelectItem>
                      <SelectItem value="encrypted_local_storage">
                        {t("addConnection.storage.encrypted.title")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="text-sm text-muted-foreground">
                  {activeCredentialStorageMode === "system_secure_storage"
                    ? t("addConnection.storage.system.description")
                    : t("addConnection.storage.encrypted.description")}
                </div>
              </div>
            </FormField>

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
                detectedAgents={detectedAgents}
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
                  onClick={() => runConnectionAction("prepare-draft")}
                >
                  {isPreparingDraft
                    ? readSessionPreparationLabel(selectedSessionMethod?.interactionMode, t)
                    : selectedSessionMethod
                      ? t(selectedSessionMethod.submitKey)
                      : t("common.addConnection")}
                </Button>
              ) : requiresGatewayPreparation && !showPostPreparationFields ? (
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

      <CredentialStorageDialog
        backend={formState.credentialStorageBackend}
        errorMessage={credentialStorageError}
        encryptedLocalPassphrase={formState.encryptedLocalPassphrase}
        encryptedLocalPassphraseConfirmation={formState.encryptedLocalPassphraseConfirmation}
        encryptedLocalUnlocked={credentialStorageState.encryptedLocalUnlocked}
        encryptedLocalVaultExists={credentialStorageState.encryptedLocalVaultExists}
        open={isCredentialStorageDialogOpen}
        t={t}
        onConfirm={handleCredentialStorageConfirm}
        onEncryptedLocalPassphraseChange={(value) => {
          setCredentialStorageError(null);
          setEncryptedLocalPassphrase(value);
        }}
        onEncryptedLocalPassphraseConfirmationChange={(value) => {
          setCredentialStorageError(null);
          setEncryptedLocalPassphraseConfirmation(value);
        }}
        onOpenChange={(open) => {
          setIsCredentialStorageDialogOpen(open);
          if (!open) {
            setCredentialStorageError(null);
          }
        }}
      />
    </div>
  );
}
