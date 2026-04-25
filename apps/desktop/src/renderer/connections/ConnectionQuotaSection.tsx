import type { DesktopConnection } from "../../DesktopTypes";
import type { Translator } from "../shared/I18n";
import { UsagePanel } from "../shared/UsagePanel";

type ConnectionQuotaSectionProps = {
  connection: DesktopConnection;
  title: string;
  t: Translator;
  className?: string;
  framed?: boolean;
  hideWhenUnavailable?: boolean;
  maxWindows?: number;
  showPlanLabel?: boolean;
};

export function ConnectionQuotaSection({
  connection,
  title,
  t,
  className,
  framed = true,
  hideWhenUnavailable = false,
  maxWindows,
  showPlanLabel = false,
}: ConnectionQuotaSectionProps) {
  const usage = connection.usage;
  const hasWindows = usage?.status === "available" && usage.windows.length > 0;
  if (!hasWindows && hideWhenUnavailable) {
    return null;
  }

  return (
    <UsagePanel
      className={className}
      framed={framed}
      maxWindows={maxWindows}
      showPlanLabel={showPlanLabel}
      t={t}
      title={title}
      usage={usage}
    />
  );
}
