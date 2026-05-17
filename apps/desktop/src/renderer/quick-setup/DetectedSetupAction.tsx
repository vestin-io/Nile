import { ArrowDownToLine, Check, LoaderCircle } from "lucide-react";

import type { AgentId } from "@nile/core/models/agent/definitions";

import type { Translator } from "../shared/I18n";
import { Button } from "../ui/button";

type DetectedSetupActionProps = {
  actionKind: "configure" | "disabled" | "save" | "saved";
  agentId: AgentId;
  canConfigure: boolean;
  isPending: boolean;
  pendingMessageKey: string | null;
  t: Translator;
  onConfigure(agentId: AgentId): void;
  onSave(agentId: AgentId): void;
};

export function DetectedSetupAction({
  actionKind,
  agentId,
  canConfigure,
  isPending,
  pendingMessageKey,
  t,
  onConfigure,
  onSave,
}: DetectedSetupActionProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 md:items-end">
      {renderAction({
        actionKind,
        agentId,
        canConfigure,
        isPending,
        t,
        onConfigure,
        onSave,
      })}
      {pendingMessageKey ? (
        <div className="text-right text-xs text-muted-foreground">
          {t(pendingMessageKey)}
        </div>
      ) : null}
    </div>
  );
}

function renderAction(input: {
  actionKind: "configure" | "disabled" | "save" | "saved";
  agentId: AgentId;
  canConfigure: boolean;
  isPending: boolean;
  t: Translator;
  onConfigure(agentId: AgentId): void;
  onSave(agentId: AgentId): void;
}) {
  if (input.actionKind === "saved") {
    return (
      <div
        aria-label={input.t("quickSetup.confirmedAction")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
        title={input.t("quickSetup.confirmedAction")}
      >
        <Check className="h-4 w-4" />
      </div>
    );
  }

  if (input.actionKind === "save") {
    return (
      <Button
        className="gap-2 pl-3 pr-4 shadow-sm hover:shadow"
        disabled={input.isPending}
        size="sm"
        onClick={() => {
          if (input.isPending) {
            return;
          }
          input.onSave(input.agentId);
        }}
      >
        {input.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
        {input.t("quickSetup.looksGood")}
      </Button>
    );
  }

  if (input.actionKind === "configure" && input.canConfigure) {
    return (
      <Button size="sm" onClick={() => input.onConfigure(input.agentId)}>
        {input.t("quickSetup.configureNow")}
      </Button>
    );
  }

  return (
    <Button variant="secondary" size="sm" disabled>
      {input.t("quickSetup.configureUnavailable")}
    </Button>
  );
}
