type UsageIndicatorProps = {
  remainingPercent: number | null;
  showPercent?: boolean;
};

export function UsageIndicator({
  remainingPercent,
  showPercent = true,
}: UsageIndicatorProps) {
  const toneClass = remainingPercent === null
    ? "bg-muted-foreground/30"
    : remainingPercent <= 5
      ? "bg-destructive"
      : remainingPercent <= 20
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={`h-2.5 w-2.5 rounded-full ${toneClass}`} />
      {showPercent && remainingPercent !== null ? <span>{remainingPercent}%</span> : null}
    </div>
  );
}
