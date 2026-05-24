import { useEffect, useState } from "react";
import { SHARED_SESSION_CONNECTION_METHODS } from "@nile/builtins/session";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { Definition } from "../../shared/DesktopData";
import {
  type AddConnectionPreparedSaveInput,
  type AddConnectionSubmitInput,
  type PreparedConnectionDraft,
} from "./Types";
import { useAddConnectionForm } from "./useForm";
import { useAddConnectionOnboardingState } from "./useOnboardingState";

type UseAddConnectionPageStateOptions = {
  credentialStorageMode: CredentialStorageBackend | null;
  credentialStorageState: Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  isCredentialStorageModeLocked: boolean;
  onRememberCredentialStorageMode(backend: CredentialStorageBackend): void;
  onPrepareDraft(input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft>;
  onSavePrepared(input: AddConnectionPreparedSaveInput): Promise<void>;
  onSubmit(input: AddConnectionSubmitInput): Promise<void>;
};

export function useAddConnectionPageState({
  credentialStorageMode,
  credentialStorageState,
  defaultOpenAiAuthJsonPath,
  definitions,
  isCredentialStorageModeLocked,
  onRememberCredentialStorageMode,
  onPrepareDraft,
  onSavePrepared,
  onSubmit,
}: UseAddConnectionPageStateOptions) {
  const {
    formState,
    enabledAgentsManuallyEdited,
    selectedDefinition,
    setApiKey,
    setApiKeySource,
    setAuthJsonPath,
    setAuthMode,
    setCredentialStorageBackend,
    setEncryptedLocalPassphrase,
    setEncryptedLocalPassphraseConfirmation,
    setEnvKey,
    setEndpointUrl,
    setEnabledAgents,
    setPreset,
    setSessionSource,
  } = useAddConnectionForm(definitions, defaultOpenAiAuthJsonPath, credentialStorageMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [isChoosingAuthJsonPath, setIsChoosingAuthJsonPath] = useState(false);
  const [preparedDraft, setPreparedDraft] = useState<PreparedConnectionDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sessionMethod = SHARED_SESSION_CONNECTION_METHODS.readMethod(
    formState.authMode,
    formState.sessionSource,
  );

  const supportsCurrentCodexImport = formState.authMode === "openai_session"
    && SHARED_SESSION_CONNECTION_METHODS.listForAuthMode("openai_session").some((method) => method.source === "current_codex");
  const shouldShowAuthJsonPath = sessionMethod?.requiresAuthJsonPath === true;
  const requiresSessionPreparation = sessionMethod?.requiresPreparation === true;
  const isPreparedSessionFlow = requiresSessionPreparation && preparedDraft !== null;
  const requiresGatewayPreparation =
    selectedDefinition?.preset === "gateway" && formState.authMode === "api_key";
  const hasResolvedApiKeyInput = formState.apiKeySource === "env_key"
    ? Boolean(formState.envKey.trim())
    : Boolean(formState.apiKey.trim());
  const requiresEncryptedLocalPassphrase = formState.credentialStorageBackend === "encrypted_local_storage"
    && !credentialStorageState.encryptedLocalUnlocked;
  const requiresEncryptedLocalConfirmation = requiresEncryptedLocalPassphrase
    && !credentialStorageState.encryptedLocalVaultExists;
  const encryptedLocalPassphraseInvalid = requiresEncryptedLocalPassphrase
    && (
      !formState.encryptedLocalPassphrase.trim()
      || (
        requiresEncryptedLocalConfirmation
        && formState.encryptedLocalPassphrase !== formState.encryptedLocalPassphraseConfirmation
      )
    );

  useEffect(() => {
    if (!requiresSessionPreparation) {
      setPreparedDraft(null);
    }
  }, [requiresSessionPreparation, selectedDefinition?.preset]);

  useEffect(() => {
    if (!preparedDraft) {
      return;
    }

    return () => {
      void window.nileDesktop.connections.discardPreparedConnectionDraft({ draftId: preparedDraft.id });
    };
  }, [preparedDraft]);

  useEffect(() => {
    setActionError(null);
  }, [
    formState.apiKey,
    formState.apiKeySource,
    formState.authJsonPath,
    formState.authMode,
    formState.credentialStorageBackend,
    formState.encryptedLocalPassphrase,
    formState.encryptedLocalPassphraseConfirmation,
    formState.endpointUrl,
    formState.envKey,
    formState.preset,
    formState.sessionSource,
  ]);

  const readConnectionInput = (): AddConnectionSubmitInput | null => {
    if (!selectedDefinition || !formState.authMode) {
      return null;
    }

    const activeCredentialStorageMode = credentialStorageMode ?? formState.credentialStorageBackend;

    return {
      preset: selectedDefinition.preset,
      authMode: formState.authMode as Definition["supportedAuthModes"][number],
      endpointUrl: formState.endpointUrl.trim() || undefined,
      enabledAgents: formState.enabledAgents,
      allowUndetectedGateway: gatewayProbeError !== null,
      credentialStorageBackend: activeCredentialStorageMode,
      encryptedLocalPassphrase: activeCredentialStorageMode === "encrypted_local_storage"
        ? formState.encryptedLocalPassphrase.trim() || undefined
        : undefined,
      apiKeySource: formState.apiKeySource,
      apiKey: formState.apiKeySource === "direct" ? formState.apiKey.trim() || undefined : undefined,
      envKey: formState.apiKeySource === "env_key" ? formState.envKey.trim() || undefined : undefined,
      sessionSource: sessionMethod?.source,
      sessionAuthJsonPath: shouldShowAuthJsonPath ? formState.authJsonPath.trim() || undefined : undefined,
    };
  };

  const {
    configurableAgents,
    gatewayPrepared,
    gatewayProbeError,
    gatewayTrustConfirmed,
    isPreparingGateway,
    isProbingSupport,
    prepareGateway,
    setGatewayTrustConfirmed,
    shouldProbeEnabledAgents,
    shouldShowEnabledAgents,
    detectedAgents,
  } = useAddConnectionOnboardingState({
    selectedDefinition: selectedDefinition ?? null,
    authMode: formState.authMode,
    apiKeySource: formState.apiKeySource,
    apiKey: formState.apiKey,
    endpointUrl: formState.endpointUrl,
    envKey: formState.envKey,
    enabledAgents: formState.enabledAgents,
    enabledAgentsManuallyEdited,
    hasResolvedApiKeyInput,
    requiresGatewayPreparation,
    setEnabledAgents,
    readConnectionInput,
  });
  const enabledAgentsSelectionInvalid = shouldShowEnabledAgents && formState.enabledAgents.length === 0;
  const displayedEnabledAgents = shouldShowEnabledAgents
    ? formState.enabledAgents
    : preparedDraft?.defaultEnabledAgents ?? selectedDefinition?.defaultEnabledAgents ?? [];
  const shouldRememberCredentialStorageMode = credentialStorageMode === null && !isCredentialStorageModeLocked;
  const gatewayCapabilityResolved = !requiresGatewayPreparation || gatewayPrepared || gatewayProbeError !== null;
  const showPostPreparationFields =
    (!requiresSessionPreparation || preparedDraft !== null)
    && gatewayCapabilityResolved;

  const submit = async () => {
    if (
      enabledAgentsSelectionInvalid
      || encryptedLocalPassphraseInvalid
      || isSubmitting
      || !showPostPreparationFields
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      setActionError(null);
      if (preparedDraft) {
        await onSavePrepared({
          draftId: preparedDraft.id,
          enabledAgents: formState.enabledAgents,
        });
        if (shouldRememberCredentialStorageMode) {
          onRememberCredentialStorageMode(formState.credentialStorageBackend);
        }
        setPreparedDraft(null);
        return;
      }

      const input = readConnectionInput();
      if (!input) {
        return;
      }

      await onSubmit(input);
      if (shouldRememberCredentialStorageMode) {
        onRememberCredentialStorageMode(formState.credentialStorageBackend);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const prepareDraft = async () => {
    const input = readConnectionInput();
    if (!input) {
      return;
    }

    setIsPreparingDraft(true);
    try {
      setActionError(null);
      const draft = await onPrepareDraft(input);
      setPreparedDraft(draft);
      setEnabledAgents(draft.defaultEnabledAgents, { userEdited: false });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreparingDraft(false);
    }
  };

  const chooseAuthJsonPath = async () => {
    setIsChoosingAuthJsonPath(true);
    try {
      setActionError(null);
      const path = await window.nileDesktop.connections.chooseOpenAiAuthJsonPath(formState.authJsonPath);
      if (path) {
        setAuthJsonPath(path);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsChoosingAuthJsonPath(false);
    }
  };

  return {
    actionError,
    configurableAgents,
    displayedEnabledAgents,
    enabledAgentsSelectionInvalid,
    formState,
    gatewayProbeError,
    gatewayPrepared,
    gatewayTrustConfirmed,
    credentialStorageState,
    encryptedLocalPassphraseInvalid,
    hasResolvedApiKeyInput,
    isChoosingAuthJsonPath,
    isPreparedSessionFlow,
    isPreparingDraft,
    isPreparingGateway,
    isProbingSupport,
    isSubmitting,
    preparedDraft,
    requiresGatewayPreparation,
    requiresSessionPreparation,
    selectedDefinition,
    setApiKey,
    setApiKeySource,
    setAuthMode,
    setCredentialStorageBackend,
    setEncryptedLocalPassphrase,
    setEncryptedLocalPassphraseConfirmation,
    setEndpointUrl,
    setEnvKey,
    setEnabledAgents,
    setPreset,
    setSessionSource,
    setGatewayTrustConfirmed,
    shouldProbeEnabledAgents,
    shouldShowAuthJsonPath,
    shouldShowEnabledAgents,
    showPostPreparationFields,
    requiresEncryptedLocalConfirmation,
    requiresEncryptedLocalPassphrase,
    submit,
    detectedAgents,
    supportsCurrentCodexImport,
    chooseAuthJsonPath,
    prepareDraft,
    prepareGateway,
  };
}
