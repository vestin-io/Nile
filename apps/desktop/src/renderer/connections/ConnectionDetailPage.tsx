import type { DesktopConnection } from "../../DesktopTypes";
import type { Translator } from "../shared/I18n";
import { CircleHelp } from "lucide-react";
import { ConnectionActionGroup } from "./ConnectionActionGroup";
import { ConnectionQuotaSection } from "./ConnectionQuotaSection";
import { authModeLabel, formatAgentLabel, formatAgentsList } from "../shared/Support";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FieldCard } from "../ui/field";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

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
}: ConnectionDetailPageProps) {
  const canRepairUsage =
    connection.endpointFamily === "cursor"
    && connection.authMode === "cursor_session"
    && (!connection.usage || connection.usage.status === "unavailable");
  const canRemove = connection.selectedByAgents.length === 0;

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
                await onRemove(connection.id);
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

      <ConnectionQuotaSection
        connection={connection}
        showPlanLabel
        t={t}
        title={t("common.usage")}
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
