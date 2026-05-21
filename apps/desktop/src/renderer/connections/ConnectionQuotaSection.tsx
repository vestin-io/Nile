import type { DesktopConnection } from "../../state/Types";
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
  preferredMetricKey?: string | null;
  showPlanLabel?: boolean;
  onPreferredMetricKeyChange?(metricKey: string | null): void;
};

export function ConnectionQuotaSection({
  connection,
  title,
  t,
  className,
  framed = true,
  hideWhenUnavailable = false,
  maxWindows,
  preferredMetricKey,
  showPlanLabel = false,
  onPreferredMetricKeyChange,
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
      preferredMetricKey={preferredMetricKey}
      showPlanLabel={showPlanLabel}
      t={t}
      title={title}
      usage={usage}
      onPreferredMetricKeyChange={onPreferredMetricKeyChange}
    />
  );
}
