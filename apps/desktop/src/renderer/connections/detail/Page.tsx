import type { DesktopConnection } from "../../../state/Types";
import { useState } from "react";
import type { Translator } from "../../shared/I18n";
import { CircleHelp } from "lucide-react";
import { ConnectionActionGroup } from "./ActionGroup";
import { ConnectionAlertsSection } from "../alerts/Section";
import { ConnectionQuotaSection } from "../ConnectionQuotaSection";
import { ConnectionModelCatalogSection } from "./Models";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { formatAgentLabel, formatAgentsList } from "../../shared/AgentSelection";
import { authModeLabel } from "../../shared/DisplayText";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../ui/breadcrumb";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { FieldCard } from "../../ui/field";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { useConnectionQuotaMetricPreferences } from "../../shared/useConnectionQuotaMetricPreferences";

type ConnectionDetailPageProps = {
  connection: DesktopConnection;
  contextAgentLabel?: string | null;
  t: Translator;
  onBack(): void;
  onBackToAgentList?(): void;
  onBackToAgentDetail?(): void;
  onBindCursorUsage(connectionId: string): Promise<void>;
  onEdit(): void;
  onRefresh(): Promise<void>;
  onRemove(connectionId: string): Promise<void>;
  onCreateAlert(input:
    | { connectionId: string; metricKey: string; metricLabel: string; type: "low-percent"; thresholdPercent: number; enabled: boolean }
    | { connectionId: string; metricKey: string; metricLabel: string; type: "renewed"; enabled: boolean }
  ): Promise<void>;
  onUpdateAlert(input:
    | { alertId: string; connectionId: string; metricKey: string; metricLabel: string; type: "low-percent"; thresholdPercent: number; enabled: boolean }
    | { alertId: string; connectionId: string; metricKey: string; metricLabel: string; type: "renewed"; enabled: boolean }
  ): Promise<void>;
  onDeleteAlert(connectionId: string, alertId: string): Promise<void>;
  onOpenNotificationHistory(connectionId: string): void;
};

export function ConnectionDetailPage({
  connection,
  contextAgentLabel = null,
  t,
  onBack,
  onBackToAgentList,
  onBackToAgentDetail,
  onBindCursorUsage,
  onEdit,
  onRefresh,
  onRemove,
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
  onOpenNotificationHistory,
}: ConnectionDetailPageProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const quotaMetricPreferences = useConnectionQuotaMetricPreferences();
  const canRepairUsage =
    connection.endpointFamily === "cursor"
    && connection.authMode === "cursor_session"
    && (!connection.usage || connection.usage.status === "unavailable");
  const canRemove = connection.selectedByAgents.length === 0;
  const preferredMetricKey = quotaMetricPreferences.readPreference(connection.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Breadcrumb>
              <BreadcrumbList>
                {contextAgentLabel ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          onBackToAgentList?.();
                        }}
                      >
                        {t("page.agents")}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          onBackToAgentDetail?.();
                        }}
                      >
                        {contextAgentLabel}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                ) : (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          onBack();
                        }}
                      >
                        {t("page.connections")}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
                <BreadcrumbItem>
                  <BreadcrumbPage>{connection.label}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{connection.label}</h1>
                {connection.selectedByAgents.map((agentId) => (
                  <Badge
                    key={agentId}
                    variant="default"
                  >
                    {t("connections.inUseByAgent", { agent: formatAgentLabel(agentId) })}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            {canRepairUsage ? (
              <Button variant="secondary" onClick={() => void onBindCursorUsage(connection.id)}>
                {t("common.repairUsage")}
              </Button>
            ) : null}
            <ConnectionActionGroup
              canRemove={canRemove}
              t={t}
              onEdit={onEdit}
              onRefresh={onRefresh}
              onRemove={async () => {
                setIsRemoveDialogOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {shouldShowEndpointField(connection) ? (
          <DetailField label={t("common.endpoint")} value={connection.endpointLabel} />
        ) : null}
        <DetailField
          label={t("common.auth")}
          value={authModeLabel(connection.authMode, t)}
          tooltip={readAuthTooltip(connection.authMode, t)}
        />
        <DetailField
          label={t("common.capability")}
          value={connection.enabledAgents.length === 0 ? t("common.none") : formatAgentsList(connection.enabledAgents, t)}
        />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <ConnectionQuotaSection
          className="h-full"
          connection={connection}
          preferredMetricKey={preferredMetricKey}
          showPlanLabel
          t={t}
          title={t("common.usage")}
          onPreferredMetricKeyChange={(metricKey) => {
            quotaMetricPreferences.setPreference(connection.id, metricKey);
          }}
        />
        <ConnectionModelCatalogSection
          connectionId={connection.id}
          t={t}
        />
      </section>

      <ConnectionAlertsSection
        alerts={connection.alerts ?? []}
        connectionId={connection.id}
        metrics={connection.alertMetrics ?? []}
        t={t}
        onCreateAlert={onCreateAlert}
        onDeleteAlert={onDeleteAlert}
        onOpenHistory={() => onOpenNotificationHistory(connection.id)}
        onUpdateAlert={onUpdateAlert}
      />

      <ConfirmDialog
        confirmLabel={t("common.remove")}
        description={t("connections.removeDialogDescription", { name: connection.label })}
        isConfirming={isRemoving}
        open={isRemoveDialogOpen}
        title={t("connections.removeDialogTitle")}
        t={t}
        onConfirm={async () => {
          if (isRemoving) {
            return;
          }
          setIsRemoving(true);
          try {
            await onRemove(connection.id);
          } finally {
            setIsRemoving(false);
          }
        }}
        onOpenChange={(open) => {
          if (isRemoving) {
            return;
          }
          setIsRemoveDialogOpen(open);
        }}
      />
    </div>
  );
}

function shouldShowEndpointField(connection: DesktopConnection): boolean {
  return !(connection.endpointFamily === "openai" && connection.authMode === "openai_session");
}

function readAuthTooltip(authMode: string, t: Translator): string | null {
  switch (authMode) {
    case "openai_session":
      return t("connections.authHelp.openaiSession");
    case "gemini_cli_session":
      return "Stored Gemini CLI Google session";
    default:
      return null;
  }
}

function DetailField({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string | null;
}) {
  return (
    <FieldCard label={label}>
      <div className="flex items-center gap-2 text-sm">
        <span>{value}</span>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={tooltip}
                  className="inline-flex items-center text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
                  type="button"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </FieldCard>
  );
}
