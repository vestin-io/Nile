import { useEffect, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import type { Definition } from "../shared/Support";
import { useAddConnectionForm } from "./useAddConnectionForm";

export type AddConnectionSubmitInput = {
  preset: Definition["preset"];
  authMode: Definition["supportedAuthModes"][number];
  label?: string;
  endpointUrl?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  openAiSessionSource?: "login" | "current_codex";
  openAiAuthJsonPath?: string;
  claudeSessionSource?: "login" | "current_claude";
};

export type AddConnectionPreparedSaveInput = {
  draftId: string;
  label?: string;
  enabledAgents?: AgentId[];
};

export type PreparedConnectionDraft = Awaited<ReturnType<typeof window.nileDesktop.prepareConnectionDraft>>;

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
  const [isPreparingGateway, setIsPreparingGateway] = useState(false);
  const [gatewayPrepared, setGatewayPrepared] = useState(false);
  const [gatewayProbeError, setGatewayProbeError] = useState<string | null>(null);
  const [gatewayTrustConfirmed, setGatewayTrustConfirmed] = useState(false);
  const [suggestedAgents, setSuggestedAgents] = useState<AgentId[]>([]);
  const [isProbingSupport, setIsProbingSupport] = useState(false);
  const [resolvedConfigurableAgents, setResolvedConfigurableAgents] = useState<AgentId[]>([]);

  const supportsCurrentCodexImport = formState.authMode === "openai_session";
  const shouldShowAuthJsonPath =
    formState.authMode === "openai_session" && formState.sessionSource === "current_codex";
  const requiresSessionPreparation =
    (formState.authMode === "openai_session" && formState.sessionSource === "login")
    || formState.authMode === "claude_session";
  const isPreparedSessionFlow = requiresSessionPreparation && preparedDraft !== null;
  const requiresGatewayPreparation =
    selectedDefinition?.preset === "gateway" && formState.authMode === "api_key";
  const configurableAgents = resolvedConfigurableAgents.length > 0
    ? resolvedConfigurableAgents
    : selectedDefinition?.configurableAgents ?? [];
  const shouldShowEnabledAgents = configurableAgents.length > 1;
  const enabledAgentsSelectionInvalid = shouldShowEnabledAgents && formState.enabledAgents.length === 0;
  const displayedEnabledAgents = shouldShowEnabledAgents
    ? formState.enabledAgents
    : preparedDraft?.defaultEnabledAgents ?? selectedDefinition?.defaultEnabledAgents ?? [];
  const hasResolvedApiKeyInput = formState.apiKeySource === "env_key"
    ? Boolean(formState.envKey.trim())
    : Boolean(formState.apiKey.trim());
  const shouldProbeEnabledAgents =
    Boolean(selectedDefinition?.suggestEnabledAgents)
    && formState.authMode === "api_key"
    && Boolean(formState.endpointUrl.trim())
    && hasResolvedApiKeyInput
    && !requiresGatewayPreparation;
  const gatewayCapabilityResolved = !requiresGatewayPreparation || gatewayPrepared || gatewayProbeError !== null;
  const showPostPreparationFields =
    (!requiresSessionPreparation || preparedDraft !== null)
    && gatewayCapabilityResolved;

  useEffect(() => {
    setResolvedConfigurableAgents(selectedDefinition?.configurableAgents ?? []);
  }, [selectedDefinition]);

  useEffect(() => {
    if (!selectedDefinition) {
      setSuggestedAgents([]);
      return;
    }

    if (!shouldProbeEnabledAgents) {
      return;
    }

    let cancelled = false;
    setIsProbingSupport(true);
    void window.nileDesktop.describeConnectionOnboarding({
      preset: selectedDefinition.preset,
      authMode: formState.authMode as Definition["supportedAuthModes"][number],
      endpointUrl: formState.endpointUrl.trim() || undefined,
      apiKeySource: formState.apiKeySource,
      apiKey: formState.apiKeySource === "direct" ? formState.apiKey.trim() || undefined : undefined,
      envKey: formState.apiKeySource === "env_key" ? formState.envKey.trim() || undefined : undefined,
    })
      .then((onboarding) => {
        if (cancelled) {
          return;
        }
        const nextConfigurableAgents = mergeConfigurableAgents(
          selectedDefinition.configurableAgents,
          onboarding.configurableAgents,
        );
        setSuggestedAgents(onboarding.suggestedAgents);
        setResolvedConfigurableAgents(nextConfigurableAgents);
        if (formState.enabledAgents.length > 0) {
          setEnabledAgents(resolveEnabledAgents(
            formState.enabledAgents,
            nextConfigurableAgents,
            onboarding.defaultEnabledAgents,
          ));
          return;
        }
        setEnabledAgents(resolveEnabledAgents([], nextConfigurableAgents, onboarding.defaultEnabledAgents));
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestedAgents([]);
          setResolvedConfigurableAgents(selectedDefinition.configurableAgents);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsProbingSupport(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    formState.apiKey,
    formState.apiKeySource,
    formState.authMode,
    formState.envKey,
    formState.endpointUrl,
    formState.enabledAgents,
    selectedDefinition,
    setEnabledAgents,
    shouldProbeEnabledAgents,
  ]);

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
      void window.nileDesktop.discardPreparedConnectionDraft({ draftId: preparedDraft.id });
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

  useEffect(() => {
    if (!requiresGatewayPreparation) {
      setGatewayPrepared(false);
      setGatewayProbeError(null);
      setGatewayTrustConfirmed(false);
      return;
    }
    setGatewayPrepared(false);
    setGatewayProbeError(null);
    setGatewayTrustConfirmed(false);
  }, [
    formState.apiKey,
    formState.apiKeySource,
    formState.endpointUrl,
    formState.envKey,
    requiresGatewayPreparation,
    selectedDefinition?.preset,
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
      setSuggestedAgents(draft.suggestedAgents);
      setResolvedConfigurableAgents(mergeConfigurableAgents(
        selectedDefinition?.configurableAgents ?? [],
        draft.configurableAgents,
      ));
      setEnabledAgents(draft.defaultEnabledAgents);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreparingDraft(false);
    }
  };

  const prepareGateway = async () => {
    const input = readConnectionInput();
    if (!input) {
      return;
    }

    setIsPreparingGateway(true);
    try {
      const onboarding = await window.nileDesktop.describeConnectionOnboarding({
        preset: input.preset,
        authMode: input.authMode,
        endpointUrl: input.endpointUrl,
        apiKeySource: input.apiKeySource,
        apiKey: input.apiKey,
        envKey: input.envKey,
      });
      const nextConfigurableAgents = mergeConfigurableAgents(
        selectedDefinition?.configurableAgents ?? [],
        onboarding.configurableAgents,
      );
      setSuggestedAgents(onboarding.suggestedAgents);
      setResolvedConfigurableAgents(nextConfigurableAgents);
      setEnabledAgents(resolveEnabledAgents(
        formState.enabledAgents,
        nextConfigurableAgents,
        onboarding.defaultEnabledAgents,
      ));
      setGatewayProbeError(null);
      setGatewayPrepared(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSuggestedAgents([]);
      setResolvedConfigurableAgents(selectedDefinition?.configurableAgents ?? []);
      setGatewayPrepared(false);
      setGatewayProbeError(message);
    } finally {
      setIsPreparingGateway(false);
    }
  };

  const chooseAuthJsonPath = async () => {
    setIsChoosingAuthJsonPath(true);
    try {
      setActionError(null);
      const path = await window.nileDesktop.chooseOpenAiAuthJsonPath(formState.authJsonPath);
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

function mergeConfigurableAgents(
  current: AgentId[],
  next: AgentId[],
): AgentId[] {
  return [...new Set([...current, ...next])];
}

function resolveEnabledAgents(
  current: AgentId[],
  configurableAgents: AgentId[],
  fallback: AgentId[],
): AgentId[] {
  const allowed = new Set(configurableAgents);
  const retained = current.filter((agentId) => allowed.has(agentId));
  if (retained.length > 0) {
    return [...new Set(retained)];
  }
  return [...new Set(fallback.filter((agentId) => allowed.has(agentId)))];
}
