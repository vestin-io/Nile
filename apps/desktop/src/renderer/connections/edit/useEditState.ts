import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import type { DesktopConnection } from "../../../state/Types";
import { buildConnectionMethods, readSelectedMethodKey } from "../ConnectionFormParts";
import { formatAgentsList, sameAgentSelection } from "../../shared/AgentSelection";
import type { Definition } from "../../shared/DesktopData";
import type { Translator } from "../../shared/I18n";
import { syncDefaultAuthJsonPath } from "../AuthJsonPath";
import { useGatewaySupportState } from "./useGatewayState";

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
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [authUpdateRequested, setAuthUpdateRequested] = useState(false);
  const previousDefaultOpenAiAuthJsonPath = useRef(defaultOpenAiAuthJsonPath);

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
  const {
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
    detectedAgents,
  } = useGatewaySupportState({
    apiKey,
    apiKeySource,
    connection,
    definition,
    enabledAgents,
    endpointUrl,
    envKey,
    onEnabledAgentsChanged: setEnabledAgents,
  });
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
  }, [connection.id]);

  useEffect(() => {
    const previousDefault = previousDefaultOpenAiAuthJsonPath.current;
    previousDefaultOpenAiAuthJsonPath.current = defaultOpenAiAuthJsonPath;

    if (previousDefault === defaultOpenAiAuthJsonPath) {
      return;
    }

    setAuthJsonPath((current) =>
      syncDefaultAuthJsonPath(current, previousDefault, defaultOpenAiAuthJsonPath));
  }, [defaultOpenAiAuthJsonPath]);

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

  const chooseAuthJsonPath = async () => {
    setAuthUpdateRequested(true);
    setIsChoosingAuthJsonPath(true);
    try {
      setActionError(null);
      const path = await window.nileDesktop.connections.chooseOpenAiAuthJsonPath(authJsonPath);
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
    detectedAgents,
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
