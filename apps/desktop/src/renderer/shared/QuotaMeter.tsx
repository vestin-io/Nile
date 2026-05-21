import type { Translator } from "./I18n";
import { Telescope } from "lucide-react";
import { Progress } from "../ui/progress";
import { cn } from "../ui/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

type QuotaMeterProps = {
  checked?: boolean;
  label: string;
  onCheckedChange?(checked: boolean): void;
  remainingPercent: number;
  renewalAt?: string | null;
  t: Translator;
};

export function QuotaMeter({
  checked = false,
  label,
  onCheckedChange,
  remainingPercent,
  renewalAt,
  t,
}: QuotaMeterProps) {
  const toggleLabel = checked
    ? t("connections.metricPreference.clear", { metric: label })
    : t("connections.metricPreference.pin", { metric: label });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span>{remainingPercent}%</span>
      </div>
      <div className="flex items-center gap-3">
        <Progress className="flex-1" value={remainingPercent} />
        {onCheckedChange ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={toggleLabel}
                  aria-pressed={checked}
                  className={cn(
                    "relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    checked
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.18)]"
                      : "border-border/70 bg-muted/20 text-muted-foreground/45 hover:border-muted-foreground/35 hover:bg-muted/40 hover:text-foreground/80",
                  )}
                  title={toggleLabel}
                  type="button"
                  onClick={() => onCheckedChange(!checked)}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-1 rounded-full transition-opacity duration-200",
                      checked ? "bg-amber-500/10 opacity-100" : "opacity-0",
                    )}
                  />
                  <Telescope className="relative z-10 h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{toggleLabel}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      {renewalAt ? (
        <div className="text-xs text-muted-foreground">
          {t("connections.renewsAt", { time: renewalAt })}
        </div>
      ) : null}
    </div>
  );
}
