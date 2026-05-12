import { Badge } from "../ui/badge";

type DetectedSetupContentProps = {
  badgeLabel: string | null;
  primary: string;
  secondary?: string;
};

export function DetectedSetupContent({
  badgeLabel,
  primary,
  secondary,
}: DetectedSetupContentProps) {
  return (
    <div className="max-w-[42rem] px-2 py-2">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium text-foreground">{primary}</div>
          {badgeLabel ? (
            <Badge
              className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200"
              variant="outline"
            >
              {badgeLabel}
            </Badge>
          ) : null}
        </div>
        {secondary ? (
          <div className="text-sm text-muted-foreground">{secondary}</div>
        ) : null}
      </div>
    </div>
  );
}
