import type { Translator } from "./I18n";
import { Progress } from "../ui/progress";

type QuotaMeterProps = {
  label: string;
  remainingPercent: number;
  renewalAt?: string | null;
  t: Translator;
};

export function QuotaMeter({
  label,
  remainingPercent,
  renewalAt,
  t,
}: QuotaMeterProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span>{remainingPercent}%</span>
      </div>
      <Progress value={remainingPercent} />
      {renewalAt ? (
        <div className="text-xs text-muted-foreground">
          {t("connections.renewsAt", { time: renewalAt })}
        </div>
      ) : null}
    </div>
  );
}
