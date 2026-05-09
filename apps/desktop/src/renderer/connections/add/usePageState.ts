import { useEffect, useState } from "react";

import type { Definition } from "../../shared/Definitions";
import {
  type AddConnectionPreparedSaveInput,
  type AddConnectionSubmitInput,
  type PreparedConnectionDraft,
} from "./Types";
import { useAddConnectionForm } from "./useForm";
import { useAddConnectionOnboardingState } from "./useOnboardingState";

type UseAddConnectionPageStateOptions = {
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  onPrepareDraft(input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft>;
  onSavePrepared(input: AddConnectionPreparedSaveInput): Promise<void>;
  onSubmit(input: AddConnectionSubmitInput): Promise<void>;
};

export function useAddConnectionPageState({
  defaultOpenAiAuthJsonPath,
  definitions,
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
    setEnvKey,
    setEndpointUrl,
    setEnabledAgents,
    setPreset,
    setSessionSource,
  } = useAddConnectionForm(definitions, defaultOpenAiAuthJsonPath);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [isChoosingAuthJsonPath, setIsChoosingAuthJsonPath] = useState(false);
  const [preparedDraft, setPreparedDraft] = useState<PreparedConnectionDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const supportsCurrentCodexImport = formState.authMode === "openai_session";
  const shouldShowAuthJsonPath =
    formState.authMode === "openai_session" && formState.sessionSource === "current_codex";
  const requiresSessionPreparation =
    (formState.authMode === "openai_session" && formState.sessionSource === "login")
    || formState.authMode === "claude_session";
  const isPreparedSessionFlow = requiresSessionPreparation && preparedDraft !== null;
  const requiresGatewayPreparation =
    selectedDefinition?.preset === "gateway" && formState.authMode === "api_key";
  const hasResolvedApiKeyInput = formState.apiKeySource === "env_key"
    ? Boolean(formState.envKey.trim())
    : Boolean(formState.apiKey.trim());

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
    formState.endpointUrl,
    formState.envKey,
    formState.preset,
    formState.sessionSource,
  ]);

  const readConnectionInput = (): AddConnectionSubmitInput | null => {
    if (!selectedDefinition || !formState.authMode) {
      return null;
    }

    return {
      preset: selectedDefinition.preset,
      authMode: formState.authMode as Definition["supportedAuthModes"][number],
      endpointUrl: formState.endpointUrl.trim() || undefined,
      enabledAgents: formState.enabledAgents,
      allowUndetectedGateway: gatewayProbeError !== null,
      apiKeySource: formState.apiKeySource,
      apiKey: formState.apiKeySource === "direct" ? formState.apiKey.trim() || undefined : undefined,
      envKey: formState.apiKeySource === "env_key" ? formState.envKey.trim() || undefined : undefined,
      openAiSessionSource: supportsCurrentCodexImport ? formState.sessionSource : undefined,
      openAiAuthJsonPath: shouldShowAuthJsonPath ? formState.authJsonPath.trim() || undefined : undefined,
      claudeSessionSource: formState.authMode === "claude_session" ? "login" : undefined,
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
    suggestedAgents,
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
  const gatewayCapabilityResolved = !requiresGatewayPreparation || gatewayPrepared || gatewayProbeError !== null;
  const showPostPreparationFields =
    (!requiresSessionPreparation || preparedDraft !== null)
    && gatewayCapabilityResolved;

  const submit = async () => {
    if (enabledAgentsSelectionInvalid || isSubmitting || !showPostPreparationFields) {
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
        setPreparedDraft(null);
        return;
      }

      const input = readConnectionInput();
      if (!input) {
        return;
      }

      await onSubmit(input);
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
    submit,
    suggestedAgents,
    supportsCurrentCodexImport,
    chooseAuthJsonPath,
    prepareDraft,
    prepareGateway,
  };
}
