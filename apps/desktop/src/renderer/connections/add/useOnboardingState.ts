import { useEffect, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import type { Definition } from "../../shared/Definitions";
import type { AddConnectionSubmitInput } from "./Types";

type UseAddConnectionOnboardingStateOptions = {
  selectedDefinition: Definition | null;
  authMode: string;
  apiKeySource: "direct" | "env_key";
  apiKey: string;
  endpointUrl: string;
  envKey: string;
  enabledAgents: AgentId[];
  hasResolvedApiKeyInput: boolean;
  requiresGatewayPreparation: boolean;
  setEnabledAgents(agentIds: AgentId[]): void;
  readConnectionInput(): AddConnectionSubmitInput | null;
};

export function useAddConnectionOnboardingState({
  selectedDefinition,
  authMode,
  apiKeySource,
  apiKey,
  endpointUrl,
  envKey,
  enabledAgents,
  hasResolvedApiKeyInput,
  requiresGatewayPreparation,
  setEnabledAgents,
  readConnectionInput,
}: UseAddConnectionOnboardingStateOptions) {
  const [isPreparingGateway, setIsPreparingGateway] = useState(false);
  const [gatewayPrepared, setGatewayPrepared] = useState(false);
  const [gatewayProbeError, setGatewayProbeError] = useState<string | null>(null);
  const [gatewayTrustConfirmed, setGatewayTrustConfirmed] = useState(false);
  const [suggestedAgents, setSuggestedAgents] = useState<AgentId[]>([]);
  const [isProbingSupport, setIsProbingSupport] = useState(false);
  const [resolvedConfigurableAgents, setResolvedConfigurableAgents] = useState<AgentId[]>([]);

  const configurableAgents = resolvedConfigurableAgents.length > 0
    ? resolvedConfigurableAgents
    : selectedDefinition?.configurableAgents ?? [];
  const shouldShowEnabledAgents = configurableAgents.length > 1;
  const shouldProbeEnabledAgents =
    Boolean(selectedDefinition?.suggestEnabledAgents)
    && authMode === "api_key"
    && Boolean(endpointUrl.trim())
    && hasResolvedApiKeyInput
    && !requiresGatewayPreparation;

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
    void window.nileDesktop.connections.describeConnectionOnboarding({
      preset: selectedDefinition.preset,
      authMode: authMode as Definition["supportedAuthModes"][number],
      endpointUrl: endpointUrl.trim() || undefined,
      apiKeySource,
      apiKey: apiKeySource === "direct" ? apiKey.trim() || undefined : undefined,
      envKey: apiKeySource === "env_key" ? envKey.trim() || undefined : undefined,
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
        if (enabledAgents.length > 0) {
          setEnabledAgents(resolveEnabledAgents(
            enabledAgents,
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
    apiKey,
    apiKeySource,
    authMode,
    enabledAgents,
    endpointUrl,
    envKey,
    selectedDefinition,
    setEnabledAgents,
    shouldProbeEnabledAgents,
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
    apiKey,
    apiKeySource,
    endpointUrl,
    envKey,
    requiresGatewayPreparation,
    selectedDefinition?.preset,
  ]);

  const prepareGateway = async () => {
    const input = readConnectionInput();
    if (!input) {
      return;
    }

    setIsPreparingGateway(true);
    try {
      const onboarding = await window.nileDesktop.connections.describeConnectionOnboarding({
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
        enabledAgents,
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

  return {
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
