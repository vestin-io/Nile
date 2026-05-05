import type { DesktopUsageState } from "../../state/UsageSummary";
import type { Translator } from "./I18n";
import { formatUsageResetAt } from "./DisplayText";
import { QuotaMeter } from "./QuotaMeter";
import { Skeleton } from "../ui/skeleton";

type UsagePanelProps = {
  title: string;
  t: Translator;
  usage: DesktopUsageState | null | undefined;
  className?: string;
  framed?: boolean;
  loading?: boolean;
  maxWindows?: number;
  planLabel?: string | null;
  showPlanLabel?: boolean;
  showRenewalAt?: boolean;
};

export function UsagePanel({
  title,
  t,
  usage,
  className,
  framed = true,
  loading = false,
  maxWindows,
  planLabel,
  showPlanLabel = false,
  showRenewalAt = true,
}: UsagePanelProps) {
  const hasWindows = usage?.status === "available" && usage.windows.length > 0;
  const windows = hasWindows
    ? (typeof maxWindows === "number" ? usage.windows.slice(0, maxWindows) : usage.windows)
    : [];
  const visiblePlanLabel = planLabel ?? (usage?.status === "available" ? usage.planLabel : undefined);

  return (
    <section
      className={[
        "space-y-4",
        framed ? "rounded-xl border bg-background p-4" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        {showPlanLabel && visiblePlanLabel ? (
          <div className="text-sm font-medium">{visiblePlanLabel}</div>
        ) : null}
      </div>

      {loading ? (
        <UsagePanelSkeleton />
      ) : hasWindows ? (
        <div className="space-y-4">
          {windows.map((window) => (
            <QuotaMeter
              key={window.label}
              label={window.label}
              remainingPercent={window.remainingPercent}
              renewalAt={showRenewalAt ? formatUsageResetAt(window.resetsAt ?? null) : undefined}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{t("common.unknown")}</div>
      )}
    </section>
  );
}

function UsagePanelSkeleton() {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}
