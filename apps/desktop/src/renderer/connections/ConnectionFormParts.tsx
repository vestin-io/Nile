import { type ReactNode } from "react";
import type { AgentId } from "@nile/core/models/agent/types";

import type { Translator } from "../shared/I18n";
import { authModeLabel, formatAgentLabel, formatAgentsList, orderSupportedAuthModes, type Definition } from "../shared/Support";
import { ChoiceCard } from "../ui/choice-card";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export type ConnectionMethod = {
  key: string;
  authMode: Definition["supportedAuthModes"][number];
  apiKeySource?: "direct" | "env_key";
  description: string;
  sessionSource?: "login" | "current_codex";
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
    if (authMode === "openai_session") {
      methods.push({
        key: "openai_session:login",
        authMode,
        description: t("addConnection.signInWithOpenAiDescription"),
        sessionSource: "login",
        title: t("addConnection.signInWithOpenAi"),
      });
      methods.push({
        key: "openai_session:current_codex",
        authMode,
        description: t("addConnection.importAuthJsonDescription"),
        sessionSource: "current_codex",
        title: t("addConnection.importAuthJson"),
      });
      continue;
    }

    if (authMode === "claude_session") {
      methods.push({
        key: "claude_session",
        authMode,
        description: t("addConnection.signInWithClaudeDescription"),
        title: t("addConnection.signInWithClaude"),
      });
      continue;
    }

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
  sessionSource: "login" | "current_codex",
  apiKeySource: "direct" | "env_key" = "direct",
): string {
  if (authMode === "api_key") {
    return `api_key:${apiKeySource}`;
  }
  if (authMode === "openai_session") {
    return `openai_session:${sessionSource}`;
  }

  return authMode;
}

export function ConnectionMethodSelector({
  methods,
  selectedKey,
  onSelect,
}: {
  methods: ConnectionMethod[];
  selectedKey: string;
  onSelect(method: ConnectionMethod): void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {methods.map((method) => (
        <ChoiceCard
          key={method.key}
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
  editable,
  enabledAgents,
  isProbingSupport,
  showDetectionState,
  suggestedAgents,
  t,
  onEnabledAgentsChange,
}: {
  configurableAgents: AgentId[];
  editable: boolean;
  enabledAgents: AgentId[];
  isProbingSupport: boolean;
  showDetectionState: boolean;
  suggestedAgents: AgentId[];
  t: Translator;
  onEnabledAgentsChange?(nextAgents: AgentId[]): void;
}) {
  const enabledAgentsSelectionInvalid = editable && enabledAgents.length === 0;

  return (
    <FormField label={editable ? t("dialog.enabledAgents") : t("common.capability")}>
      <div className="rounded-xl border bg-muted/30 p-4">
        <CapabilitySummary
          configurableAgents={configurableAgents}
          editable={editable}
          enabledAgents={enabledAgents}
          enabledAgentsSelectionInvalid={enabledAgentsSelectionInvalid}
          isProbingSupport={isProbingSupport}
          showDetectionState={showDetectionState}
          suggestedAgents={suggestedAgents}
          t={t}
          onEnabledAgentsChange={onEnabledAgentsChange}
        />
      </div>
    </FormField>
  );
}

function CapabilitySummary({
  configurableAgents,
  editable,
  enabledAgents,
  enabledAgentsSelectionInvalid,
  isProbingSupport,
  showDetectionState,
  suggestedAgents,
  t,
  onEnabledAgentsChange,
}: {
  configurableAgents: AgentId[];
  editable: boolean;
  enabledAgents: AgentId[];
  enabledAgentsSelectionInvalid: boolean;
  isProbingSupport: boolean;
  showDetectionState: boolean;
  suggestedAgents: AgentId[];
  t: Translator;
  onEnabledAgentsChange?(nextAgents: AgentId[]): void;
}) {
  return (
    <div className="grid gap-2">
      {showDetectionState ? (
        <div className="text-sm text-muted-foreground">
          {isProbingSupport
            ? t("dialog.probingSupport")
            : suggestedAgents.length > 0
              ? t("dialog.detectedAgents", {
                  agents: formatAgentsList(suggestedAgents, t),
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
        <div className="text-sm">{formatAgentsList(suggestedAgents.length > 0 ? suggestedAgents : enabledAgents, t)}</div>
      )}
    </div>
  );
}
