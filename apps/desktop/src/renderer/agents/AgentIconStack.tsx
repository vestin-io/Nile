import { useId } from "react";
import type { AgentId } from "@nile/core/models/agent";

import type { Translator } from "../shared/I18n";
import { renderAgentIcon } from "./AgentIcons";
import { formatAgentsList } from "../shared/AgentSelection";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

type AgentIconStackProps = {
  agentIds: AgentId[];
  t: Translator;
};

export function AgentIconStack({ agentIds, t }: AgentIconStackProps) {
  const iconStackId = useId().replaceAll(":", "");
  if (agentIds.length === 0) {
    return null;
  }

  const tooltip = t("connections.currentlyUsedBy", {
    agents: formatAgentsList(agentIds, t),
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={tooltip}
            className="flex items-center gap-1.5"
          >
            {agentIds.map((agentId) => (
              <span
                key={agentId}
                aria-hidden="true"
                className={`flex shrink-0 items-center justify-center rounded-md border bg-muted/30 ${
                  agentId === "codex"
                    ? "h-8 w-8 p-1 [&_svg]:h-full [&_svg]:w-full"
                    : "h-7 w-7 p-1.5 [&_svg]:h-full [&_svg]:w-full"
                }`}
                dangerouslySetInnerHTML={{ __html: renderAgentIcon(agentId, `${iconStackId}-${agentId}`) }}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
