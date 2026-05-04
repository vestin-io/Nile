import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";
import { EnabledAgentsPolicy } from "@nile/core/models/connection/enabled-agents-policy";

import type { DesktopConnection } from "../../DesktopTypes";
import { buildConnectionMethods, readSelectedMethodKey } from "./ConnectionFormParts";
import { formatAgentsList, sameAgentSelection, type Definition } from "../shared/Support";
import type { Translator } from "../shared/I18n";

export type ConnectionEditSubmitInput = {
  label?: string;
  enabledAgents?: AgentId[];
  endpointUrl?: string;
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  openAiSessionSource?: "login" | "current_codex";
  openAiAuthJsonPath?: string;
  claudeSessionSource?: "login" | "current_claude";
  syncSelectedAgents?: boolean;
};

type UseConnectionEditStateOptions = {
  connection: DesktopConnection;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  onSubmit(input: ConnectionEditSubmitInput): Promise<void>;
  t: Translator;
};

export function useConnectionEditState({
  connection,
  defaultOpenAiAuthJsonPath,
  definitions,
  onSubmit,
  t,
}: UseConnectionEditStateOptions) {
  const [label, setLabel] = useState(connection.label);
  const [enabledAgents, setEnabledAgents] = useState<AgentId[]>(connection.enabledAgents);
  const [endpointUrl, setEndpointUrl] = useState(connection.endpointUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySource, setApiKeySource] = useState<"direct" | "env_key">(connection.apiKeySource ?? "direct");
  const [envKey, setEnvKey] = useState(connection.envKey ?? "");
  const [sessionSource, setSessionSource] = useState<"login" | "current_codex">("current_codex");
  const [claudeSessionSource, setClaudeSessionSource] = useState<"login" | "current_claude">("login");
  const [authJsonPath, setAuthJsonPath] = useState(defaultOpenAiAuthJsonPath);
  const [isChoosingAuthJsonPath, setIsChoosingAuthJsonPath] = useState(false);
  const [isProbingSupport, setIsProbingSupport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [authUpdateRequested, setAuthUpdateRequested] = useState(false);
  const [agentsDirty, setAgentsDirty] = useState(false);
  const [gatewayTrustConfirmed, setGatewayTrustConfirmed] = useState(false);
  const [hasProbedSupport, setHasProbedSupport] = useState(false);
  const [suggestedAgents, setSuggestedAgents] = useState<AgentId[]>([]);
  const [resolvedConfigurableAgents, setResolvedConfigurableAgents] = useState<AgentId[]>(connection.configurableAgents);
  const enabledAgentsPolicy = useMemo(() => new EnabledAgentsPolicy(), []);

  const trimmedLabel = label.trim();
  const definition = useMemo(() => resolveDefinition(connection, definitions), [connection, definitions]);
  const connectionMethods = useMemo(
    () => definition
      ? buildConnectionMethods(definition, t).filter((method) => method.authMode === connection.authMode)
      : [],
    [connection.authMode, definition, t],
  );
  const selectedMethodKey = readSelectedMethodKey(connection.authMode, sessionSource, apiKeySource);
  const canUpdateCredential = connection.authMode !== "cursor_session" && definition !== null;
  const shouldShowAuthJsonPath = connection.authMode === "openai_session" && sessionSource === "current_codex";
  const canEditEndpointUrl = connection.endpointFamily === "gateway" || connection.endpointFamily === "azure-openai";
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
      || authUpdateRequested
    );
  const configurableAgents = canEditEnabledAgents
    ? resolvedConfigurableAgents
    : definition?.defaultEnabledAgents ?? [];
  const displayedEnabledAgents = canEditEnabledAgents ? enabledAgents : configurableAgents;

  useEffect(() => {
    setLabel(connection.label);
    setEnabledAgents(connection.enabledAgents);
    setEndpointUrl(connection.endpointUrl ?? "");
    setApiKey("");
    setApiKeySource(connection.apiKeySource ?? "direct");
    setEnvKey(connection.envKey ?? "");
    setSessionSource("current_codex");
    setClaudeSessionSource("login");
    setAuthJsonPath(defaultOpenAiAuthJsonPath);
    setIsChoosingAuthJsonPath(false);
    setIsSaving(false);
    setActionError(null);
    setAuthUpdateRequested(false);
    setAgentsDirty(false);
    setGatewayTrustConfirmed(false);
    setHasProbedSupport(false);
    setSuggestedAgents([]);
    setResolvedConfigurableAgents(connection.configurableAgents);
  }, [connection.id, defaultOpenAiAuthJsonPath]);

  useEffect(() => {
    setActionError(null);
  }, [
    apiKey,
    apiKeySource,
    authJsonPath,
    authUpdateRequested,
    claudeSessionSource,
    endpointUrl,
    envKey,
    label,
    sessionSource,
  ]);

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
      onEnabledAgents: setEnabledAgents,
      onProbing: setIsProbingSupport,
      onProbeRecorded: setHasProbedSupport,
      onSuggestedAgents: setSuggestedAgents,
    });
  };

  const chooseAuthJsonPath = async () => {
    setAuthUpdateRequested(true);
    setIsChoosingAuthJsonPath(true);
    try {
      setActionError(null);
      const path = await window.nileDesktop.chooseOpenAiAuthJsonPath(authJsonPath);
      if (path) {
        setAuthJsonPath(path);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsChoosingAuthJsonPath(false);
    }
  };

  const submit = async () => {
    if (!trimmedLabel || isSaving) {
      return;
    }

    const authUpdateInput = readAuthUpdateInput({
      apiKey,
      apiKeySource,
      authJsonPath,
      authUpdateRequested,
      claudeSessionSource,
      connection,
      envKey,
      endpointUrl,
      sessionSource,
    });
    const submitInput: ConnectionEditSubmitInput = {
      label: trimmedLabel === connection.label ? undefined : trimmedLabel,
      enabledAgents: canEditEnabledAgents && !sameAgentSelection(enabledAgents, connection.enabledAgents)
        ? enabledAgents
        : undefined,
      ...authUpdateInput,
    };
    const shouldPromptAgentSync = connection.selectedByAgents.length > 0 && hasAgentAffectingUpdates(submitInput);

    if (shouldPromptAgentSync) {
      const confirmed = window.confirm(
        t("connections.syncAgentsConfirm", {
          agents: formatAgentsList(connection.selectedByAgents, t),
        }),
      );
      if (!confirmed) {
        return;
      }
      submitInput.syncSelectedAgents = true;
    }

    setIsSaving(true);
    try {
      setActionError(null);
      await onSubmit(submitInput);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    apiKey,
    apiKeySource,
    canEditEnabledAgents,
    canEditEndpointUrl,
    canUpdateCredential,
    chooseAuthJsonPath,
    claudeSessionSource,
    configurableAgents,
    connectionMethods,
    displayedEnabledAgents,
    definition,
    enabledAgents,
    envKey,
    gatewayTrustConfirmed,
    isChoosingAuthJsonPath,
    isProbingSupport,
    isSaving,
    label,
    redetectSupport,
    selectedMethodKey,
    sessionSource,
    setAgentsDirty,
    setApiKey,
    setApiKeySource,
    setAuthUpdateRequested,
    setClaudeSessionSource,
    setEnabledAgents,
    setEndpointUrl,
    setEnvKey,
    setGatewayTrustConfirmed,
    setLabel,
    setSessionSource,
    shouldShowAuthJsonPath,
    suggestedAgents,
    submit,
    trimmedLabel,
    endpointUrl,
    authJsonPath,
    actionError,
    hasProbedSupport,
    requiresGatewayTrustForSave,
    shouldProbeGatewaySupport,
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
  shouldRespectCancellation?(): boolean;
}): Promise<void> {
  input.onProbing(true);
  input.onProbeRecorded?.(true);
  try {
    const onboarding = await window.nileDesktop.describeSavedConnectionOnboarding({
      connectionId: input.connectionId,
      endpointUrl: input.endpointUrl.trim() || undefined,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKeySource === "direct" ? input.apiKey.trim() || undefined : undefined,
      envKey: input.apiKeySource === "env_key" ? input.envKey.trim() || undefined : undefined,
    });
    if (input.shouldRespectCancellation?.()) {
      return;
    }
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
    if (!input.shouldRespectCancellation?.()) {
      input.onSuggestedAgents([]);
    }
  } finally {
    if (!input.shouldRespectCancellation?.()) {
      input.onProbing(false);
    }
  }
}

function mergeConfigurableAgents(agentIds: AgentId[]): AgentId[] {
  return [...new Set(agentIds)];
}

function resolveDefinition(connection: DesktopConnection, definitions: Definition[]): Definition | null {
  const preset = connection.endpointFamily === "unknown" || connection.endpointFamily === "cursor"
    ? null
    : connection.endpointFamily;
  if (!preset) {
    return null;
  }
  return definitions.find((definition) => definition.preset === preset) ?? null;
}

function hasAgentAffectingUpdates(input: ConnectionEditSubmitInput): boolean {
  return input.enabledAgents !== undefined
    || input.endpointUrl !== undefined
    || input.apiKeySource !== undefined
    || input.apiKey !== undefined
    || input.envKey !== undefined
    || input.openAiSessionSource !== undefined
    || input.openAiAuthJsonPath !== undefined
    || input.claudeSessionSource !== undefined;
}

function readAuthUpdateInput(input: {
  apiKey: string;
  apiKeySource: "direct" | "env_key";
  authJsonPath: string;
  authUpdateRequested: boolean;
  claudeSessionSource: "login" | "current_claude";
  connection: DesktopConnection;
  envKey: string;
  endpointUrl: string;
  sessionSource: "login" | "current_codex";
}): ConnectionEditSubmitInput {
  const endpointChanged = input.endpointUrl.trim() !== (input.connection.endpointUrl ?? "");
  const authPayload: ConnectionEditSubmitInput = {};

  if (endpointChanged) {
    authPayload.endpointUrl = input.endpointUrl.trim() || undefined;
  }

  if (!input.authUpdateRequested) {
    return authPayload;
  }

  if (input.connection.authMode === "api_key") {
    if (input.apiKeySource === "env_key" && input.envKey.trim()) {
      authPayload.apiKeySource = "env_key";
      authPayload.envKey = input.envKey.trim();
    }
    if (input.apiKeySource === "direct" && input.apiKey.trim()) {
      authPayload.apiKeySource = "direct";
      authPayload.apiKey = input.apiKey.trim();
    }
  }

  if (input.connection.authMode === "openai_session") {
    authPayload.openAiSessionSource = input.sessionSource;
    if (input.sessionSource === "current_codex") {
      authPayload.openAiAuthJsonPath = input.authJsonPath.trim() || undefined;
    }
  }

  if (input.connection.authMode === "claude_session") {
    authPayload.claudeSessionSource = input.claudeSessionSource;
  }

  return authPayload;
}
