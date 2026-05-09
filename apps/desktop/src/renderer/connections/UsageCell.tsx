import type { DesktopConnection } from "../../state/Types";
import type { Translator } from "../shared/I18n";
import { formatUsageText } from "../shared/DisplayText";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { ConnectionQuotaSection } from "./ConnectionQuotaSection";

type ConnectionUsageCellProps = {
  connection: DesktopConnection;
  t: Translator;
};

export function ConnectionUsageCell({
  connection,
  t,
}: ConnectionUsageCellProps) {
  const summary = formatUsageText(connection, t);
  const hasQuotaDetail = connection.usage?.status === "available" && connection.usage.windows.length > 0;

  if (!hasQuotaDetail) {
    return <span>{summary}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-left text-sm text-foreground/90 underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            {summary}
          </button>
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-80 border-0 bg-transparent p-0 shadow-none">
          <ConnectionQuotaSection
            className="w-80 shadow-md"
            connection={connection}
            framed
            maxWindows={3}
            showPlanLabel
            t={t}
            title={t("common.usage")}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
