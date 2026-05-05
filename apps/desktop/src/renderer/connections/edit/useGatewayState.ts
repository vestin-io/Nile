import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";
import { EnabledAgentsPolicy } from "@nile/core/models/connection/enabled-agents-policy";

import type { DesktopConnection } from "../../../state/Types";
import { sameAgentSelection } from "../../shared/AgentSelection";
import type { Definition } from "../../shared/Definitions";

type UseGatewaySupportStateOptions = {
  apiKey: string;
  apiKeySource: "direct" | "env_key";
  connection: DesktopConnection;
  definition: Definition | null;
  enabledAgents: AgentId[];
  endpointUrl: string;
  envKey: string;
  onEnabledAgentsChanged(nextAgents: AgentId[]): void;
};

export function useGatewaySupportState({
  apiKey,
  apiKeySource,
  connection,
  definition,
  enabledAgents,
  endpointUrl,
  envKey,
  onEnabledAgentsChanged,
}: UseGatewaySupportStateOptions) {
  const [agentsDirty, setAgentsDirty] = useState(false);
  const [gatewayTrustConfirmed, setGatewayTrustConfirmed] = useState(false);
  const [hasProbedSupport, setHasProbedSupport] = useState(false);
  const [isProbingSupport, setIsProbingSupport] = useState(false);
  const [suggestedAgents, setSuggestedAgents] = useState<AgentId[]>([]);
  const [resolvedConfigurableAgents, setResolvedConfigurableAgents] = useState<AgentId[]>(
    connection.configurableAgents,
  );
  const enabledAgentsPolicy = useMemo(() => new EnabledAgentsPolicy(), []);

  const canEditEnabledAgents = connection.endpointFamily === "gateway";
  const hasApiKeyInput = apiKeySource === "env_key" ? Boolean(envKey.trim()) : Boolean(apiKey.trim());
  const shouldProbeGatewaySupport = connection.endpointFamily === "gateway"
    && Boolean(definition)
    && Boolean(endpointUrl.trim())
    && (hasApiKeyInput || endpointUrl.trim() !== (connection.endpointUrl ?? ""));
  const requiresGatewayTrustForSave = connection.endpointFamily === "gateway"
    && connection.authMode === "api_key"
    && (
      endpointUrl.trim() !== (connection.endpointUrl ?? "")
      || hasApiKeyInput
    );
  const configurableAgents = canEditEnabledAgents
    ? resolvedConfigurableAgents
    : definition?.defaultEnabledAgents ?? [];

  useEffect(() => {
    setAgentsDirty(false);
    setGatewayTrustConfirmed(false);
    setHasProbedSupport(false);
    setIsProbingSupport(false);
    setSuggestedAgents([]);
    setResolvedConfigurableAgents(connection.configurableAgents);
  }, [connection.id, connection.configurableAgents]);

  useEffect(() => {
    if (!canEditEnabledAgents) {
      return;
    }
    setGatewayTrustConfirmed(false);
    setHasProbedSupport(false);
    setSuggestedAgents([]);
    setResolvedConfigurableAgents(connection.configurableAgents);
  }, [
    apiKey,
    apiKeySource,
    canEditEnabledAgents,
    connection.configurableAgents,
    endpointUrl,
    envKey,
  ]);

  const redetectSupport = async () => {
    if (!canEditEnabledAgents || !shouldProbeGatewaySupport || isProbingSupport) {
      return;
    }

    await probeSupport({
      agentsDirty,
      apiKey,
      apiKeySource,
      connectionId: connection.id,
      enabledAgents,
      enabledAgentsPolicy,
      endpointUrl,
      envKey,
      onConfigurableAgents: setResolvedConfigurableAgents,
      onEnabledAgents: onEnabledAgentsChanged,
      onProbing: setIsProbingSupport,
      onProbeRecorded: setHasProbedSupport,
      onSuggestedAgents: setSuggestedAgents,
    });
  };

  return {
    agentsDirty,
    canEditEnabledAgents,
    configurableAgents,
    gatewayTrustConfirmed,
    hasProbedSupport,
    isProbingSupport,
    requiresGatewayTrustForSave,
    redetectSupport,
    setAgentsDirty,
    setGatewayTrustConfirmed,
    shouldProbeGatewaySupport,
    suggestedAgents,
  };
}

async function probeSupport(input: {
  agentsDirty: boolean;
  apiKey: string;
  apiKeySource: "direct" | "env_key";
  connectionId: string;
  enabledAgents: AgentId[];
  enabledAgentsPolicy: EnabledAgentsPolicy;
  endpointUrl: string;
  envKey: string;
  onConfigurableAgents(nextAgents: AgentId[]): void;
  onEnabledAgents(nextAgents: AgentId[]): void;
  onProbing(probing: boolean): void;
  onProbeRecorded?(probed: boolean): void;
  onSuggestedAgents(nextAgents: AgentId[]): void;
}): Promise<void> {
  input.onProbing(true);
  input.onProbeRecorded?.(true);
  try {
    const onboarding = await window.nileDesktop.connections.describeSavedConnectionOnboarding({
      connectionId: input.connectionId,
      endpointUrl: input.endpointUrl.trim() || undefined,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKeySource === "direct" ? input.apiKey.trim() || undefined : undefined,
      envKey: input.apiKeySource === "env_key" ? input.envKey.trim() || undefined : undefined,
    });
    const nextConfigurableAgents = mergeConfigurableAgents(onboarding.configurableAgents);
    input.onSuggestedAgents(onboarding.suggestedAgents);
    input.onConfigurableAgents(nextConfigurableAgents);
    if (input.agentsDirty) {
      return;
    }
    const nextEnabledAgents = input.enabledAgentsPolicy.reconcile(
      input.enabledAgents,
      nextConfigurableAgents,
      onboarding.defaultEnabledAgents,
    );
    if (!sameAgentSelection(nextEnabledAgents, input.enabledAgents)) {
      input.onEnabledAgents(nextEnabledAgents);
    }
  } catch {
    input.onSuggestedAgents([]);
  } finally {
    input.onProbing(false);
  }
}

function mergeConfigurableAgents(agentIds: AgentId[]): AgentId[] {
  return [...new Set(agentIds)];
}
