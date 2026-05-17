import { type ReactNode } from "react";
import type { AgentId } from "@nile/core/models/agent/definitions";
import { SHARED_SESSION_CONNECTION_METHODS } from "@nile/builtins/session";

import type { Translator } from "../shared/I18n";
import { orderSupportedAuthModes, type Definition } from "../shared/DesktopData";
import { authModeLabel } from "../shared/DisplayText";
import { formatAgentLabel, formatAgentsList } from "../shared/AgentSelection";
import { ChoiceCard } from "../ui/choice-card";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export type ConnectionMethod = {
  key: string;
  authMode: Definition["supportedAuthModes"][number];
  apiKeySource?: "direct" | "env_key";
  description: string;
  sessionSource?: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor";
  title: string;
};

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function buildConnectionMethods(definition: Definition, t: Translator): ConnectionMethod[] {
  const methods: ConnectionMethod[] = [];

  for (const authMode of orderSupportedAuthModes(definition.supportedAuthModes)) {
    if (authMode === "api_key") {
      methods.push({
        key: "api_key:direct",
        authMode,
        apiKeySource: "direct",
        description: t("addConnection.pasteApiKeyDescription"),
        title: t("addConnection.pasteApiKey"),
      });
      if (definition.supportsEnvKey) {
        methods.push({
          key: "api_key:env_key",
          authMode,
          apiKeySource: "env_key",
          description: t("addConnection.useExistingEnvKeyDescription"),
          title: t("addConnection.useExistingEnvKey"),
        });
      }
      continue;
    }

    for (const method of SHARED_SESSION_CONNECTION_METHODS.listVisibleForAddConnectionForAuthMode(authMode)) {
      methods.push({
        key: method.key,
        authMode,
        description: method.descriptionKey ? t(method.descriptionKey) : t(method.titleKey),
        sessionSource: method.source,
        title: t(method.titleKey),
      });
    }
    if (methods.some((method) => method.authMode === authMode)) {
      continue;
    }

    methods.push({
      key: authMode,
      authMode,
      description: authModeLabel(authMode, t),
      title: authModeLabel(authMode, t),
    });
  }

  return methods;
}

export function readSelectedMethodKey(
  authMode: string,
  sessionSource: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor",
  apiKeySource: "direct" | "env_key" = "direct",
): string {
  if (authMode === "api_key") {
    return `api_key:${apiKeySource}`;
  }
  const sessionMethodKey = SHARED_SESSION_CONNECTION_METHODS.readMethodKeyForSelection(
    authMode,
    sessionSource,
  );
  if (sessionMethodKey) {
    return sessionMethodKey;
  }

  return authMode;
}

export function ConnectionMethodSelector({
  disabled = false,
  methods,
  selectedKey,
  onSelect,
}: {
  disabled?: boolean;
  methods: ConnectionMethod[];
  selectedKey: string;
  onSelect(method: ConnectionMethod): void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {methods.map((method) => (
        <ChoiceCard
          key={method.key}
          disabled={disabled}
          onClick={() => onSelect(method)}
          selected={selectedKey === method.key}
          title={method.title}
          description={method.description}
        />
      ))}
    </div>
  );
}

export function ConnectionCapabilityField({
  configurableAgents,
  detectedAgents,
  editable,
  enabledAgents,
  isProbingSupport,
  showDetectionState,
  t,
  onEnabledAgentsChange,
}: {
  configurableAgents: AgentId[];
  detectedAgents: AgentId[];
  editable: boolean;
  enabledAgents: AgentId[];
  isProbingSupport: boolean;
  showDetectionState: boolean;
  t: Translator;
  onEnabledAgentsChange?(nextAgents: AgentId[]): void;
}) {
  const enabledAgentsSelectionInvalid = editable && enabledAgents.length === 0;

  return (
    <FormField label={editable ? t("dialog.enabledAgents") : t("common.capability")}>
      <div className="rounded-xl border bg-muted/30 p-4">
      <CapabilitySummary
        configurableAgents={configurableAgents}
        detectedAgents={detectedAgents}
        editable={editable}
        enabledAgents={enabledAgents}
        enabledAgentsSelectionInvalid={enabledAgentsSelectionInvalid}
        isProbingSupport={isProbingSupport}
        showDetectionState={showDetectionState}
        t={t}
        onEnabledAgentsChange={onEnabledAgentsChange}
      />
      </div>
    </FormField>
  );
}

function CapabilitySummary({
  configurableAgents,
  detectedAgents,
  editable,
  enabledAgents,
  enabledAgentsSelectionInvalid,
  isProbingSupport,
  showDetectionState,
  t,
  onEnabledAgentsChange,
}: {
  configurableAgents: AgentId[];
  detectedAgents: AgentId[];
  editable: boolean;
  enabledAgents: AgentId[];
  enabledAgentsSelectionInvalid: boolean;
  isProbingSupport: boolean;
  showDetectionState: boolean;
  t: Translator;
  onEnabledAgentsChange?(nextAgents: AgentId[]): void;
}) {
  return (
    <div className="grid gap-2">
      {showDetectionState ? (
        <div className="text-sm text-muted-foreground">
          {isProbingSupport
            ? t("dialog.probingSupport")
            : detectedAgents.length > 0
              ? t("dialog.detectedAgents", {
                  agents: formatAgentsList(detectedAgents, t),
                })
              : t("dialog.noDetectedAgents")}
        </div>
      ) : null}
      {editable ? (
        <>
          {configurableAgents.map((agentId) => (
            <label key={agentId} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={enabledAgents.includes(agentId)}
                onCheckedChange={(checked) => {
                  if (!onEnabledAgentsChange) {
                    return;
                  }
                  onEnabledAgentsChange(
                    checked
                      ? [...new Set([...enabledAgents, agentId])]
                      : enabledAgents.filter((value) => value !== agentId),
                  );
                }}
              />
              <span>{formatAgentLabel(agentId)}</span>
            </label>
          ))}
          {enabledAgentsSelectionInvalid ? (
            <div className="text-sm text-destructive">{t("dialog.enabledAgentsRequired")}</div>
          ) : null}
        </>
      ) : (
        <div className="text-sm">{formatAgentsList(detectedAgents.length > 0 ? detectedAgents : enabledAgents, t)}</div>
      )}
    </div>
  );
}
