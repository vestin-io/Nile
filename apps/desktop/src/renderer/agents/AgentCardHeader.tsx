import { useId, type ReactNode } from "react";

import type { DesktopAgentState } from "../../DesktopTypes";
import { renderAgentIcon } from "./AgentIcons";

type AgentCardHeaderProps = {
  agent: DesktopAgentState;
  subtitle?: string;
  trailing?: ReactNode;
};

export function AgentCardHeader({
  agent,
  subtitle,
  trailing,
}: AgentCardHeaderProps) {
  const iconInstanceId = useId().replaceAll(":", "");
  const iconSizeClass = agent.agentId === "codex"
    ? "[&_svg]:h-9 [&_svg]:w-9"
    : "[&_svg]:h-8 [&_svg]:w-8";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40 p-2 ${iconSizeClass}`}>
          <div
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: renderAgentIcon(agent.agentId, iconInstanceId) }}
          />
        </div>
        <div className="min-w-0 space-y-1 pt-1">
          <div className="text-lg font-semibold text-foreground">{agent.agentLabel}</div>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
